# StillPaper 오프라인 예측 검사

**증거 수준: 공개 기록을 이용한 좌표 신호 예측. 실제 종이 구동, 사용자 의도 구별, 필기 개선, 의료 효과를 검증하지 않았다.**

## 자료와 재현

자료: Isenkul, M., Sakar, B., & PhD., P. (2013). *Parkinson Disease Spiral Drawings Using Digitized Graphics Tablet*. UCI Machine Learning Repository. [DOI와 데이터 안내](https://doi.org/10.24432/C5Q01S). 라이선스: **CC BY 4.0**.

[공식 ZIP](https://archive.ics.uci.edu/static/public/395/parkinson%2Bdisease%2Bspiral%2Bdrawings%2Busing%2Bdigitized%2Bgraphics%2Btablet.zip)의 SHA-256은 `4181243d64c29382a0035a9bca3ebcf446079b65c70a0b343fe7975372dc92e6`이며 3,641,631바이트다. 이 실행에서는 `/tmp/iot-stillpaper-data`에 풀었다. 원본 데이터는 이 저장소에 복사하지 않았다. 실험용 환경은 `/tmp/iot-stillpaper-venv`, Python 3.14.3, PyTorch 2.14.1, NumPy 2.5.3이며 SciPy를 사용했다.

`hw_dataset`의 40개 파일만 사용했다. 전체 안내의 77명을 모두 평가했다고 하지 않는다. `new_dataset`과의 개인 중복 여부가 확인되지 않아 섞지 않았다. 파일의 Test ID 0, 펜 접촉이 유지되고 타임스탬프가 증가하는 구간을 사용했다. 파일 이름을 분리 단위로 삼았으며 실제 개인 연결 정보를 독립적으로 검증한 것은 아니다.

첫 실행과 동일한 자료 출처 JSON을 `/tmp/iot-stillpaper-data-source.json`에 두고 다음을 실행한다. 출처 JSON은 각 결과의 `source` 필드에 그대로 보존되어 있다.

```sh
/tmp/iot-stillpaper-venv/bin/python research/prototypes/stillpaper/forecast_probe.py --fold 0
/tmp/iot-stillpaper-venv/bin/python research/prototypes/stillpaper/forecast_probe.py --fold 1
/tmp/iot-stillpaper-venv/bin/python research/prototypes/stillpaper/forecast_probe.py --fold 2
/tmp/iot-stillpaper-venv/bin/python research/prototypes/stillpaper/forecast_probe.py --fold 3
/tmp/iot-stillpaper-venv/bin/python research/prototypes/stillpaper/forecast_probe.py --fold 4
```

각 분할에서 학습/검증/평가 파일은 24/8/8개이며, 5회 동안 각 파일이 평가에 한 번씩 쓰인다. 첫 분할을 본 뒤 분할 민감도를 확인하기 위해 나머지 네 번을 추가했다. 네트워크 구조, 필터, 예측 시간은 그 사이 바꾸지 않았다. 가중치 파일은 직접 학습한 작은 MLP를 보존한 것이며 ExecuTorch 변환/보드 실행은 하지 않았다.

## 실시간 입력 누출 방지와 한계

100Hz로 다시 샘플링할 때 미래의 두 번째 점으로 보간하지 않고 가장 최근 과거 값을 유지했다. 3Hz 2차 고역 통과 필터도 인과적으로 적용했다. 시작 2초는 제외했다. 입력 1초를 사용해 40ms 뒤의 필터 출력을 예측한다. 정규화도 해당 입력 구간의 RMS만 쓴다.

예측 목표인 고역 통과 좌표는 실제 불수의 운동의 정답이 아니다. 필터 위상과 빠른 자발적 획이 포함될 수 있다. 따라서 수치가 좋아져도 필기의 흔들림이 같은 비율로 줄어든다는 뜻이 아니다. 코드의 `no_compensation`은 예측값을 0으로 둔 대조군 이름이며 실제 물리 무보상 실험이 아니다.

## 결과

[전체 5회 결과 요약](cross_validation_summary.json)의 기록별 정규화 RMSE 평균:

| 예측 방법 | 평균 RMSE |
|---|---:|
| 0 예측 | 0.6696 |
| 지연 신호 복사 | 0.6778 |
| 일정 속도 외삽 | 2.1665 |
| 선형 ridge AR | 0.5805 |
| 지역 주파수 적응 조화 모델 | 0.7837 |
| 8,577개 매개변수 MLP | 0.5680 |

신경망은 40개 기록 중 29개에서 선형 AR보다 오차가 낮았다. 평균 RMSE 감소는 약 **2.16%**, 기록별 상대 감소의 중앙값은 약 **0.78%**다. 손목/펜/카메라 센서로의 전이, 실제 접촉 마찰과 제어 지연, 자발적 획 보존은 평가하지 않았다. 이 결과만으로 큰 AI 이득이나 실제 사용자 효능을 주장하지 않는다.

별도로 이상적인 정현파에서 지연만 있을 때의 잔여 진폭 비 `2 |sin(π f τ)|`도 계산했다. 8Hz에서 30ms 늦게 같은 진폭으로 보상하면 비율이 약 1.37이다. 지연 보상이 중요하다는 수학적 예이며 실제 스테이지의 측정값이 아니다.
