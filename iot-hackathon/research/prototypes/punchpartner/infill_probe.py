"""Independent small score-infilling probe; no third-party model code/weights.

This tests symbolic completion, not music quality, punching, or VENTUNO speed.
Run with the private environment noted in README.md.
"""
import copy
import hashlib
import json
import math
import re
import time
from collections import Counter
from pathlib import Path

import numpy as np
import torch
from torch import nn
from music21 import corpus, key, note

ROOT = Path(__file__).resolve().parent
PITCHES = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84]
LOOKUP = {p: i + 1 for i, p in enumerate(PITCHES)}
VOCAB, MASK, LENGTH = 16, 16, 32


def corpus_windows():
    cache = ROOT / 'corpus_cache.json'
    if cache.exists():
        return json.loads(cache.read_text())
    rows, counts = [], Counter()
    for path in corpus.getComposer('bach'):
        counts['files_seen'] += 1
        try:
            score = corpus.parse(path)
            signature = score.recurse().getElementsByClass(key.Key).first()
            if signature is None or signature.mode != 'major' or not score.parts:
                counts['nonmajor_or_no_key_parts'] += 1
                continue
            shift = -int(signature.tonic.pitchClass)
            events = []
            valid = True
            for n in score.parts[0].flatten().notes:
                if not isinstance(n, note.Note):
                    valid = False
                    break
                if n.tie is not None and n.tie.type in ('continue', 'stop'):
                    continue
                tick = float(n.offset) * 2
                if abs(tick - round(tick)) > 1e-5:
                    valid = False
                    break
                events.append((round(tick), int(n.pitch.midi) + shift))
            if not valid or not events:
                counts['nonmonophonic_or_off_grid'] += 1
                continue
            median = np.median([p for _, p in events])
            octave = 12 * round((72 - median) / 12)
            sequence = [0] * (events[-1][0] + 1)
            for t, pitch in events:
                sequence[t] = LOOKUP.get(pitch + octave, -1)
            # Group alternative editions of the same BWV movement together.
            name = Path(path).stem.lower()
            match = re.search(r'bwv\d+[a-z]?(?:\.\d+)?', name)
            group = match.group() if match else name
            partition = int(hashlib.sha256(group.encode()).hexdigest()[:8], 16) % 10
            split = 'test' if partition == 0 else 'val' if partition == 1 else 'train'
            added = 0
            for start in range(0, len(sequence) - LENGTH + 1, 16):
                window = sequence[start:start + LENGTH]
                if min(window) < 0 or sum(v > 0 for v in window) < 6:
                    continue
                rows.append({'piece': group, 'source': name, 'split': split, 'start': start, 'tokens': window})
                added += 1
            counts['files_with_windows' if added else 'files_without_windows'] += 1
        except Exception as exc:
            counts['parse_errors'] += 1
            print('parse error', Path(path).name, type(exc).__name__, flush=True)
        if counts['files_seen'] % 50 == 0:
            print('parsed', counts['files_seen'], 'windows', len(rows), flush=True)
    # Alternative editions can duplicate windows within a partition; keep one.
    unique = {(r['piece'], tuple(r['tokens'])): r for r in rows}
    data = {'preprocessing_counts': dict(counts), 'rows': list(unique.values())}
    cache.write_text(json.dumps(data, indent=2) + '\n')
    return data


class Infill(nn.Module):
    def __init__(self):
        super().__init__()
        self.embedding = nn.Embedding(VOCAB + 1, 64)
        self.position = nn.Parameter(torch.randn(1, LENGTH, 64) * .02)
        layer = nn.TransformerEncoderLayer(64, 4, 128, dropout=.1, batch_first=True, activation='gelu')
        self.encoder = nn.TransformerEncoder(layer, 2, enable_nested_tensor=False)
        self.head = nn.Linear(64, VOCAB)

    def forward(self, tokens):
        return self.head(self.encoder(self.embedding(tokens) + self.position))


def group_shared_windows(data):
    # Different BWV identifiers can share a chorale tune. Put all exact-window
    # connected components together, not merely the same file/edition.
    pieces = sorted({row['piece'] for row in data['rows']})
    parent = {piece: piece for piece in pieces}

    def root(piece):
        while parent[piece] != piece:
            parent[piece] = parent[parent[piece]]
            piece = parent[piece]
        return piece

    owner = {}
    for row in data['rows']:
        tokens = tuple(row['tokens'])
        if tokens in owner:
            a, b = root(row['piece']), root(owner[tokens])
            parent[max(a, b)] = min(a, b)
        else:
            owner[tokens] = row['piece']
    components = {}
    for piece in pieces:
        components.setdefault(root(piece), []).append(piece)
    rows = []
    for original in data['rows']:
        row = dict(original)
        component = components[root(row['piece'])]
        group = '|'.join(component)
        partition = int(hashlib.sha256(group.encode()).hexdigest()[:8], 16) % 10
        row['split'] = 'test' if partition == 0 else 'val' if partition == 1 else 'train'
        row['shared_window_group'] = group
        rows.append(row)
    # Remove duplicate token windows even within a shared tune component.
    rows = list({(r['shared_window_group'], tuple(r['tokens'])): r for r in rows}.values())
    result = {'preprocessing_counts': data['preprocessing_counts'],
              'component_count': len(components), 'rows': rows}
    (ROOT / 'corpus_grouped.json').write_text(json.dumps(result, indent=2) + '\n')
    return result


def masked(tokens, generator):
    # Only actual holes are observable constraints; blank cells aren't fixed rests.
    visible = (tokens > 0) & (torch.rand(tokens.shape, generator=generator) < .35)
    return tokens.masked_fill(~visible, MASK), ~visible


def markov_fit(train):
    counts = np.full((8, VOCAB, VOCAB, VOCAB), .05)
    for row in train.tolist():
        for t in range(2, LENGTH):
            counts[t % 8, row[t - 2], row[t - 1], row[t]] += 1
    return counts / counts.sum(axis=-1, keepdims=True)


def markov_marginals(visible, transition):
    # Exact forward/backward bridge with order-2 transitions and beat phase.
    batch = len(visible)
    emission = np.ones((batch, LENGTH, VOCAB))
    for b in range(batch):
        for t in range(LENGTH):
            if visible[b, t] != MASK:
                emission[b, t] = 0
                emission[b, t, visible[b, t]] = 1
    alphas = []
    alpha = np.ones((batch, VOCAB, VOCAB)) / VOCAB**2
    for t in range(LENGTH):
        alpha = np.einsum('nab,abc->nbc', alpha, transition[t % 8]) * emission[:, t, None, :]
        alpha /= alpha.sum(axis=(1, 2), keepdims=True)
        alphas.append(alpha.copy())
    beta = np.ones_like(alpha)
    result = np.zeros((batch, LENGTH, VOCAB))
    for t in range(LENGTH - 1, -1, -1):
        joint = alphas[t] * beta
        result[:, t] = joint.sum(axis=1)
        result[:, t] /= result[:, t].sum(axis=1, keepdims=True)
        beta = np.einsum('abc,nc,nbc->nab', transition[t % 8], emission[:, t], beta)
        beta /= np.maximum(beta.sum(axis=(1, 2), keepdims=True), 1e-30)
    return result


def metrics(probs, truth, mask):
    pred = probs.argmax(-1)
    nll = -np.log(np.maximum(np.take_along_axis(probs, truth[..., None], -1)[..., 0], 1e-12))
    onset = mask & (truth > 0)
    return {'masked_nll': float(nll[mask].mean()),
            'masked_accuracy': float((pred[mask] == truth[mask]).mean()),
            'masked_onset_pitch_accuracy': float((pred[onset] == truth[onset]).mean()),
            'masked_cells': int(mask.sum()), 'masked_true_onsets': int(onset.sum())}


def main():
    started = time.time()
    torch.set_num_threads(4)
    torch.manual_seed(86)
    np.random.seed(86)
    data = group_shared_windows(corpus_windows())
    sets = {name: torch.tensor([r['tokens'] for r in data['rows'] if r['split'] == name]) for name in ('train', 'val', 'test')}
    print('windows', {k: len(v) for k, v in sets.items()}, flush=True)
    generator = torch.Generator().manual_seed(860)
    fixed = {name: masked(sets[name], generator) for name in ('val', 'test')}
    device = torch.device('mps' if torch.backends.mps.is_available() else 'cpu')
    model = Infill().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=.001, weight_decay=.01)
    best, best_loss = None, math.inf
    log = []
    for epoch in range(40):
        model.train()
        order = torch.randperm(len(sets['train']), generator=generator)
        for ids in order.split(64):
            target = sets['train'][ids]
            inputs, selection = masked(target, generator)
            logits = model(inputs.to(device))
            loss = nn.functional.cross_entropy(logits[selection.to(device)], target.to(device)[selection.to(device)])
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1)
            optimizer.step()
        model.eval()
        with torch.no_grad():
            val_inputs, val_mask = fixed['val']
            logits = torch.cat([model(x.to(device)).cpu() for x in val_inputs.split(128)])
            val_loss = nn.functional.cross_entropy(logits[val_mask], sets['val'][val_mask]).item()
        log.append({'epoch': epoch + 1, 'validation_masked_nll': val_loss})
        if val_loss < best_loss:
            best_loss, best = val_loss, copy.deepcopy({k: v.cpu() for k, v in model.state_dict().items()})
        if (epoch + 1) % 5 == 0:
            print('epoch', epoch + 1, 'val nll', round(val_loss, 4), flush=True)
    model = Infill().eval()
    model.load_state_dict(best)
    torch.save(best, ROOT / 'infill_model.pt')
    with torch.no_grad():
        test_inputs, test_mask = fixed['test']
        probs = torch.cat([model(x).softmax(-1) for x in test_inputs.split(128)]).numpy()
    transition = markov_fit(sets['train'])
    markov_probs = markov_marginals(test_inputs.numpy(), transition)
    truth, selection = sets['test'].numpy(), test_mask.numpy()
    # A small deterministic constrained addition trace, not a quality benchmark.
    seed = test_inputs[0].clone()
    trace = []
    for turn in range(3):
        with torch.no_grad():
            logits = model(seed[None])[0].numpy()
        candidates = []
        for t in range(LENGTH):
            if seed[t] != MASK:
                continue
            scores = logits[t].copy()
            scores[0] = -np.inf
            for neighbor in (t - 1, t + 1):
                if 0 <= neighbor < LENGTH and seed[neighbor] != MASK:
                    scores[int(seed[neighbor])] = -np.inf
            pitch = int(scores.argmax())
            candidates.append((float(scores[pitch] - logits[t, 0]), t, pitch))
        additions = []
        for _, t, pitch in sorted(candidates, reverse=True):
            if any(0 <= n < LENGTH and int(seed[n]) == pitch for n in (t - 1, t + 1)):
                continue
            seed[t] = pitch
            additions.append({'column': t, 'midi': PITCHES[pitch - 1]})
            if len(additions) == 4:
                break
        trace.append({'turn': turn + 1, 'additions': additions, 'tokens': seed.tolist()})
    original = test_inputs[0]
    preservation = bool(torch.equal(seed[original != MASK], original[original != MASK]))
    # Export only; this isn't an ExecuTorch runtime or board measurement.
    export_status = 'not_attempted'
    try:
        torch.backends.mha.set_fastpath_enabled(False)
        exported = torch.export.export(model, (test_inputs[:1],))
        torch.export.save(exported, ROOT / 'infill_model.pt2')
        export_status = 'torch_export_succeeded_not_executorch'
    except Exception as exc:
        export_status = f'{type(exc).__name__}: {exc}'[:500]
    report = {
        'scope': 'Offline symbolic infilling only; no physical punch, listening study, or VENTUNO/ExecuTorch runtime test.',
        'torch_version': torch.__version__, 'training_device': str(device), 'seed': 86,
        'preprocessing_counts': data['preprocessing_counts'],
        'windows_by_partition': {k: len(v) for k, v in sets.items()},
        'pieces_by_partition': {k: sorted({r['piece'] for r in data['rows'] if r['split'] == k}) for k in sets},
        'shared_window_components': data['component_count'],
        'params': sum(p.numel() for p in model.parameters()), 'epochs': 40,
        'validation_log': log, 'best_validation_nll': best_loss,
        'transformer': metrics(probs, truth, selection),
        'order2_phase_markov_bridge': metrics(markov_probs, truth, selection),
        'trace_initial_tokens': original.tolist(), 'trace': trace,
        'original_holes_preserved': preservation, 'export_status': export_status,
        'wall_seconds': time.time() - started,
        'limits': ['Historical score infilling is not preference, musical quality, or co-creation value.',
                   'Music21 supplies 433 Bach corpus files; filtered windows are not 433 independent compositions.',
                   'Only major-key monophonic eighth-grid diatonic windows; chromatic windows omitted, not rounded.',
                   'Physical music-box range and minimum repeat distance must be calibrated on actual kit.',
                   'Export to Torch IR is not ExecuTorch execution or NPU acceleration.']}
    (ROOT / 'infill_report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k not in ('pieces_by_partition', 'validation_log', 'trace')}, indent=2), flush=True)


if __name__ == '__main__':
    main()
