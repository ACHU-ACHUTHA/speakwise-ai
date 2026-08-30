import sqlite3
from backend.config import DB_PATH

conn = sqlite3.connect(DB_PATH)
c = conn.cursor()

c.execute("SELECT COUNT(*) FROM mistakes WHERE original LIKE '%breakfast%'")
count = c.fetchone()[0]
print('Breakfast entries to delete:', count)

c.execute("DELETE FROM mistakes WHERE original LIKE '%breakfast%'")
conn.commit()

c.execute('SELECT COUNT(*) FROM mistakes')
remaining = c.fetchone()[0]
print('Remaining mistakes in DB:', remaining)

c.execute('SELECT id, original, correction FROM mistakes ORDER BY id DESC LIMIT 10')
for row in c.fetchall():
    print(' ', row)

conn.close()
print('Done.')
