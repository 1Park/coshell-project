<!-- 임시 문구입니다. {{ticket_id}}, {{title}}, {{branch_id}}, {{main_context}} 자리표시자를 사용할 수 있습니다. -->
티켓 {{ticket_id}}({{title}})의 Task 브랜치 {{branch_id}}에서 작업을 시작합니다.

아래 메인 컨텍스트를 참고해 작업하세요. 작업이 끝나면 결과를 요약해 사용자에게 보여주고, 사용자가 승인하면 task_merge를 branch_id "{{branch_id}}"와 함께 호출하세요.

--- 메인 컨텍스트 ---
{{main_context}}
