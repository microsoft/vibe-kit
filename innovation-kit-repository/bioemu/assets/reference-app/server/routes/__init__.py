"""
Flask route blueprints for the BioEmu reference application.

Provides modular route organization for the BioEmu API server.
Each blueprint handles a specific domain of functionality.

Usage:
    from routes import register_blueprints

    app = Flask(__name__)
    register_blueprints(app)
"""


def register_blueprints(app):
    """Register all route blueprints with the Flask app.

    Order matters: frontend_bp must be last as it has catch-all routes.

    Note:
        Imports are done inside this function to avoid circular imports
        when app.py helper functions are needed by route modules.
    """
    # Import blueprints inside function to avoid circular imports
    from .health import health_bp
    from .pdb import pdb_bp
    from .uniprot import uniprot_bp
    from .alphafold import alphafold_bp
    from .prediction import prediction_bp
    from .trajectory import trajectory_bp
    from .superposition import superposition_bp
    from .comparison import comparison_bp
    from .copilot import copilot_bp
    from .frontend import frontend_bp

    # API blueprints
    app.register_blueprint(health_bp)
    app.register_blueprint(pdb_bp)
    app.register_blueprint(uniprot_bp)
    app.register_blueprint(alphafold_bp)
    app.register_blueprint(prediction_bp)
    app.register_blueprint(trajectory_bp)
    app.register_blueprint(superposition_bp)
    app.register_blueprint(comparison_bp)
    app.register_blueprint(copilot_bp)
    app.register_blueprint(frontend_bp)  # Must be last (catch-all)


__all__ = ["register_blueprints"]
