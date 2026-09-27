import sqlite3

conn = sqlite3.connect(r'c:\BISVEDA\data\bisveda.db')
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cur.fetchall()
print('Tables:', tables)

for t in tables:
    name = t[0]
    cur.execute(f"SELECT count(*) FROM {name}")
    print(f"Table {name}: {cur.fetchone()[0]} rows")
    cur.execute(f"PRAGMA table_info({name})")
    cols = [c[1] for c in cur.fetchall()]
    print(f"  Columns: {cols[:8]}")
