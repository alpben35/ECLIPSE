import sqlite3
import tempfile
import unittest
from pathlib import Path
from agent_runtime.session_memory import SessionMemory


class SessionMemoryTests(unittest.TestCase):
    def test_save_reopen_replace_and_delete(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'memory.db'
            with SessionMemory(path) as memory:
                self.assertIsNone(memory.retrieve_context('q1'))
                memory.store_context('q1', 'first')
                old_id = memory.conn.execute('SELECT id FROM interaction_history').fetchone()[0]
                memory.store_context('q1', 'second')
                self.assertEqual(memory.conn.execute('SELECT id FROM interaction_history').fetchone()[0], old_id)
            with SessionMemory(path) as memory:
                self.assertEqual(memory.retrieve_context('q1'), 'second')
                memory.delete_context('q1')
                self.assertIsNone(memory.retrieve_context('q1'))

    def test_parameterised_sql_and_empty_answer(self):
        with SessionMemory(':memory:') as memory:
            code = "x'); DROP TABLE interaction_history; --"
            memory.store_context(code, '')
            self.assertEqual(memory.retrieve_context(code), '')
            memory.clear()
            self.assertIsNone(memory.retrieve_context(code))

    def test_database_errors_propagate_and_connection_closes(self):
        with SessionMemory(':memory:') as memory:
            with self.assertRaises(ValueError):
                memory.store_context(' ', 'answer')
            with self.assertRaises(TypeError):
                memory.store_context('q', None)
            memory.conn.execute('DROP TABLE interaction_history')
            with self.assertRaises(sqlite3.OperationalError):
                memory.store_context('q', 'answer')
        with self.assertRaises(sqlite3.ProgrammingError):
            memory.retrieve_context('q')

    def test_separate_databases_do_not_share_context(self):
        with SessionMemory(':memory:') as a, SessionMemory(':memory:') as b:
            a.store_context('same', 'private')
            self.assertIsNone(b.retrieve_context('same'))


if __name__ == '__main__':
    unittest.main()
