# Local session memory

Python 3.10+ standard library, no dependencies. This is a local workflow component, not a Firebase agent memory service or a Sparx automation integration.

```python
from agent_runtime.session_memory import SessionMemory

with SessionMemory("my_workflow.db") as memory:
    memory.store_context("algebra-practice-1", "x = 4")
    answer = memory.retrieve_context("algebra-practice-1")
    memory.delete_context("algebra-practice-1")
```

Use a separate database per user/session in a directory accessible only to that user. SQLite does not encrypt this file or authenticate callers. Never store passwords, access tokens, or other users' conversations here. Context persists until deleted; `clear()` deletes all records in the current database. SQLite deletion is not guaranteed forensic erasure. Close the connection or use the context manager. Errors propagate so the caller can handle failure rather than falsely report successful storage. Connections should not be shared across threads.

The schema and `store_context`/`retrieve_context` methods match the supplied class. UPSERT preserves row IDs and refreshes timestamps. Missing records return `None`; empty answers return an empty string. Tests use disposable databases only:

`python -m unittest discover -s tests -p 'test_session_memory.py'`

Cloud Functions run Node.js with ephemeral local disks. The website equivalent is implemented in `backend/functions/session-memory.cjs` and connected to the authenticated Eclipse Agent endpoint. Website users can explicitly enable/restore memory or forget it. The server stores bounded per-user context in Firestore; this Python module remains a local-only component. Both await the agent release described in `docs/eclipse-agent-release.md`.
