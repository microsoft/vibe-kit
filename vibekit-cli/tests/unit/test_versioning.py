def test_versioning_basic():
    import versioning  # flat module layout
    assert hasattr(versioning, "compare_versions"), "compare_versions should exist"
