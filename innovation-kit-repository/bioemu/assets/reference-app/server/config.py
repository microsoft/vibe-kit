"""
BioEmu server configuration - environment variables and constants.
"""

import os
import logging
from threading import Lock
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

logger = logging.getLogger(__name__)

# Azure BioEmu API credentials
API_ENDPOINT = os.getenv("AZURE_BIOEMU_ENDPOINT")
API_KEY = os.getenv("AZURE_BIOEMU_KEY")

# BioEmu mode: 'azure' (default) or 'local'
BIOEMU_MODE = os.getenv("BIOEMU_MODE", "azure").lower()
if BIOEMU_MODE not in ("azure", "local"):
    logger.warning(f"Invalid BIOEMU_MODE '{BIOEMU_MODE}', defaulting to 'azure'")
    BIOEMU_MODE = "azure"

# API status caching
api_status_cache = {"status": None, "message": None, "last_checked": 0}
api_status_lock = Lock()
API_STATUS_CACHE_SECONDS = 300  # 5 minutes

# Flask build directory for React static files
BUILD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "build")
)

# CORS origins for development
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
