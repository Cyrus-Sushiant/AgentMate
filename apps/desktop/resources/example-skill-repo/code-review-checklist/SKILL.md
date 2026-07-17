# Code Review Checklist

Before approving a change, verify:

- Correctness: does the change do what it claims, including edge cases?
- Security: no injection, unsafe deserialization, or leaked secrets.
- Tests: new behavior is covered; existing tests still pass.
- Scope: the diff matches the stated intent, no unrelated changes.
- Readability: naming and structure make the change easy to follow.

Flag blocking issues separately from stylistic nits.
