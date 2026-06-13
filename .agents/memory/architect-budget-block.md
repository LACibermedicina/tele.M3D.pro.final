---
name: Architect / code_review tool budget block
description: Why the architect (code_review) tool fails with a budget error here and what to do instead.
---

The `architect` callback (code_review skill) fails with:
`No pattern fits under budget of 49152: ~53000 > PromptRoot(...)`
even when called with a single small file, no git diff, and a one-line task.

**Why:** The architect's own baseline/system context for this repository already
renders to ~52–55k tokens, which is above the tool's fixed ~49,152 prompt budget.
The overflow is environmental (repo size / base context), not your `task` text or
`relevantFiles` size — shrinking your input does not help.

**How to apply:** Do not waste multiple attempts shrinking the prompt. Do a careful
manual self-review of the diff instead, and when marking a task complete note the
code review was env-blocked by the architect prompt budget (set skip_validation_reason
if validation depends on it).
