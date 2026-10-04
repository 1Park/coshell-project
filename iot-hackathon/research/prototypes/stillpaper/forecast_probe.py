"""Offline feasibility probe; not a tremor diagnosis or hardware evaluation.

Uses only hw_dataset, avoiding unknown overlap with new_dataset. Splits files
before constructing windows. Causal zero-order hold and causal filtering only.
The target is a filtered coordinate signal, NOT ground-truth intended motion.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import time

import numpy as np
from scipy.signal import butter, sosfilt
import torch
from torch import nn

FS = 100
HISTORY = 100
HORIZON = 4
STRIDE = 5
SEED = 20261004


def build_windows(root, fold=0):
    groups = {"train": [], "validation": [], "test": []}
    file_audit = []
    for category in ("control", "parkinson"):
        files = sorted((root / category).glob("*.txt"),
                       key=lambda p: hashlib.sha256(p.name.encode()).hexdigest())
        assert len(files) % 5 == 0
        for j, path in enumerate(files):
            bucket = (j // (len(files) // 5) - fold) % 5
            split = "train" if bucket < 3 else "validation" if bucket == 3 else "test"
            a = np.loadtxt(path, delimiter=";")
            a = a[a[:, 6] == 0]  # static spiral only
            # Only contiguous pen-down runs with increasing timestamps.
            valid = a[:, 3] > 0
            breaks = np.r_[True, (np.diff(a[:, 5]) <= 0) | (np.diff(a[:, 5]) > 50)]
            chunks, current = [], []
            for k, row in enumerate(a):
                if breaks[k] or not valid[k]:
                    if current:
                        chunks.append(np.array(current))
                    current = []
                if valid[k]:
                    current.append(row)
            if current:
                chunks.append(np.array(current))
            count = 0
            for chunk in chunks:
                if len(chunk) < 250:
                    continue
                t = (chunk[:, 5] - chunk[0, 5]) / 1000.
                ticks = np.arange(0, t[-1], 1 / FS)
                indexes = np.searchsorted(t, ticks, side="right") - 1
                assert np.all(t[indexes] <= ticks)
                xy = chunk[indexes, :2] - chunk[0, :2]
                # Remove slow drift causally. This is not proof of voluntary/
                # involuntary separation. Discard startup transient (2 s).
                sos = butter(2, 3., btype="highpass", fs=FS, output="sos")
                hp = sosfilt(sos, xy, axis=0)
                for end in range(2 * FS + HISTORY, len(hp) - HORIZON, STRIDE):
                    for axis in (0, 1):
                        history = hp[end - HISTORY + 1:end + 1, axis]
                        scale = max(float(np.sqrt(np.mean(history ** 2))), 1.)
                        x = (history / scale).astype(np.float32)
                        y = float(hp[end + HORIZON, axis] / scale)
                        groups[split].append((x, y, path.stem))
                        count += 1
            file_audit.append({"record": path.stem, "split": split,
                               "static_rows": len(a), "windows": count})
    datasets = {}
    for split, rows in groups.items():
        datasets[split] = (np.stack([r[0] for r in rows]),
                           np.array([r[1] for r in rows], dtype=np.float32),
                           np.array([r[2] for r in rows]))
    return datasets, file_audit


def harmonic_predict(x):
    """Strong local model: choose frequency by past fit; include two harmonics."""
    past = np.arange(-HISTORY + 1, 1) / FS
    future = HORIZON / FS
    best_loss = np.full(len(x), np.inf)
    answer = np.zeros(len(x))
    for frequency in np.arange(3., 12.01, .25):
        def features(t):
            t = np.atleast_1d(t)
            return np.stack([np.ones_like(t), t,
                             np.sin(2 * np.pi * frequency * t),
                             np.cos(2 * np.pi * frequency * t),
                             np.sin(4 * np.pi * frequency * t),
                             np.cos(4 * np.pi * frequency * t)], axis=-1)
        design = features(past)
        beta = x @ np.linalg.pinv(design).T
        error = np.mean((x - beta @ design.T) ** 2, axis=1)
        take = error < best_loss
        answer[take] = (beta[take] @ features(future).T).ravel()
        best_loss[take] = error[take]
    return answer


def per_record(y, prediction, records):
    values = []
    for key in sorted(set(records)):
        mask = records == key
        values.append({"record": str(key),
                       "rmse": float(np.sqrt(np.mean((y[mask] - prediction[mask]) ** 2)))})
    return values


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=Path("/tmp/iot-stillpaper-data/hw_dataset"))
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--fold", type=int, choices=range(5), default=0)
    args = parser.parse_args()
    start = time.time()
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    torch.set_num_threads(4)
    datasets, audit = build_windows(args.data, args.fold)
    tx, ty, _ = datasets["train"]
    vx, vy, _ = datasets["validation"]
    ex, ey, records = datasets["test"]
    print(json.dumps({k: len(v[1]) for k, v in datasets.items()}), flush=True)
    predictions = {"no_compensation": np.zeros_like(ey),
                   "delayed_copy": ex[:, -1],
                   "constant_velocity": ex[:, -1] + HORIZON * (ex[:, -1] - ex[:, -2])}
    # Choose linear AR regularization on validation records only.
    train_design = np.c_[tx, np.ones(len(tx))]
    val_design = np.c_[vx, np.ones(len(vx))]
    test_design = np.c_[ex, np.ones(len(ex))]
    best_ar, ridge_trials = None, []
    for ridge in (.01, .1, 1., 10., 100., 1000.):
        w = np.linalg.solve(train_design.T @ train_design + ridge * np.eye(HISTORY + 1),
                            train_design.T @ ty)
        loss = float(np.mean((val_design @ w - vy) ** 2))
        ridge_trials.append({"ridge": ridge, "validation_mse": loss})
        if best_ar is None or loss < best_ar[0]:
            best_ar = (loss, ridge, w)
    predictions["ridge_ar"] = test_design @ best_ar[2]
    predictions["local_adaptive_harmonic"] = harmonic_predict(ex)
    # Compact causal history MLP; no claim that this is the best architecture.
    model = nn.Sequential(nn.Linear(HISTORY, 64), nn.Tanh(),
                          nn.Linear(64, 32), nn.Tanh(), nn.Linear(32, 1))
    optimizer = torch.optim.AdamW(model.parameters(), lr=.001, weight_decay=.001)
    xt, yt = torch.from_numpy(tx), torch.from_numpy(ty[:, None])
    xv, yv = torch.from_numpy(vx), torch.from_numpy(vy[:, None])
    best = (float("inf"), None, 0)
    history = []
    for epoch in range(args.epochs):
        model.train()
        order = torch.randperm(len(xt))
        for batch in order.split(512):
            optimizer.zero_grad()
            loss = nn.functional.mse_loss(model(xt[batch]), yt[batch])
            loss.backward()
            optimizer.step()
        model.eval()
        with torch.no_grad():
            val_loss = float(nn.functional.mse_loss(model(xv), yv))
        history.append(val_loss)
        if val_loss < best[0]:
            best = (val_loss, {k: v.detach().clone() for k, v in model.state_dict().items()}, epoch + 1)
        if (epoch + 1) % 10 == 0:
            print(f"epoch={epoch + 1} validation_mse={val_loss:.6f}", flush=True)
    model.load_state_dict(best[1])
    with torch.no_grad():
        predictions["small_mlp"] = model(torch.from_numpy(ex)).squeeze(1).numpy()
    scores = {}
    for name, prediction in predictions.items():
        by_record = per_record(ey, prediction, records)
        scores[name] = {"pooled_rmse": float(np.sqrt(np.mean((prediction - ey) ** 2))),
                        "median_record_rmse": float(np.median([v["rmse"] for v in by_record])),
                        "per_record": by_record}
    # Ideal sinusoid: delayed perfect-amplitude compensation residual/initial.
    delay_examples = [{"frequency_hz": f, "delay_ms": delay,
                       "residual_amplitude_ratio": 2 * abs(math.sin(math.pi * f * delay / 1000))}
                      for f in (4, 6, 8, 10) for delay in (10, 20, 30, 40)]
    report = {
        "evidence_level": "offline_recorded_data_forecast_only_no_hardware_no_clinical_claim",
        "source": json.loads(Path("/tmp/iot-stillpaper-data-source.json").read_text()),
        "source_subset": "hw_dataset only; no new_dataset; static spiral Test ID 0 only",
        "cross_validation_fold": args.fold,
        "sampling": {"hz": FS, "resampling": "causal_previous_sample_hold",
                     "filter": "causal order-2 Butterworth highpass 3 Hz",
                     "warmup_seconds": 2, "max_original_gap_ms": 50},
        "prediction": {"history_ms": HISTORY * 1000 / FS, "horizon_ms": HORIZON * 1000 / FS,
                       "normalization": "past history RMS with floor=1 native coordinate unit",
                       "target": "future causal-highpass coordinate, not intended handwriting"},
        "split_counts": {k: {"windows": len(v[1]), "records": len(set(v[2]))} for k, v in datasets.items()},
        "record_audit": audit,
        "model": {"parameters": sum(p.numel() for p in model.parameters()), "selected_epoch": best[2],
                  "validation_mse": best[0], "epochs": args.epochs},
        "ridge_selected": best_ar[1], "ridge_validation_trials": ridge_trials,
        "scores": scores, "ideal_sinusoid_delay_examples": delay_examples,
        "seconds": time.time() - start,
        "versions": {"torch": torch.__version__, "numpy": np.__version__},
        "limitations": ["No real paper, motor latency, friction, or actuator evaluated.",
                        "Filtered coordinates are not ground truth involuntary motion.",
                        "40 source files from hw_dataset, not the 77 participants stated for the complete repository.",
                        "Native coordinate units; no verified physical scale in millimetres.",
                        "Sampling cadence differs across source groups; no guarantee of transfer to camera/IMU sensing.",
                        "Single deterministic split and one small neural architecture; no clinical efficacy inference."]}
    suffix = f".fold{args.fold}" if args.fold else ""
    output = Path(__file__).with_name(f"forecast_report{suffix}.json")
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    torch.save({"state_dict": model.state_dict(), "architecture": "100-64-tanh-32-tanh-1"},
               Path(__file__).with_name(f"forecast_model{suffix}.pt"))
    print(json.dumps({k: {m: v for m, v in val.items() if m != "per_record"}
                      for k, val in scores.items()}, indent=2), flush=True)
    print(f"report={output} seconds={report['seconds']:.1f}", flush=True)


if __name__ == "__main__":
    main()
