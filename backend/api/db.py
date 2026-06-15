import os
from contextlib import contextmanager
from pathlib import Path

import pymysql
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


def db_config() -> dict:
    return {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "3306")),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASSWORD", ""),
        "database": os.getenv("DB_NAME", "nutrisocial"),
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": True,
    }


@contextmanager
def get_connection(autocommit: bool = True):
    config = db_config()
    config["autocommit"] = autocommit
    conn = pymysql.connect(**config)
    try:
        yield conn
    finally:
        conn.close()


def check_db_connection() -> None:
    with get_connection() as conn:
        conn.ping(reconnect=True)
