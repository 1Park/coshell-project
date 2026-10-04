아이디어 선정·탈락 기록 — 2026-10-04
==================================

후속 검토: [해커톤 아이디어 적대적 리뷰](../ADVERSARIAL_REVIEW.md)는 아래 통과 판정과 추천 논리를 출품 경쟁력 관점에서 재검토한다. 원래 선정 기록은 보존하며, 후속 리뷰의 반론과 재심사 기준은 별도 문서에 기록했다.

**기록의 성격**

사용자 기준은 너무 단순함, 너무 뻔함, 기존 공개 프로젝트/기업과 중복, 너무 넓은 범위의 네 가지였다. 아래에는 브레인스토밍에서 검토한 원안·수정안 40개를 기록한다. 독립 발명 40개라는 뜻은 아니며, 수정 전후가 따로 포함된다. 최종 채택은 10개이고 상세 설계는 [IDEAS.md](IDEAS.v1.md)에 있다.

웹 검색에서 찾지 못했다는 사실은 존재하지 않는다는 증거가 아니다. 다음 세 상태를 구분했다.

- **직접 중복:** 핵심 사용 흐름이 이미 공개됨. 해당 원안을 제외.
- **인접 선행:** 같은 기술/분야는 존재하나 제안하는 좁은 작업 흐름은 다름. 차이가 충분한지 별도 판단.
- **검색 근거 부족:** 결과가 관련 없는 페이지 위주임. 신규성 점수로 올리지 않고 미확인으로 둠.

실제 보드·센서·사용자 테스트는 수행하지 않았다. 구현성 평가는 문서와 시스템 설계에 근거한다. GitHub·앱 소개 페이지는 기능 설명의 공개 여부를 확인하는 자료이며 그 제품의 성능이나 완성도를 검증한 자료가 아니다.

**검토 절차**

1. 행사·보드·실행 프레임워크 확인. 사용자 인용문에서 실제 행사 페이지를 찾았고 ExecuTorch 사용을 핵심 설계 제약에 반영.
2. 생활·수리·접근성·산업·교육·놀이·개발 도구 후보 생성.
3. 제품 이름이 아니라 기능과 사용 행동을 표현한 검색어로 비교. Google Play/Devpost/GitHub뿐 아니라 연구·제조사 자료도 확인.
4. 물리적으로 관찰 가능한 정보, 확보 가능한 센서, 데이터 수집 시간, 기구 제작 시간을 다시 점검.
5. 직접 중복은 탈락. 범위가 큰 안은 재설계하되 핵심 재미·효용이 사라지면 탈락.
6. 마지막에는 각 채택안에 가장 가까운 사례, 구현 제외 범위, 측정할 목표, 초반 중단 조건을 추가.

**탈락 또는 재설계한 30개**

| ID | 원안 | 판단 근거 | 결과 |
|---|---|---|---|
| R01 | 카메라로 어떤 물건이든 고쳐주는 수리 도우미 | [FixMode](https://play.google.com/store/apps/details?hl=en&id=com.siafy.fixmode), [Gemini-Mechanic](https://devpost.com/software/gemini-mechanic) 등 핵심 흐름 중복. 범위도 큼 | 탈락 |
| R02 | 분해한 나사 출처와 트레이 위치를 기억해 재조립 | [ScrewTrail](https://play.google.com/store/apps/details?hl=en_IN&id=net.ifmain.screwtrail)이 출처–트레이 연결·역순 조립 대기열을 명시. 자동 센싱 추가만으로 충분히 새롭다고 보기 어려움 | 탈락 |
| R03 | 종이접기 실시간 AI 코치 | [CMU Origami Assistant](https://mscvprojects.ri.cmu.edu/f23team15/fall-2023-method-experiments/)가 카메라 상태 분류와 지시 투영을 구현 | 탈락 |
| R04 | 카메라로 빈 공간을 보고 완충재 양 최적화 | [Ranpak AutoFill](https://ir.ranpak.com/news/news-details/2021/Ranpak-Announces-North-American-Launch-of-AutoFill-a-Completely-Automated-Packaging-Solution/default.aspx) 및 비전 솔루션과 중복 | 원안 탈락; F06은 동적 지지 시험으로 재설계 |
| R05 | AI와 모터 사이 안전 방화벽 | [Invariant](https://github.com/clay-good/invariant), [TrustRobotics](https://www.trustrobotics.ai/tech/actuator-trust), [Safety Chip 연구](https://arxiv.org/abs/2309.09919)와 중복 | 탈락 |
| R06 | 주변 소리를 진동으로 바꿔주는 접근성 장치 | [Neosensory](https://neosensory.com/wp-content/uploads/2023/11/Neosensory-Sound-Awareness-User-Guide.pdf), [Sound Alert](https://www.soundalert.co/) 등 제품 존재. 오프라인만 추가해서는 차별화 부족 | 탈락 |
| R07 | 개인별로 헷갈리지 않는 진동 언어 자동 생성 | [VibViz](https://www.cs.ubc.ca/labs/spin/vibviz), [adaptive smart gloves](https://pmc.ncbi.nlm.nih.gov/articles/PMC10825181/) 등 개인화 연구가 가까움. 짧은 사용자 실험의 일반화도 어려움 | 탈락 |
| R08 | 듣고 목표 음색을 따라 연주하는 Foley 로봇 | [Timbral Learning](https://michaelkrzyzaniak.com/Research/Dissertation.pdf), [Audio Robot Learning](https://audio-robot-learning.github.io/)에서 목표 소리와 동작 학습이 이미 핵심 | 추가 검색 후 탈락 |
| R09 | 영화 촬영 소품의 연속성 검사 | [InteScene](https://www.intescene.com/for/script-supervisors), [continuity-ai](https://github.com/Zachiran42/continuity-ai)가 직접 다룸 | 탈락 |
| R10 | 배우 대사·소품을 보고 무대 큐 실행 | [Cue Killer](https://cue-killer.com/), [ShowRevue](https://www.showrevue.com/)와 가까움. 무대 장비 연동 범위도 커짐 | 탈락 |
| R11 | AI 체스/보드게임 심판과 undo | [FlexyBoard](https://course.ece.cmu.edu/~ece500/projects/s26-teame2/wp-content/uploads/sites/433/2026/05/Team_E2_Mohanraj_Hayward_Bernitsas_final_report.pdf) 등 물리 보드·카메라·undo 공개 사례 | 탈락 |
| R12 | AI가 스토리를 바꾸는 스마트 카드게임 | [MIT Pocket Ink](https://tangible.media.mit.edu/project/pocket-ink/)가 물리 카드와 AI 개인화·적응형 플레이를 다룸. 일반 플랫폼은 범위도 큼 | 탈락 |
| R13 | 천·의류의 불량 검사 카메라 | [Dowcloth](https://www.dowcloth.com/solutions/computer-vision-inspection) 등 기업의 직접 영역. 카메라 분류만으로 차별화 어려움 | 탈락 |
| R14 | 뜨개질 도안 생성·AI 질문·코수 카운터 | [Yarnie](https://play.google.com/store/apps/details?hl=en_US&id=com.ai.crochet.knitting.stitch), [StitchMind](https://stitchmindapp.com/) 등 공개 앱과 중복 | 원안 탈락; F03은 한 실의 실제 복구 이력으로 재설계 |
| R15 | 빌려준 공구 세트의 반납 검사 | [MangoApps 반납 검사](https://www.mangoapps.com/templates/inspections/loan-a-tool-return-condition-and-damage-inspection-2), [반납 장비 cobot 제안](https://www.servicerobotco.com/blog/cobots-for-sorting-returned-rental-equipment)과 핵심 흐름 가까움 | 탈락 |
| R16 | 기계 소리로 고장 진단하는 상자 | [HBK acoustic camera](https://www.hbkworld.com/en/solutions/applications/acoustics/noise-source-identification/noise-identification-acoustic-camera) 등 인접 제품이 강하고 원안이 너무 넓음 | 탈락 |
| R17 | 패널을 눌러보고 폼을 붙여 잡소리 해결하는 RattlePatch | [BSR 시험·예방 제품 설명](https://ifactoryapp.com/industries/automotive-manufacturing/automotive-squeak-rattle-bsr-testing-prevention-ai)과 기존 진단·재료 보강 절차에 가까움. 작은 상자로 바꾸는 것만으로는 부족 | 탈락 |
| R18 | 스마트 포장 상태를 운송 중 추적 | [TransPak](https://www.transpak.com/design/field-data-packaging-analytics/) 등의 충격·진동 데이터 분석과 직접 겹침 | 탈락 |
| R19 | 보이지 않는 상자 내용물을 흔들어 맞히기 | [Boombox](https://boombox.cs.columbia.edu/)와 [로봇 음향 지각](https://www.frontiersin.org/journals/neurorobotics/articles/10.3389/fnbot.2019.00096/full) 선행이 가까움 | 원안 탈락; F10은 기계적 규칙의 후속 결과 예측 게임 |
| R20 | 센서를 어디 붙일지 AI가 추천 | [센서 배치·선택·융합 연구](https://www.sciencedirect.com/science/article/pii/S0888327015003271), [Monitron 설치 안내](https://docs.aws.amazon.com/Monitron/latest/user-guide/as-where-sensors.html)와 가까움. 제품 차이가 충분히 강하지 않음 | 탈락 |
| R21 | 조명 바꿔 AI 비전 성능을 검사하는 일반 BenchFuzz | [Imatest 지그](https://www.imatest.com/products/test-lab-setup/), [metamorphic testing 연구](https://arxiv.org/html/2602.22579v2)와 범주가 겹침 | 원안 탈락; F01은 경량화 전후 물리적 회귀 재현으로 축소 |
| R22 | 접촉한 표면을 오염됐다고 표시 | [Deep Clean](https://github.com/nickbild/deepclean)과 직접 겹침. 실제 오염 여부는 감지 불가 | 원안 탈락; F04는 명시적인 모의 전파·복구 훈련 |
| R23 | 건축 자투리 목재를 분석해 새 가구 생성 | [off-cut wood 프레임워크](https://www.nature.com/articles/s44296-023-00002-8)와 인접. 재료 시험·하중 설계·제작을 이틀에 모두 검증하기 어려움 | 탈락 |
| R24 | 자동 미니 로봇팔이 모든 수리·분해 수행 | 학습 데이터·정밀 기구·미세 부품·고장 유형이 모두 열려 있음. 구현성 자체로 탈락; 개별 선행 검색 여부와 무관 | 탈락 |
| R25 | 발효 상태를 AI로 최적화하는 병뚜껑 | 긴 생물학적 시간과 실제 품질 라벨을 행사 중 검증하기 어려움. 빠른 대체 시연만으로 원래 가치 증명 불가 | 탈락 |
| R26 | 흔들리는 책상의 받침 위치를 AI가 추천 | 작은 지그는 가능하지만 중심 기능을 힘/변위 측정과 기하로 충분히 해결. 모델을 추가해도 아이디어가 깊어지지 않음 | 탈락 |
| R27 | 범용 주거 에너지·소음·쾌적함 통합 제어 | 사용자·장치·최적화 목표가 너무 많음. 특정 한 문제 없이 대시보드로 끝날 위험 | 탈락 |
| R28 | 개인 맞춤 제스처로 아무 기기나 조작 | 일반적 인터페이스 데모이고 기기별 제어 연동 범위가 열려 있음. 고유한 실패 장면이나 복구 행동 부족 | 탈락 |
| R29 | 케이블 연속성·단선·흔들림 검사 | [PinPath](https://github.com/rwrife/pinpath) 등 공개 구현. 전기적 케이블 테스트 자체는 차별성 없음 | 원안 탈락; F05는 비접촉 단자 대응 추정 |
| R30 | 모든 낙하·진동에서 배송 안전성을 보증하는 포장 AI | 이틀짜리 저진폭 지그로 인증·파손 확률을 추정할 수 없음. 강하게 눌러 고정하면 안전하다는 오해 발생 | 탈락; F06은 관측 가능한 상대 움직임만 측정 |

**채택한 수정안 10개와 마지막 반론**

| ID | 채택안 | 가장 강한 반론 | 최종 설계에서 남긴 경계 | 설계 검토 결과 |
|---|---|---|---|---|
| F01 | Quantization Cliff | 이미 모델 테스트 도구 아닌가 | 같은 실제 프레임에서 두 배포 산출물 비교, 액추에이터 조건 탐색·재현, 정답 라벨 대조. 범용 검사는 제외 | 통과; 자연 불일치 확보 필요 |
| F02 | Physical CI | 그냥 카메라로 구슬 보면 되지 않나 | 최초 실패 연결·중간 투입·부분 재시험·복구 확인까지 구현. 임의 기계 이해는 제외 | 통과 |
| F03 | SeamBack | 자수 카운터와 뭐가 다른가 | 실제 상태를 읽고 관측한 한 실의 undo를 검증. 복잡한 뒷면 얽힘은 제외 | 통과 |
| F04 | TouchDebt | 기존 접촉 감시의 새 이름 아닌가 | 재오염 경로와 정해진 다음 작업의 복구 순서를 소품으로 연습. 실제 감염 판단은 제외 | 통과; 접촉 센싱 필수 |
| F05 | TugMap | 케이블을 흔들면 다른 것도 움직인다 | 능동 코드 재시험·판별 불가·느슨한 구간으로 한정. 물리 신호가 없으면 포기 | 통과; 파일럿 우선 |
| F06 | PackProbe | 포장 기업이 이미 하지 않나 | 빈 공간 측정 대신 현재 포장의 방향별 지지 부족을 시험하고 한 번의 수정 효과를 재확인 | 통과; 산업 인접성 높음 |
| F07 | PatchMatch | 천 시험기에 카메라만 붙인 것 아닌가 | 낡은 원단과 가진 자투리 중 실제 수선 짝·방향 선택. 조각 간 호환성이 사용자 결과물 | 통과; 반복 하중 측정 필요 |
| F08 | ReGrip | 적응형 그리퍼는 이미 있지 않나 | 정규 부품이 없는 임시 손가락 교체 후 재교정·불가능한 재료 거부. 일반적인 잘 잡기 데모는 제외 | 통과; 그리퍼 확보 필요 |
| F09 | Shadow Bargain | 그림자 놀이에 AI를 얹은 것 아닌가 | 사람/AI 조작권 분리와 실제 그림자·무늬 구별을 게임 규칙에 연결. 대사 생성은 핵심 아님 | 통과; 광원·차광 지그 필요 |
| F10 | BlackBox Duel | 기존 능동 지각의 시연 아닌가 | 실험 예산·사람의 숨은 조건·미실행 행동 예측·실제 검증의 대결 규칙. 물체 이름 분류는 제외 | 통과; 식별 가능한 실험 설계 필요 |

여기서 통과란 사용자 기준에 맞춰 더 구체적으로 개발할 가치가 있다는 설계 판단이다. 실제 수요·신규성·성능을 확정했다는 뜻은 아니다. 특히 F05/F07/F08은 첫 물리 실험을 통과하기 전에는 출품안으로 확정하지 않는 편이 낫다.

**재검토하면서 고친 기술 가정**

- 초기에는 일반 48시간 해커톤을 가정했다. 행사 페이지는 이틀을 안내하지만 실제 연속 개발 시간은 알 수 없어 총 48–60 인시의 작업 가정으로 분리했다.
- ‘40 TOPS니까 큰 VLM을 바로 실행’하는 전제를 제거했다. 작은 모델 CPU 실행을 기본으로 두고 QNN/NPU는 독립 확인으로 뺐다.
- 센서 부족을 AI로 메우는 설계를 제거했다. 가려진 접촉, 케이블의 전혀 전달되지 않는 움직임, 천 클램프의 미끄러짐은 모델 자신감으로 해결할 수 없다.
- 힘과 위치를 분리했다. 서보 PWM/각도는 힘이 아니므로 힘 관련 주장은 로드셀 등 실측이 있는 경우로 제한했다.
- 프로토타입의 결과와 최종 제품의 결과를 분리했다. 포장 변위 감소는 배송 안전 증명이 아니며, 그리퍼 한 번 성공은 재료 수명 보장이 아니다.
- LLM은 핵심 경로에서 모두 제거했다. 필요하다면 상태 설명의 표현을 부드럽게 만드는 보조 수단이지만 센싱·판정·액추에이터 명령의 근거를 대신하지 않는다.
- 학습 프레임의 양보다 독립적인 촬영·실험 세션을 중시했다. 정확도 목표는 미달성 수치로 표시했다.
- 카메라·서보·힘 센서 등은 행사 제공 목록에 포함됐다고 가정하지 않았다. 필요한 경우 직접 조달하는 가정이다.

**검색 기록 읽는 법**

[research/search-audit.json](../research/search-audit.json)은 기록한 62개 검색/열람 묶음과 도구가 반환한 페이지 목록이다. 요청 하나에 여러 검색어·열람이 포함된 경우가 있다. 초기 행사/보드 확인의 일부 호출은 이 JSON에 없고 IDEAS.md의 직접 링크로 남겼다.

검색에 노출된 모든 페이지를 정독하거나 채택한 것은 아니다. 관련 없는 결과도 재현성을 위해 목록에는 포함되며, 이 문서와 IDEAS.md에서 명시적으로 연결한 출처만 판단 근거로 사용했다. 검색 결과의 인용문·본문 전체는 파일에 복제하지 않았다.

검색은 영어 중심이며 한국어를 포함한 전 세계 제품·미공개 프로젝트·특허를 망라하지 않는다. 특허 신규성 조사나 사업 실사에 해당하지 않는다. 명칭은 이번 브레인스토밍용 작업명이며 상표·도메인 가용성은 확인하지 않았다.

최종 추가 반증 검색: `robot improvised replacement gripper fingers self calibration repair materials`, `fabric repair patch mechanical compatibility stretch matching instrument`, `physical differential testing quantized neural networks camera illumination`. 이 호출들은 62개 묶음 이후에 수행했으며 JSON에는 포함되지 않았다. 그 결과 [MUXI의 교체 그리퍼 사업](https://tech.muxiprecision.com/robot-gripper-finger-solution)과 [양자화 모델 검증·수리 학위논문](https://ssvlab.github.io/lucasccordeiro/supervisions/phd_thesis_xidan.pdf)을 추가 확인했다. F08에서 교체 자체를 신규성으로 삼지 않고, F01에서 양자화 모델의 차이 검사 자체를 신규성으로 삼지 않는 경계를 재확인했다.

후속 검색 `QNNRepair testing quantized neural networks differential repair original paper`로 [QNNRepair 원 논문](https://arxiv.org/abs/2306.13793)도 확인하고 F01 비교 항목에 반영했다.
