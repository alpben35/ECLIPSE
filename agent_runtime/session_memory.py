"""SQLite context storage for a single local workflow.

Use a separate database per user/session. This module is not imported by the
Node.js Firebase function and does not provide a multi-user access boundary.
"""
import sqlite3
from pathlib import Path


class SessionMemory:
    """Persist item/answer context without silently swallowing storage errors."""

    def __init__(self, db_path: str | Path = "session_context.db"):
        self.conn = sqlite3.connect(db_path, timeout=10)
        self.cursor = self.conn.cursor()
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS interaction_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_code TEXT UNIQUE,
                computed_answer TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        self.conn.commit()

    def store_context(self, item_code: str, computed_answer: str) -> None:
        self._validate_code(item_code)
        if not isinstance(computed_answer, str):
            raise TypeError("computed_answer must be a string")
        # Preserve row identity when replacing context and refresh its timestamp.
        # A transaction rolls back on error; callers can report failure honestly.
        with self.conn:
            self.conn.execute("""
                INSERT INTO interaction_history (item_code, computed_answer)
                VALUES (?, ?)
                ON CONFLICT(item_code) DO UPDATE SET
                    computed_answer = excluded.computed_answer,
                    timestamp = CURRENT_TIMESTAMP
            """, (item_code, computed_answer))

    def retrieve_context(self, item_code: str) -> str | None:
        self._validate_code(item_code)
        result = self.conn.execute(
            "SELECT computed_answer FROM interaction_history WHERE item_code = ?",
            (item_code,),
        ).fetchone()
        return result[0] if result else None

    def delete_context(self, item_code: str) -> None:
        self._validate_code(item_code)
        with self.conn:
            self.conn.execute("DELETE FROM interaction_history WHERE item_code = ?", (item_code,))

    def clear(self) -> None:
        """Delete all context in this workflow's database."""
        with self.conn:
            self.conn.execute("DELETE FROM interaction_history")

    def close(self) -> None:
        self.conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    @staticmethod
    def _validate_code(item_code: str) -> None:
        if not isinstance(item_code, str):
            raise TypeError("item_code must be a string")
        if not item_code.strip():
            raise ValueError("item_code must not be blank")
