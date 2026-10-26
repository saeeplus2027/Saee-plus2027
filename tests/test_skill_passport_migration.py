import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION = ROOT / 'drizzle' / '0001_skill_passports.sql'

connection = sqlite3.connect(':memory:')
connection.execute('PRAGMA foreign_keys = ON')
connection.executescript(MIGRATION.read_text(encoding='utf-8'))

tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert 'skill_passports' in tables, 'Migration did not create skill_passports'

# User A's record must never be selected or updated by a query bound to user B.
connection.execute(
    'INSERT INTO skill_passports (user_id, payload, version, updated_at) VALUES (?, ?, 1, ?)',
    ('trusted-user-A', '{"profile":{"name":"Alice"}}', '2026-10-26T10:00:00.000Z'),
)
connection.commit()
row_b = connection.execute(
    'SELECT payload, version FROM skill_passports WHERE user_id = ? LIMIT 1',
    ('trusted-user-B',),
).fetchone()
assert row_b is None, 'User B can read user A record'

update_b = connection.execute(
    'UPDATE skill_passports SET payload = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?',
    ('{"profile":{"name":"Mallory"}}', '2026-10-26T10:01:00.000Z', 'trusted-user-B', 1),
)
assert update_b.rowcount == 0, 'User B updated user A record'

# Compare-and-swap: a stale version cannot overwrite a newer save.
update_a = connection.execute(
    'UPDATE skill_passports SET payload = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?',
    ('{"profile":{"name":"Alice v2"}}', '2026-10-26T10:02:00.000Z', 'trusted-user-A', 1),
)
assert update_a.rowcount == 1, 'Current version update failed'
stale_a = connection.execute(
    'UPDATE skill_passports SET payload = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND version = ?',
    ('{"profile":{"name":"stale overwrite"}}', '2026-10-26T10:03:00.000Z', 'trusted-user-A', 1),
)
assert stale_a.rowcount == 0, 'Stale write overwrote a newer save'
row_a = connection.execute('SELECT payload, version FROM skill_passports WHERE user_id = ?', ('trusted-user-A',)).fetchone()
assert row_a[1] == 2 and 'Alice v2' in row_a[0], 'Saved record/version mismatch'

# The deletion statement used by the API is owner-scoped as well.
connection.execute('DELETE FROM skill_passports WHERE user_id = ?', ('trusted-user-B',))
assert connection.execute('SELECT COUNT(*) FROM skill_passports').fetchone()[0] == 1

print('PASS D1/SQLite migration creates the per-user table')
print('PASS user B cannot read, update, or delete user A data')
print('PASS stale If-Match version cannot overwrite a newer revision')
print('\n3 database isolation/concurrency checks passed.')
