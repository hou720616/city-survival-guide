"""避坑指南 - SQLite 数据模型。

使用 Python 内置 sqlite3，零依赖，数据文件存储在 api/data/pitfalls.db。
"""
import os
import sqlite3
import threading
from datetime import datetime
from typing import List, Optional

# 数据库文件路径
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "pitfalls.db")

# 线程本地连接，避免多线程竞争
_local = threading.local()


def _get_conn() -> sqlite3.Connection:
    """获取线程本地数据库连接，自动创建目录和表。"""
    if not hasattr(_local, "conn") or _local.conn is None:
        os.makedirs(DB_DIR, exist_ok=True)
        _local.conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _init_table(_local.conn)
    return _local.conn


def _init_table(conn: sqlite3.Connection) -> None:
    """创建数据表（如果不存在）。"""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pitfalls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            city TEXT NOT NULL,
            location TEXT NOT NULL,
            address TEXT NOT NULL,
            lng REAL NOT NULL,
            lat REAL NOT NULL,
            tag TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            client_ip TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        )
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_pitfalls_city ON pitfalls(city)
        """
    )
    conn.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_pitfalls_client_ip ON pitfalls(client_ip)
        """
    )
    conn.commit()


def insert_pitfall(
    city: str,
    location: str,
    address: str,
    lng: float,
    lat: float,
    tag: str,
    description: str,
    client_ip: str,
) -> dict:
    """插入一条避坑记录，返回包含 id 的字典。"""
    conn = _get_conn()
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor = conn.execute(
        """
        INSERT INTO pitfalls (city, location, address, lng, lat, tag, description, client_ip, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (city, location, address, lng, lat, tag, description, client_ip, now),
    )
    conn.commit()
    return {
        "id": cursor.lastrowid,
        "city": city,
        "location": location,
        "address": address,
        "lng": lng,
        "lat": lat,
        "tag": tag,
        "description": description,
        "created_at": now,
    }


def count_by_ip(client_ip: str) -> int:
    """统计指定 IP 已提交的避坑记录数。"""
    conn = _get_conn()
    row = conn.execute(
        "SELECT COUNT(*) as cnt FROM pitfalls WHERE client_ip = ?",
        (client_ip,),
    ).fetchone()
    return row["cnt"] if row else 0


def list_pitfalls(city: Optional[str] = None, limit: int = 100) -> List[dict]:
    """查询避坑记录列表，可按城市筛选。"""
    conn = _get_conn()
    if city:
        rows = conn.execute(
            "SELECT * FROM pitfalls WHERE city = ? ORDER BY created_at DESC LIMIT ?",
            (city, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM pitfalls ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_pitfall(pitfall_id: int, client_ip: str) -> bool:
    """删除一条避坑记录，仅当 IP 匹配时才允许删除。返回是否删除成功。"""
    conn = _get_conn()
    cursor = conn.execute(
        "DELETE FROM pitfalls WHERE id = ? AND client_ip = ?",
        (pitfall_id, client_ip),
    )
    conn.commit()
    return cursor.rowcount > 0