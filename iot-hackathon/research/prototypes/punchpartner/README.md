# PunchPartner: 악보 빈칸 생성 경로 검사

실제 실행한 오프라인 프로토타입이다. 천공·오르골 재생·사용자 청취·VENTUNO·ExecuTorch 런타임을 시험한 것은 아니다.

```sh
/tmp/iot-stillpaper-venv/bin/python -m pip install music21
/tmp/iot-stillpaper-venv/bin/python research/prototypes/punchpartner/infill_probe.py
```

기존 격리 환경에 music21 10.5.0을 추가했다. 시스템 Python은 변경하지 않았다. Python 3.14.3, PyTorch 2.14.1, Apple MPS에서 학습했으며 추론과 Torch export는 CPU에서 수행했다. 기존 Anticipation-RNN의 코드나 가중치는 복사하지 않았다.

## 입력과 범위

[music21의 Bach 코퍼스](https://music21.org/music21docs/about/referenceCorpus.html)를 읽었다. 소프트웨어는 [프로젝트 라이선스](https://github.com/cuthbertLab/music21/blob/master/LICENSE)를 참조하며 Bach 작품과 코퍼스 인코딩의 출처를 구별한다. 전체 원본 악보를 별도 배포하지 않고 전처리한 짧은 토큰 창과 출처 식별자를 보존했다.

433개 파일 중 장조이고 단선율이 8분음표 격자에 놓이는 소프라노 성부만 사용했다. C장조로 옮긴 뒤 15개 온음계 음역에 들어오지 않는 창은 제외했다. 반음계 음을 임의로 가까운 음으로 바꾸지 않았다. 지속음의 tie continuation은 새 타격으로 만들지 않았다.

32칸 창, 16칸 보폭이다. 158개 파일에서 창이 남았고 최초에는 157개 악장 식별자로 분할했다. 사후 검사에서 **다른 BWV 번호 사이에 동일한 토큰 창이 있어 학습/검증 14개, 학습/평가 7개가 겹쳤다.** 최초 결과·가중치·로그는 `.initial` 파일로 보존했으며 최종 결과로 사용하지 않는다.

정확히 같은 창을 공유하는 모든 악장을 연결 성분으로 합친 뒤 성분 단위로 다시 분할하고, 모델 구조·학습 횟수·마스킹 비율을 바꾸지 않고 다시 학습했다. 총 127개 연결 성분이며 학습/검증/평가는 406/68/52개 창이다. 최종 창의 악장 식별자는 111/19/17개다. 정확한 토큰 창의 분할 간 중복은 0개로 확인했다. 이 검사를 음악적 변형·공유 코랄 원형까지 완전히 분리한 증거로 확대하지 않는다.

보이는 입력은 실제 음의 35%다. 나머지 칸은 MASK이며 빈 종이 칸을 고정 쉼표로 간주하지 않는다. 71,120개 매개변수의 2층 Transformer를 40 epoch 학습하고 검증 손실로 가중치를 선택했다. 최초 모델·데이터 필터·분할은 첫 평가 전에 정했다. 이후 결과와 중복 검사에서 드러난 분할 문제만 위와 같이 수정해 재실행했다. 모델 구조·학습 횟수·마스킹 비율은 바꾸지 않았다. 탐색 실험이며 대규모 모델 선택 실험은 아니다.

## 결과와 반증

| 평가 | 작은 Transformer | 2차 Markov 브리지 + 박 위치 |
|---|---:|---:|
| 가려진 칸의 평균 음의 로그 확률 손실 | 1.0116 | 1.3008 |
| 가려진 칸의 최빈 토큰 정답률 | 66.12% | 65.13% |
| 실제 타격 음 위치에서 최빈 토큰 정답률 | 11.45% | 25.11% |

비교군도 앞뒤 모든 고정 음을 조건으로 쓰는 forward/backward 추론을 한다. 한쪽만 보는 단순 무작위 생성기를 비교군으로 삼지 않았다. NN이 확률 손실에서는 나았지만 실제 음 위치의 최빈 정답에서는 나빴다. **이 결과로 NN의 음악 품질 우세를 주장할 수 없다.** 음악 생성은 유일한 원곡 정답 복원과도 다르므로 반대로 정답률 하나를 음악 품질로 읽지 않는다. 강한 비교군과 실제 청취 비교가 남는다.

세 번의 결정론적 추가 예제에서는 기존 구멍을 모두 보존했다. 이 보존은 하드 마스크와 코드가 보장하며 모델이 스스로 제약을 배웠다는 증거가 아니다. 각 턴에서 독립적인 최빈 음을 고르는 첫 디코더는 같은 음을 반복하는 경향을 보였다. 사용 경험용 완성 디코더로 포장하지 않는다. 순차 조건부 샘플링과 사람이 새 음을 추가한 뒤의 재계산을 실제 청취로 평가해야 한다.

Torch export가 성공했고 `infill_model.pt2`로 저장됐다. **ExecuTorch 실행 성공·VENTUNO 속도·NPU 가속을 뜻하지 않는다.** 최초 실행은 코퍼스 처리를 포함해 약 27.6초, 중복 그룹 수정 후 실행은 토큰 캐시를 사용해 약 4.86초였다. 이 로컬 환경의 시간이므로 해커톤 보드의 수치가 아니다.

## 파일

- `infill_probe.py`: 독립 구현 및 재현 코드.
- `corpus_cache.json`: 전처리 토큰, 악장·파일·분할 식별자, 제외 집계.
- `corpus_grouped.json`: 동일 토큰 창을 공유하는 악장을 묶어 수정한 실제 학습 분할.
- `infill_report.json`: 비교 수치, 검증 기록, 구멍 추가 예제, 제한사항.
- `infill_model.pt`: 직접 학습한 state dict.
- `infill_model.pt2`: Torch export 결과.
- `run.log`: 원래 실행 출력.

이 검사는 모델 경로의 규모와 실행 가능성에 대한 근거다. 수동 펀치의 모터 구동, 종이 재삽입 인식, 물리 연타 간격, 공동 창작의 재미는 별도로 확인해야 한다.

## 후속 ExecuTorch 실행 — 완료

Torch export와 별도로 [공식 절차](https://docs.pytorch.org/executorch/stable/getting-started.html)를 따라 실제 `.pte` 내보내기와 로컬 CPU 런타임 비교를 수행했다. 격리 환경은 별도로 만들었다.

```sh
python3 -m venv /tmp/iot-punchpartner-et-venv
/tmp/iot-punchpartner-et-venv/bin/python -m pip install executorch==1.5.1 music21 torch==2.14.1
/tmp/iot-punchpartner-et-venv/bin/python research/prototypes/punchpartner/executorch_probe.py
```

- Python 3.14.3 / PyTorch 2.14.1 / ExecuTorch 1.5.1 / macOS ARM64.
- `infill_model.pte`: 318,400바이트. XNNPACK delegate 15개와 나머지 portable 연산을 사용한다.
- 52개 평가 창에 새 마스크를 적용한 입력을 실행했다. 입력 `[1, 32]`, 출력 `[1, 32, 16]`.
- PyTorch 대비 최대 logit 절대 차이 `2.384185791015625e-06`. 모든 입력이 `rtol=1e-3, atol=1e-4` 비교를 통과했다.
- 로컬 Python 호출+출력 복사의 중앙값 약 0.273ms는 참고 기록이다. 통제된 성능 벤치마크나 VENTUNO/NPU 속도가 아니다.

`executorch_probe.py`, `executorch_report.json`, `executorch_run.log`, `infill_model.pte`를 보존한다. 위에서 ‘Torch export는 ExecuTorch 실행이 아니다’라고 구분한 단계 이후에 수행한 별도 검사다. 이 성공도 물리 천공이나 음악 품질의 검증으로 확대하지 않는다.
