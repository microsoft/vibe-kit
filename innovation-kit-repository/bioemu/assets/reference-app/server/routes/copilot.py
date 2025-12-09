"""
Copilot AI assistant endpoints.

Blueprint: copilot_bp
Routes:
    POST /api/copilot/ask - Handle copilot chat requests
"""

import time
from flask import Blueprint, jsonify, request

from logging_utils import (
    log_bioemu_info,
    log_bioemu_error,
    log_bioemu_success,
    log_bioemu_timing,
)
from copilot_service import get_copilot_response


copilot_bp = Blueprint("copilot", __name__)


@copilot_bp.route("/api/copilot/ask", methods=["POST"])
def copilot_ask():
    """
    Handle copilot chat requests with context-aware scientific explanations
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        user_message = data.get("message", "").strip()
        context = data.get("context", {})

        if not user_message:
            return jsonify({"error": "No message provided"}), 400

        log_bioemu_info(
            f"Copilot request: '{user_message[:50]}...' with context keys: {list(context.keys())}"
        )

        # Get response from Azure OpenAI copilot service
        start_time = time.time()
        copilot_result = get_copilot_response(user_message, context)
        end_time = time.time()

        # Extract the response text from the result
        response_text = copilot_result.get("response", "No response received")

        log_bioemu_timing("Copilot response generation", start_time, end_time)
        log_bioemu_success(f"Copilot response generated ({len(response_text)} chars)")

        return jsonify(
            {
                "response": response_text,
                "status": "success",
                "context_used": bool(context),
            }
        )

    except Exception as e:
        log_bioemu_error(f"Copilot request failed: {str(e)}")
        return jsonify(
            {
                "error": f"Copilot service error: {str(e)}",
                "response": "I'm sorry, I'm currently unable to provide assistance. Please try again later or contact support if the issue persists.",
                "status": "error",
            }
        ), 500
