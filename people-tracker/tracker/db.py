import sqlite3
from pathlib import Path

DATA_DIR = Path.home() / ".people-tracker"
DB_PATH = DATA_DIR / "tracker.db"


def get_conn():
    DATA_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS people (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                linkedin_slug TEXT,
                instagram_username TEXT,
                notes TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
                platform TEXT NOT NULL,
                post_id TEXT NOT NULL,
                content TEXT,
                url TEXT,
                posted_at TEXT,
                fetched_at TEXT DEFAULT (datetime('now')),
                flagged INTEGER DEFAULT 0,
                reached_out INTEGER DEFAULT 0,
                UNIQUE(platform, post_id)
            );
        """)


def add_person(name, linkedin_slug=None, instagram_username=None, notes=None):
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO people (name, linkedin_slug, instagram_username, notes) VALUES (?, ?, ?, ?)",
            (name, linkedin_slug, instagram_username, notes),
        )
        return cur.lastrowid


def list_people():
    with get_conn() as conn:
        return conn.execute("SELECT * FROM people ORDER BY name").fetchall()


def get_person(person_id):
    with get_conn() as conn:
        return conn.execute("SELECT * FROM people WHERE id = ?", (person_id,)).fetchone()


def update_person_notes(person_id, notes):
    with get_conn() as conn:
        conn.execute("UPDATE people SET notes = ? WHERE id = ?", (notes, person_id))


def save_post(person_id, platform, post_id, content, url, posted_at):
    """Insert a post. Returns True if new, False if already existed."""
    with get_conn() as conn:
        try:
            conn.execute(
                """INSERT INTO posts (person_id, platform, post_id, content, url, posted_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (person_id, platform, post_id, content, url, posted_at),
            )
            return True
        except sqlite3.IntegrityError:
            return False


def get_feed(limit=50, only_new=False):
    with get_conn() as conn:
        query = """
            SELECT p.*, pe.name as person_name
            FROM posts p
            JOIN people pe ON p.person_id = pe.id
        """
        if only_new:
            query += " WHERE p.flagged = 0 AND p.reached_out = 0"
        query += " ORDER BY p.fetched_at DESC LIMIT ?"
        return conn.execute(query, (limit,)).fetchall()


def get_person_posts(person_id, limit=20):
    with get_conn() as conn:
        return conn.execute(
            """SELECT p.*, pe.name as person_name FROM posts p
               JOIN people pe ON p.person_id = pe.id
               WHERE p.person_id = ?
               ORDER BY p.fetched_at DESC LIMIT ?""",
            (person_id, limit),
        ).fetchall()


def flag_post(post_id):
    with get_conn() as conn:
        conn.execute("UPDATE posts SET flagged = 1 WHERE id = ?", (post_id,))


def unflag_post(post_id):
    with get_conn() as conn:
        conn.execute("UPDATE posts SET flagged = 0 WHERE id = ?", (post_id,))


def mark_reached_out(post_id):
    with get_conn() as conn:
        conn.execute("UPDATE posts SET reached_out = 1 WHERE id = ?", (post_id,))


def delete_person(person_id):
    with get_conn() as conn:
        conn.execute("DELETE FROM people WHERE id = ?", (person_id,))


def stats():
    with get_conn() as conn:
        people_count = conn.execute("SELECT COUNT(*) FROM people").fetchone()[0]
        post_count = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
        flagged = conn.execute("SELECT COUNT(*) FROM posts WHERE flagged = 1").fetchone()[0]
        reached = conn.execute("SELECT COUNT(*) FROM posts WHERE reached_out = 1").fetchone()[0]
        return {"people": people_count, "posts": post_count, "flagged": flagged, "reached_out": reached}
