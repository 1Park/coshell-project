# v2 추가 조사 근거

확인일: 2026-10-04. 문헌·제품 소개의 공개 내용 확인이며 성능 재현 실험은 하지 않았다. 아래 ‘설계 판단’은 출처의 주장이 아니라 이번 검토의 추론이다.

| 1차 출처 | 확인한 내용 | 설계 판단에 사용한 부분 |
|---|---|---|
| [Arduino VENTUNO Q 공식 문서](https://docs.arduino.cc/hardware/ventuno-q) | Linux MPU, STM32 MCU, USB·센서 연결 구조 | 로컬 영상 처리와 MCU 입출력 분리. 특정 모델 속도·NPU 호환성은 별도 확인 |
| [Pattern Keeper](https://patternkeeper.app/) | 도안 탐색·표시·진행 관리 | 자수 진행 관리 자체는 기존 제품. 실물과 도안의 불일치를 맞추는 사용자 흐름으로 좁힘 |
| [Knyt progress tracker](https://www.knytstudio.com/progress-tracker) | 디지털 도안의 진행 추적 | 수동 기록 방식이 강한 제품 비교군. 기록 누락 사용자에게 효용이 있는지는 실험 필요 |
| [addaScan: Machine vision commissioning procedure](https://addascan.co.za/resources/vision-commissioning-procedure/) | 실물 샘플, 카메라·조명 설정, 설치 후 검증과 기록을 포함하는 절차 | Live Acceptance의 발상 자체는 신규하지 않음. 수동 실물 검사와 단순 품질 검사까지 비교해야 함 |
| [TactileReflex — 저자 프로젝트](https://shayfeng.github.io/TactileReflex/) | 파손되기 쉬운 용기의 미끄러짐·힘 변화·과도한 힘에 대응하는 보정 기반 시촉각 제어 | ReGrip을 파손 전 제어로 바꿔도 근접 선행 사례가 있음 |
| [FORTE — 저자 프로젝트](https://merge-lab.github.io/FORTE/) | 유연한 손가락의 힘·미끄러짐 센싱을 통한 섬세한 조작 | 소재 교체와 힘/미끄러짐 제어만으로 독창성 인정 곤란 |
| [Biagiotti et al., Optimal Feed-Forward Control for Robotic Transportation of Solid and Liquid Materials via Nonprehensile Grasp](https://arxiv.org/abs/2306.14212) | 비파지 방식으로 고체·액체를 운반하기 위한 운동 제어 | PackProbe를 운반 제어로 바꾸면 사용자 결과는 직접적이지만 기존 연구와 중복 |

## 검색과 해석의 한계

- `cross stitch computer vision progress`, `cross stitch resume progress camera` 계열 검색은 실제 수공예와 무관한 Cross-Stitch Networks 논문도 반환했다. 무관한 검색 결과를 ‘경쟁 제품 없음’으로 계산하지 않았다.
- `machine vision camera remount commissioning regression test` 계열에서는 산업 비전 설치·재설치 검증이 이미 존재함을 확인했다. 모바일·저가·오프라인이라는 형용사만으로 차별성을 인정하지 않는다.
- `robot tray transport slip acceleration control`, `adaptive grip slip crush calibration` 계열에서 가까운 연구를 확인해 두 수정안을 추천에서 제외했다.
- 기업·저자 페이지의 성능 수치는 직접 검증하지 않았다. 이 문서에서는 그 수치를 우리 시스템의 가능 성능으로 전용하지 않는다.
- ResetCheck, 형광 잔류물 관찰, 실제 수선 평가의 대안은 설계 단계에서 보류했다. 이들에 대한 포괄적 선행 조사나 신규성 확인을 마쳤다고 주장하지 않는다.
- 이전 조사 기록은 [search-audit.json](search-audit.json), 당시 선정 과정은 [v1 기록](../archive/REVIEW_LOG.v1.md)에 있다. 이번에 열람한 핵심 출처와 판단은 위 표에 따로 남겼다.
