from __future__ import annotations

def compare(a: str, b: str) -> int:
    """Return -1 if a<b, 0 if equal, 1 if a>b using simple semver-ish then lexical fallback.
    This is intentionally minimal for MVP.
    """
    def parts(v: str):
        try:
            return [int(x) for x in v.split('.')]
        except ValueError:
            return None
    pa, pb = parts(a), parts(b)
    if pa is not None and pb is not None and len(pa) == len(pb):
        for x, y in zip(pa, pb):
            if x < y:
                return -1
            if x > y:
                return 1
        return 0
    # fallback lexical
    if a < b:
        return -1
    if a > b:
        return 1
    return 0

# Backwards/forward friendly public name expected by tests and prospective callers.
compare_versions = compare

__all__ = ["compare", "compare_versions"]
