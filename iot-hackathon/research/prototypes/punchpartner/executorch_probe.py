"""Export the independently trained model and compare local CPU runtimes."""
import json
import platform
import time
from importlib.metadata import version
from pathlib import Path

import torch
from executorch.backends.xnnpack.partition.xnnpack_partitioner import XnnpackPartitioner
from executorch.exir import to_edge_transform_and_lower
from executorch.runtime import Runtime

from infill_probe import Infill, masked

ROOT = Path(__file__).resolve().parent
torch.set_num_threads(4)
torch.backends.mha.set_fastpath_enabled(False)
model = Infill().eval()
model.load_state_dict(torch.load(ROOT / 'infill_model.pt', map_location='cpu', weights_only=True))
data = json.loads((ROOT / 'corpus_grouped.json').read_text())
test = torch.tensor([row['tokens'] for row in data['rows'] if row['split'] == 'test'])
inputs, _ = masked(test, torch.Generator().manual_seed(8686))
exported = torch.export.export(model, (inputs[:1],))
program = to_edge_transform_and_lower(exported, partitioner=[XnnpackPartitioner()]).to_executorch()
path = ROOT / 'infill_model.pte'
path.write_bytes(program.buffer)
runtime = Runtime.get().load_program(str(path)).load_method('forward')
errors, elapsed = [], []
with torch.no_grad():
    for x in inputs:
        x = x.unsqueeze(0).contiguous()
        reference = model(x)
        start = time.perf_counter()
        actual = runtime.execute([x])[0].clone()
        elapsed.append(1000 * (time.perf_counter() - start))
        errors.append(float((reference - actual).abs().max()))
        assert torch.allclose(reference, actual, rtol=1e-3, atol=1e-4)
report = {
    'scope': 'Actual local macOS CPU ExecuTorch/XNNPACK export and inference, not VENTUNO or NPU.',
    'python': platform.python_version(), 'platform': platform.platform(),
    'torch': torch.__version__, 'executorch': version('executorch'),
    'model_bytes': path.stat().st_size, 'input_shape': list(inputs[:1].shape),
    'output_shape': list(actual.shape), 'cases': len(inputs),
    'max_abs_logit_error': max(errors), 'allclose_rtol': 1e-3, 'allclose_atol': 1e-4,
    'local_call_median_ms': sorted(elapsed)[len(elapsed) // 2],
    'delegates': [delegate.id for delegate in program.executorch_program.execution_plan[0].delegates],
    'limits': ['Host CPU parity does not validate embedded wiring, punching, or music quality.',
               'Timing includes Python execute and output clone; no controlled benchmark or board speed claim.']}
(ROOT / 'executorch_report.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
