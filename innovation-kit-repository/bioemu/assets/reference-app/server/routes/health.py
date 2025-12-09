"""
Health and status check endpoints.

Blueprint: health_bp
Routes:
    GET /health - Basic health check
    GET /api/status - BioEmu configuration status
    GET /api/config - Frontend runtime configuration
"""

import os
from flask import Blueprint, jsonify

from config import (
    API_ENDPOINT,
    API_KEY,
    BIOEMU_MODE,
)
from logging_utils import log_bioemu_info


# Lazy import to avoid circular dependency
def get_local_status():
    """Get local BioEmu status - imports dynamically to avoid circular deps"""
    try:
        from local_bioemu import get_local_status as _get_local_status

        return _get_local_status()
    except ImportError:
        return {"available": False, "errors": ["local_bioemu module not available"]}


health_bp = Blueprint("health", __name__)


@health_bp.route("/health", methods=["GET"])
def health_check():
    """Simple health check endpoint"""
    log_bioemu_info("Health check requested")
    return jsonify({"status": "healthy", "message": "BioEmu API proxy is running"}), 200


@health_bp.route("/api/status", methods=["GET"])
def check_api_status():
    """Return current BioEmu configuration status"""
    status = {"mode": BIOEMU_MODE, "status": "unknown"}

    if BIOEMU_MODE == "local":
        local_status = get_local_status()
        status.update(local_status)
        # Frontend expects "connected" when ready to accept predictions
        status["status"] = (
            "connected" if local_status.get("available") else "not_configured"
        )
    else:  # azure
        if API_ENDPOINT and API_KEY:
            status["status"] = "connected"
            status["message"] = "Azure BioEmu endpoint configured"
            status["endpoint"] = (
                API_ENDPOINT[:50] + "..." if len(API_ENDPOINT) > 50 else API_ENDPOINT
            )
        else:
            status["status"] = "not_configured"
            status["message"] = "Missing AZURE_BIOEMU_ENDPOINT or AZURE_BIOEMU_KEY"

    return jsonify(status), 200


@health_bp.route("/api/config")
def get_frontend_config():
    """Provide runtime configuration for the frontend"""
    return jsonify(
        {
            "backendUrl": "",  # Empty string means use relative URLs (same origin)
            "apiEndpoint": API_ENDPOINT or "not_configured",
            "apiKeyConfigured": bool(API_KEY),
            "environment": os.getenv("FLASK_ENV", "development"),
            "version": "1.0.0",
        }
    )
