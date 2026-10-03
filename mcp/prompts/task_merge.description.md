Append an approved completion report to the CoRAID ticket's common context and close the Task branch.

Before calling this tool, show the exact report to the user and ask for approval. Call this tool only after the user approves. A branch can be merged only once.

The summary must be the approved report with exactly these fields:
- URL: PR URL, document URL, or local deliverable path. Use "N/A" if there is no URL.
- Change summary: 2-5 concise bullets describing what changed and why.
- Changed files: file paths with a short note for each.
- Test results: commands run and outcomes. If a command was not run, state why.
- Remaining issues: risks, follow-ups, review needs, or "None".

work_log: short factual entries of the work process (steps taken, commands run).

Rules:
- Be factual. Do not overclaim.
- Mention uncommitted work, skipped tests, or missing PRs explicitly.
- The author and time are added automatically; do not include them.
