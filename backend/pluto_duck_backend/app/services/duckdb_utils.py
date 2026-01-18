from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import threading

import duckdb

_duckdb_conn_lock = threading.RLock()


@contextmanager
def connect_warehouse(path: Path):
    """Serialize DuckDB connections to avoid unique file handle conflicts."""
    with _duckdb_conn_lock:
        con = duckdb.connect(str(path))
        try:
            yield con
        finally:
            try:
                con.close()
            except Exception:
                pass
