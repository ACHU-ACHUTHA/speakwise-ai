import sqlite3
from datetime import datetime


DB_PATH = "database/teacher.db"


def save_mistake(
    original: str,
    correction: str,
    category: str
):
    """
    Save an English mistake made by the student.
    """

    connection = sqlite3.connect(DB_PATH)

    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS mistakes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original TEXT NOT NULL,
            correction TEXT NOT NULL,
            category TEXT,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        INSERT INTO mistakes
        (original, correction, category, created_at)
        VALUES (?, ?, ?, ?)
    """, (
        original,
        correction,
        category,
        datetime.now().isoformat()
    ))

    connection.commit()
    connection.close()

    return "Mistake saved successfully."

# =====================
if __name__ == "__main__":

    result = save_mistake(
        "I didn't ate breakfast",
        "I didn't eat breakfast",
        "grammar"
    )

    print(result)