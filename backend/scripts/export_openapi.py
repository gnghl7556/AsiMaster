"""Export FastAPI OpenAPI spec to JSON for frontend type generation.

Usage:
    cd backend && python3 -m scripts.export_openapi

Output:
    ../openapi.json (project root)
"""
import json
import os
import sys
from pathlib import Path

# Set dummy env vars so config.py validation passes.
# We never start the server — only need the schema.
# DATABASE_URL is loaded from .env (asyncpg required); do NOT override it.
os.environ.setdefault("NAVER_CLIENT_ID", "dummy-for-schema-export")
os.environ.setdefault("NAVER_CLIENT_SECRET", "dummy-for-schema-export")

# Ensure backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402

spec = app.openapi()
output_path = Path(__file__).resolve().parent.parent.parent / "openapi.json"
output_path.write_text(json.dumps(spec, indent=2, ensure_ascii=False))

paths_count = len(spec.get("paths", {}))
schemas_count = len(spec.get("components", {}).get("schemas", {}))
print(f"OpenAPI spec exported → {output_path}")
print(f"  Paths: {paths_count}  |  Schemas: {schemas_count}")
