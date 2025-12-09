"""
Frontend serving endpoints.

Blueprint: frontend_bp
Routes:
    GET /favicon.ico, /manifest.json, /robots.txt, /logo*.png - Root assets
    GET / - React SPA catch-all
    GET /<path> - React SPA catch-all for all non-API routes
"""

import os
from flask import Blueprint, jsonify, request, send_from_directory, send_file

from config import BUILD_DIR


frontend_bp = Blueprint("frontend", __name__)


@frontend_bp.route("/favicon.ico")
@frontend_bp.route("/manifest.json")
@frontend_bp.route("/robots.txt")
@frontend_bp.route("/logo192.png")
@frontend_bp.route("/logo512.png")
def serve_root_assets():
    """Serve specific root assets from build directory"""
    # Get the filename from the request path
    filename = request.path[1:]  # Remove leading slash

    file_path = os.path.join(BUILD_DIR, filename)
    print(f"Root asset request: {filename}")
    print(f"Asset path: {file_path}")
    print(f"Asset exists: {os.path.exists(file_path)}")

    if os.path.exists(file_path):
        print(f"Serving root asset: {filename}")
        return send_from_directory(BUILD_DIR, filename)
    else:
        print(f"Root asset not found: {filename}")
        return "Asset not found", 404


@frontend_bp.route("/", defaults={"path": ""})
@frontend_bp.route("/<path:path>")
def serve_react_app(path=""):
    """Serve React app for all non-API routes"""
    print(f"React app request: path='{path}'")

    # If it's an API route, don't handle it here (let Flask return 404)
    if path.startswith("api/"):
        return jsonify({"error": "API endpoint not found"}), 404

    # If it's a static file request, don't handle it here
    if path.startswith("static/"):
        return jsonify({"error": "Static file not found"}), 404

    # Serve the React index.html for all other routes
    index_file = os.path.join(BUILD_DIR, "index.html")
    print(f"Serving index.html from: {os.path.abspath(index_file)}")
    print(f"File exists: {os.path.exists(index_file)}")

    return send_file(index_file)
