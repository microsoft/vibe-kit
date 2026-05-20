"""Persistent cache decorator using LMDB.

Simple disk-backed memoization that survives process restarts.
"""

import hashlib
import json
import typing
from functools import wraps
from pathlib import Path

import lmdb
from pydantic import BaseModel


def lmdb_cache(
    cache_dir: str | Path,
    namespace: str = "v1",
    map_size: int = 1 << 30,  # 1GB default max size
):
    """
    Persistent memoization decorator using LMDB.

    Args:
        cache_dir: Directory where LMDB database will be stored.
                   A subdirectory named after the function will be created.
        namespace: Version string for cache invalidation. Bump this when
                   you change the function logic or output format.
        map_size: Maximum database size in bytes (LMDB requires this upfront).
                  Default is 1GB. Can be increased later if needed.

    Usage:
        @lmdb_cache("/path/to/cache", namespace="v1")
        def expensive_function(x, y):
            ...
            return result
    """
    cache_dir = Path(cache_dir)

    def decorator(fn):
        # Validate return type annotation is a Pydantic BaseModel
        hints = typing.get_type_hints(fn)
        return_type = hints.get("return")
        if return_type is None or not (isinstance(return_type, type) and issubclass(return_type, BaseModel)):
            raise TypeError(
                f"@lmdb_cache requires a Pydantic BaseModel return type annotation on '{fn.__name__}'"
            )

        # Create function-specific subdirectory
        db_path = cache_dir / f"{fn.__name__}.lmdb"
        db_path.mkdir(parents=True, exist_ok=True)

        env = lmdb.open(
            str(db_path),
            map_size=map_size,
            subdir=True,
        )

        def make_key(args, kwargs) -> bytes:
            """Create a deterministic cache key from function arguments."""
            payload = json.dumps(
                (namespace, args, sorted(kwargs.items())),
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
            return hashlib.sha256(payload).digest()

        @wraps(fn)
        def wrapper(*args, **kwargs):
            key = make_key(args, kwargs)

            # Check cache
            with env.begin(write=False) as txn:
                cached = txn.get(key)
                if cached is not None:
                    return return_type.model_validate_json(cached)

            # Cache miss - compute result
            result = fn(*args, **kwargs)

            # Store in cache
            blob = result.model_dump_json().encode("utf-8")
            with env.begin(write=True) as txn:
                txn.put(key, blob)

            return result

        # Expose cache management methods
        wrapper.cache_clear = lambda: _clear_cache(env)
        wrapper.cache_info = lambda: _cache_info(env)
        wrapper.cache_path = db_path

        return wrapper

    return decorator


def _clear_cache(env):
    """Clear all entries from the cache."""
    with env.begin(write=True) as txn:
        txn.drop(env.open_db(), delete=False)


def _cache_info(env):
    """Return cache statistics."""
    with env.begin(write=False) as txn:
        stat = txn.stat()
        return {
            "entries": stat["entries"],
            "size_bytes": stat["psize"] * stat["leaf_pages"],
        }
