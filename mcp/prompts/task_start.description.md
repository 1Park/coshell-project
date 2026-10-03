Start a CoRAID Task for a ticket and read its context before implementation.

Call this tool when the user pastes a CoRAID task handoff prompt, asks you to work on a CoRAID ticket, or provides a CoRAID ticket_id (for example BUG-104).

The tool creates a Task branch and returns:
- the branch_id needed later for task_merge;
- ticket title and description;
- the append-only common context;
- discussion entries;
- the required workflow.

After calling this tool, restate the implementation goal briefly and start working unless the task is ambiguous.
