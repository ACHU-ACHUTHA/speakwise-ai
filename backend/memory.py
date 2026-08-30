import sqlite3
from datetime import datetime
from backend.config import DB_PATH

def get_db_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS learner_profile (
            id INTEGER PRIMARY KEY,
            name TEXT,
            english_level TEXT,
            goal TEXT,
            updated_at TEXT NOT NULL
        )
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mistakes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original TEXT NOT NULL,
            correction TEXT NOT NULL,
            category TEXT,
            created_at TEXT NOT NULL
        )
    """)
    
    conn.commit()
    conn.close()

def save_learner_profile_db(name: str = None, english_level: str = None, goal: str = None) -> str:
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO learner_profile (id, name, english_level, goal, updated_at)
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = COALESCE(excluded.name, name),
            english_level = COALESCE(excluded.english_level, english_level),
            goal = COALESCE(excluded.goal, goal),
            updated_at = excluded.updated_at
    """, (name, english_level, goal, datetime.now().isoformat()))
    
    conn.commit()
    conn.close()
    return "Learner profile saved successfully."

def get_learner_profile_db() -> dict:
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name, english_level, goal FROM learner_profile WHERE id = 1")
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        return {"status": "No profile saved yet"}
    
    return {
        "name": row["name"],
        "english_level": row["english_level"],
        "goal": row["goal"]
    }

def save_mistake_db(original: str, correction: str, category: str = "grammar") -> str:
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO mistakes (original, correction, category, created_at)
        VALUES (?, ?, ?, ?)
    """, (original, correction, category or "grammar", datetime.now().isoformat()))
    
    conn.commit()
    conn.close()
    return "Mistake saved successfully."

def get_mistakes_db(limit: int = 10) -> list:
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, original, correction, category, created_at
        FROM mistakes ORDER BY id DESC LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
