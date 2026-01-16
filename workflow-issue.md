# Workflow Issue

현재 ./.github/workflows 에 정의된 Github Actions Workflow에 문제가 존재함.

## 내가 원하는 워크플로우
1. 변경사항이 반영된 Pull Request가 생성되면 해당 Pull Request에 대한 CI 테스트가 실행되어야 함
   - 이때 CI는 Lint와 Build-Check를 수행하기 전, Skip-Check를 수행함.
   - Skip-Check에서는 ./.github/ci/ignore-regax 에 해당하는 변경사항만 있을 경우에는 Skip되고 Lint와 Build-Check를 수행하지 않음.
2. CI 테스트가 성공하면 해당 Pull Request가 자동으로 머지됨.
3. main 브랜치에 커밋이 병합되면 다시 CI 테스트가 진행됨. 이번에도 Skip-Check에 따라 Skip해도 되는 변경사항만 있을 경우에는 Lint와 Build-Check를 생략하고 즉시 성공함.
4. main 브랜치에서 CI가 성공하면 자동으로 Changeset을 생성하고 생성된 changeset에 대한 PR을 생성함. 이때 CI 워크플로우는 내 Repository의 브랜치 PR병합 Required 조건이기 때문에 실행되어야함. 단, .changeset 폴더에 해당하는 변경사항은 Skip-Check대상이기 때문에. 즉시 완료될 것임.

이때 추가로, changeset이 생성되고 병합되면, 자동으로 트리거된 Actions가 실행되어 chore: Version Packages라는 이름의 PR을 생성해, 현재까지의 변경사항과 버전이 계산된 PR 브랜치를 만듬. 이미 있다면 해당 브랜치를 계속 업데이트함.

사용자는 나중에 이 릴리즈 PR을 수동으로 병합하면 그때 버전 태그가 푸시되면서 릴리즈 워크플로우가 실행되고 버전이 배포됨.

이 흐름에서 지금 내 앱은 어떤 것이 달라? 일단 얼추 맞게 구현되고 있는 것 같기는 한데, 약간 문제가 있거든.
- chore: auto-generate changeset을 병합하면 changeset 병합에 해당되는 또 다른 changeset이 생성됨. 그러니까 changeset이 반영된게 또 changeset을 생성하는 트리거가 되어서 무한으로 서로가 서로를 생성함.
- 지금 chore: Version Packages에는 버전 태그가 포함되지 않음. 그래서 릴리즈 워크플로우는 실행되는데 Create and Push Version Tag단계가 그냥 스킵되어버리네. 그래서 릴리즈를 내가 나중에 또 수동으로 강제 실행해야지만 진행이 돼.
