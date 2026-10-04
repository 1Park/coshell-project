"""Inspect and export AFx-Rep locally; not a test of physical pedal matching."""
import argparse
import hashlib
import json
import platform
import time
from importlib.metadata import version
from pathlib import Path

import torch
from executorch.backends.xnnpack.partition.xnnpack_partitioner import XnnpackPartitioner
from executorch.exir import to_edge_transform_and_lower
from executorch.runtime import Runtime

from vendor.panns import Cnn14

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--state', type=Path, default=Path('/tmp/iot-knobseeker/encoder_state.pt'))
    parser.add_argument('--output', type=Path, default=Path('/tmp/iot-knobseeker/afx_encoder.pte'))
    args = parser.parse_args()
    torch.set_num_threads(4)
    model = Cnn14(512, 48000, 2048, 1024, 128, 20, 20000, True, 'minmax').eval()
    model.load_state_dict(torch.load(args.state, map_location='cpu', weights_only=True))
    # A fixed plucked-harmonic signal checks input/output/export, not real guitar timbre.
    t = torch.arange(144000, dtype=torch.float32) / 48000
    x = sum(torch.sin(2 * torch.pi * 110 * k * t) / k**1.7 for k in range(1, 12))
    x *= torch.exp(-2 * (t % .5))
    x = (x / x.abs().max()).reshape(1, 1, -1)
    with torch.no_grad():
        started = time.perf_counter()
        reference = tuple(y.clone() for y in model(x))
        forward_s = time.perf_counter() - started
    report = {'scope': 'Host model and runtime path; no physical pedal, target-tone, or listening test.',
              'platform': platform.platform(), 'python': platform.python_version(),
              'torch': torch.__version__, 'executorch': version('executorch'),
              'parameters': sum(p.numel() for p in model.parameters()),
              'encoder_state_bytes': args.state.stat().st_size,
              'input_shape': list(x.shape), 'outputs': [list(y.shape) for y in reference],
              'finite_outputs': all(torch.isfinite(y).all().item() for y in reference),
              'first_host_forward_seconds': forward_s}
    try:
        exported = torch.export.export(model, (x,))
        lowered = to_edge_transform_and_lower(exported, partitioner=[XnnpackPartitioner()]).to_executorch()
        args.output.write_bytes(lowered.buffer)
        method = Runtime.get().load_program(str(args.output)).load_method('forward')
        with torch.no_grad():
            result = tuple(y.clone() for y in method.execute([x]))
        report.update({'status': 'export_and_host_runtime_succeeded',
                       'pte_bytes': args.output.stat().st_size,
                       'pte_sha256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
                       'max_abs_errors': [float((a-b).abs().max()) for a,b in zip(reference,result)],
                       'allclose': [torch.allclose(a,b,rtol=1e-3,atol=1e-4) for a,b in zip(reference,result)],
                       'delegates': [d.id for d in lowered.executorch_program.execution_plan[0].delegates]})
    except Exception as error:
        report.update({'status': 'host_model_only_export_failed',
                       'error': f'{type(error).__name__}: {error}'[:2000]})
    (ROOT/'encoder_report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__ == '__main__':
    main()
