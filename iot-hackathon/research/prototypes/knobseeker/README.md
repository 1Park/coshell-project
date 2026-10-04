# KnobSeeker: 공개 음색 encoder의 실제 배포 경로 검사

`encoder_probe.py`는 AFx-Rep의 Cnn14 encoder를 실제로 로드하고, PyTorch → ExecuTorch/XNNPACK 변환 → 로컬 런타임 추론 → 출력 비교까지 실행한다. 페달 제어·음색 탐색·청취 평가·VENTUNO 성능 검사가 아니다.

## 실행된 결과

- 환경: macOS ARM64, Python 3.14.3, PyTorch 2.14.1, ExecuTorch 1.5.1, torchlibrosa 0.1.0.
- 학습 매개변수 81,905,344개. 원본 1.156GB 체크포인트에는 학습 상태도 들어 있다.
- 입력: 실제 기타 대신 입력 경로 검사용으로 만든 고정 3초 합성 현 신호, `[1,1,144000]`, 48kHz.
- 출력: 512차원 벡터 두 개. 이 mono 구현에서는 두 출력이 같으므로 독립적인 두 음색 관측으로 세지 않는다.
- PTE 323,418,496바이트, XNNPACK delegate 7개. 실제 호스트 런타임에서 출력 최대 절대 차이 약 4.17e-6, 두 출력 모두 `allclose(rtol=1e-3, atol=1e-4)` 통과.
- 첫 호스트 forward 0.0379초는 단일 로컬 실행 기록이며 보드 속도·안정된 벤치마크가 아니다.

정확한 값과 환경은 [encoder_report.json](encoder_report.json), 원 로그는 [encoder_run.log](encoder_run.log)에 있다. 큰 체크포인트와 PTE는 `/tmp/iot-knobseeker`에 두었다. 임시 폴더 보존을 보장하지 않으며 이 README만으로 파일이 계속 존재한다고 가정하지 않는다.

## 출처·재현

1. [공개 체크포인트](https://huggingface.co/csteinmetz1/afx-rep/resolve/main/afx-rep.ckpt)를 받는다. SHA256 `3587c4f3a1a8ecbc53b8023c480a0e6ff80719bcc26ce6ee6d08b8daf41d75d4`. [모델 저장소](https://huggingface.co/csteinmetz1/afx-rep)는 Apache-2.0으로 표기한다.
2. `torch.load(..., map_location='cpu', weights_only=True)['state_dict']`에서 `encoder.` 접두사가 있는 텐서만 추출하고 접두사를 제거해 `encoder_state.pt`에 저장한다. 실행 당시 unsafe globals 목록은 빈 목록이었다.
3. 격리 환경에 위 패키지를 설치하고 `python encoder_probe.py --state /path/encoder_state.pt --output /path/afx_encoder.pte`를 실행한다. 이 스크립트는 현재 폴더의 보고서를 갱신한다.

`vendor/panns.py`는 [ST-ITO 저자 저장소](https://github.com/csteinmetz1/st-ito/blob/main/st_ito/models/panns.py)의 코드다. [ST-ITO Apache-2.0](vendor/ST_ITO_LICENSE) 및 원 [PANNs MIT](vendor/PANNS_LICENSE)를 함께 보존했다. 원 PANNs 라이선스 경로는 `qiuqiangkong/audioset_tagging_cnn` 저장소의 `LICENSE.MIT`다. `model_source.json`에 다운로드 출처와 원 체크포인트 해시를 기록했다.

실제 검색에서는 저자 helper와 같이 입력 peak 정규화 및 출력 L2 정규화가 추가로 필요하다. 이 배포 검사는 encoder의 수치 일치만 검사했다. 학습 표현이 연주 내용에 완전히 불변이라고 주장하지 않으며, 단순 MFCC/스펙트럼보다 해당 페달에서 우수한지는 별도 비교 대상이다.
