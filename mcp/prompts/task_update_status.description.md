Update the CoRAID task status of an open Task branch.

Status is mostly automatic: task_start sets in_progress, and task_merge sets in_review. Use this tool only when the work state changes in between:
- blocked: you cannot continue without user input, credentials, missing files, or an external dependency. Include a note explaining what is missing.
- in_progress: you are resuming work after a block.

Do not set done. A human sets done after the PR is merged or the deliverable is accepted.

Keep notes concise and factual.
