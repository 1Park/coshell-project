"""Render the persistent candidate ledger. JSON remains the authoritative record."""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'IDEA_REGISTRY.json').read_text())
counts = Counter(item['status'] for item in data['items'])
data['valid_count'] = counts['VALID']
(ROOT / 'IDEA_REGISTRY.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def cell(value):
    if isinstance(value, list):
        value = ', '.join(value)
    return str(value or '—').replace('|', '/').replace('\n', ' ')

lines = [
    '# 모든 아이디어 누적 목록', '',
    '기준: [VALIDITY_CHECKLIST.md](VALIDITY_CHECKLIST.md). 원본 데이터: [IDEA_REGISTRY.json](IDEA_REGISTRY.json).', '',
    f"총 등록 {len(data['items'])}개 버전/스케치. 현재 유효 **{counts['VALID']}/10**.", '',
    '같은 주제의 수정 버전과 초기 탈락 스케치도 포함한다. 독립 발명의 개수가 아니다. 기존 정식 검토 43개와 v2 대안 스케치 5개부터 보존했다.', '',
    '상태별: ' + ', '.join(f'{k} {v}' for k, v in sorted(counts.items())), '',
    '| ID | 후보 | 상태 | 가장 가까운 기존 ID / 중복 검사 | 판단 또는 다음 조사 |',
    '|---|---|---|---|---|',
]
for item in data['items']:
    lines.append('| ' + ' | '.join(cell(item.get(k)) for k in ['id','name','status','duplicate_check','reason']) + ' |')
lines += ['', 'VALID는 체크리스트에 따른 설계 검토 상태다. 실제 하드웨어 실측 완료와 구분한다. OPEN은 유효 개수에 포함하지 않는다.', '']
(ROOT / 'IDEA_REGISTRY.md').write_text('\n'.join(lines))
print(f"Registry: {len(data['items'])} entries; VALID {counts['VALID']}/10")
