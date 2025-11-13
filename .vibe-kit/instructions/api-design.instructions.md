---
description: API design guidelines for Python FastAPI backends
applyTo: "backend/**/*.py"
---

# API Design Guidelines

## Python FastAPI Best Practices

### Response Patterns

**DO: Return standard Python data structures**
```python
@router.get("/items")
async def list_items() -> Dict[str, Any]:
    return {
        "items": items_data,
        "metadata": {"count": len(items_data)}
    }
```

**DON'T: Manually construct JSONResponse unless needed**
```python
# Avoid this pattern
return JSONResponse(
    content={"data": items_data},
    headers={"Cache-Control": "public, max-age=1800"}
)
```

**When to use JSONResponse:**
- Custom status codes beyond 200
- Special headers (CORS, caching, security)
- Non-standard content types
- Error responses with specific HTTP codes

### Type Hints and Documentation

**DO: Use proper type hints**
```python
from typing import Dict, List, Any, Optional

@router.get("/items/{item_id}")
async def get_item(item_id: str) -> Dict[str, Any]:
    """Get item details by ID"""
    return {
        "id": item_id,
        "data": item_store[item_id]
    }
```

**DO: Include docstrings for endpoint documentation**
```python
@router.get("/reports")
async def get_reports() -> Dict[str, List[Any]]:
    """
    Retrieve a list of reports for analysis.

    Returns:
        Dictionary containing report records
    """
    return {"reports": reports_data}
```

### Error Handling

**DO: Use HTTPException for API errors**
```python
from fastapi import HTTPException

@router.get("/items/{item_id}")
async def get_item(item_id: str) -> Dict[str, Any]:
    if item_id not in item_store:
        raise HTTPException(
            status_code=404,
            detail=f"Item {item_id} not found"
        )
    return {"item": item_store[item_id]}
```

**DO: Validate input parameters**
```python
from pydantic import BaseModel

class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 50

@router.post("/items/search")
async def search_items(request: SearchRequest) -> Dict[str, Any]:
    # Pydantic automatically validates input
    return {"items": filtered_items}
```

Notes:
- For simple mock APIs, basic type hints may be sufficient.
- Use Pydantic models for production APIs requiring validation.

### Router Organization

**DO: Use router prefixes for API versioning**
```python
router = APIRouter(prefix="/api/v1")

# Results in /api/v1/items
@router.get("/items")
async def list_items():
    pass
```

**DO: Group related endpoints in separate router files**
```
api/
  routes/
    items.py       # Item endpoints
    users.py       # User management endpoints
    health.py      # Health/monitoring endpoints
```

### Data Serialization

**DO: Let FastAPI handle JSON serialization automatically**
```python
# FastAPI automatically converts to JSON
return {
    "timestamp": datetime.now(),
    "data": complex_object,
    "metadata": {"version": "1.0"}
}
```

**DO: Use Pydantic models for complex responses**
```python
from pydantic import BaseModel
from datetime import datetime

class ItemResponse(BaseModel):
    id: str
    name: str
    quantity: int
    timestamp: datetime

@router.get("/items/{item_id}")
async def get_item(item_id: str) -> ItemResponse:
    return ItemResponse(
        id=item_id,
        name="Example Item",
        quantity=3,
        timestamp=datetime.now()
    )
```

Note: For mock APIs, simple dictionaries are often sufficient. Use Pydantic models for production APIs with complex validation needs.

### Performance and Caching

**DO: Use dependency injection for shared resources**
```python
from fastapi import Depends

async def get_database():
    # Database connection logic
    return database

@router.get("/items")
async def list_items(db = Depends(get_database)):
    return {"items": await db.fetch_items()}
```

**DO: Implement caching at the application level**
```python
from functools import lru_cache

@lru_cache(maxsize=100)
def get_item_data(item_id: str):
    # Expensive computation
    return process_item_data(item_id)

@router.get("/items/{item_id}")
async def get_item(item_id: str):
    return {"item": get_item_data(item_id)}
```

### Testing and Health Checks

**DO: Include health check endpoints**
```python
@router.get("/health")
async def health_check() -> Dict[str, str]:
    """Simple health check for the API"""
    return {
        "status": "healthy",
        "service": "backend-service",
        "version": "1.0.0"
    }
```

**DO: Make endpoints testable**
```python
# Avoid hard-coded dependencies
@router.get("/items")
async def list_items(data_source = Depends(get_data_source)):
    return {"items": data_source.get_items()}

# Allows easy mocking in tests
```

### Common Anti-Patterns to Avoid

**Returning raw strings instead of structured data**
```python
# Don't do this
@router.get("/items")
async def list_items():
    return "item1,item2,item3"  # Hard to parse
```

**Inconsistent response formats**
```python
# Don't mix formats
@router.get("/items")
async def list_items():
    return {"items": [...]}  # Object wrapper

@router.get("/categories")
async def list_categories():
    return [...]  # Direct array - inconsistent!
```

**❌ Missing error handling**
```python
# Don't ignore potential failures
@router.get("/items/{item_id}")
async def get_item(item_id: str):
    return item_store[item_id]  # KeyError if not found!
```

### Mock Data and Test Fixtures

**DO: Organize mock data by domain**
```python
# Good structure
data/
  mock/
    __init__.py          # Public interface
    items.py             # Item-related data
    categories.py        # Category data
    users.py             # User data

# Import cleanly
from data.mock import items_data
```

**DO: Keep mock data simple**
```python
# Simple dictionaries are fine for mocks
mock_items = [
    {
        "id": "ITEM-001",
        "name": "Gadget",
        "quantity": 2,
        "location": {"aisle": 3, "shelf": "B"}
    }
]
```

**DO: Separate data from API logic**
```python
# api/routes/storms.py - endpoints only
from data.mock import items_data

@router.get("/items")
async def list_items() -> Dict[str, Any]:
    return {"items": items_data}
```

**DON'T: Mix data and API logic in same file**
```python
# Avoid this - data and endpoints together
# api/routes/mock_api.py (838 lines)
#   - 600+ lines of mock data 
#   - 6 API endpoints
#   - Hard to find either data or endpoints
```

**DON'T: Create monolithic data files**
```python
# Avoid files > 300 lines
# Split by domain: items, categories, users, etc.
# Current problem: api/routes/mock_data.py (838 lines)
```

## API Design Principles

1. **Consistency**: Use the same patterns across all endpoints
2. **Predictability**: Follow REST conventions and HTTP standards
3. **Simplicity**: Return standard Python data structures when possible
4. **Type Safety**: Use type hints and Pydantic models
5. **Documentation**: Include docstrings and proper OpenAPI schemas
6. **Error Handling**: Provide clear, actionable error messages
7. **Performance**: Consider caching and async patterns
8. **Testability**: Design endpoints to be easily unit tested
9. **Separation of Concerns**: Keep data, business logic, and API routes separate
10. **Maintainability**: Organize code for easy discovery and modification