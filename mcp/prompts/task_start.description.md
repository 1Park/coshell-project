Start a CoRAID Task for a ticket and read its context before implementation.

Call this tool when the user pastes a CoRAID task handoff prompt, asks you to work on a CoRAID ticket, or provides a CoRAID ticket_id (for example BUG-104).

The tool creates a Task branch and returns:
- the branch_id needed later for task_merge;
- ticket title and description;
- the append-only common context;
- discussion entries;
- the required workflow.

After calling this tool, briefly summarize the ticket and the CoRAID context you received, then stop and wait for the user's instructions. Do not start investigating or editing code until the user asks.
