"""Postgres connection pool for bolna-app.

Set DATABASE_URL (postgresql://user:password@host:5432/dbname) to turn it on. Without it the
server runs as before and /db/health reports the database as not configured.

The pool is created on first use and retried on the next call if that fails, so bolna-app
starts even when Postgres is still booting or not deployed.
"""

import asyncio
import os
import time

import asyncpg

from bolna.helpers.logger_config import configure_logger

logger = configure_logger(__name__)

_pool = None
_pool_lock = asyncio.Lock()


def is_configured():
    return bool(os.getenv("DATABASE_URL"))


async def get_pool():
    """The shared pool, created on first use. Raises if Postgres cannot be reached."""
    global _pool
    if _pool is not None:
        return _pool
    if not is_configured():
        raise RuntimeError("DATABASE_URL is not set")
    async with _pool_lock:
        if _pool is None:
            _pool = await asyncpg.create_pool(
                os.getenv("DATABASE_URL"), min_size=1, max_size=5, timeout=5, command_timeout=10
            )
            logger.info("Connected to Postgres")
    return _pool


async def close_pool():
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def health():
    """Checks that Postgres answers a read and accepts a write.

    The write goes to a temporary table inside a transaction that is rolled back, so the
    check leaves nothing behind."""
    started = time.perf_counter()
    pool = await get_pool()
    async with pool.acquire() as conn:
        info = await conn.fetchrow(
            "SELECT current_database() AS database, current_user AS db_user, "
            "current_setting('server_version') AS server_version, now() AS server_time"
        )
        transaction = conn.transaction()
        await transaction.start()
        try:
            await conn.execute("CREATE TEMP TABLE db_health_check (id int) ON COMMIT DROP")
            await conn.execute("INSERT INTO db_health_check VALUES (1)")
            rows_written = await conn.fetchval("SELECT count(*) FROM db_health_check")
        finally:
            await transaction.rollback()

    return {
        "status": "ok",
        "database": info["database"],
        "user": info["db_user"],
        "server_version": info["server_version"],
        "server_time": info["server_time"].isoformat(),
        "write_check": "ok" if rows_written == 1 else "failed",
        "pool_size": pool.get_size(),
        "latency_ms": round((time.perf_counter() - started) * 1000, 1),
    }
