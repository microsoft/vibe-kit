import os
from pathlib import Path
from dotenv import load_dotenv

from pydantic_settings import BaseSettings

# Load .env from the backend directory (where this file lives)
_backend_dir = Path(__file__).parent
load_dotenv(_backend_dir / ".env", override=True)


class Settings(BaseSettings):
    mattergen_endpoint_url: str
    mattergen_use_entra_auth: bool
    mattergen_deployment_name: str
    mattersim_endpoint_url: str
    mattersim_use_entra_auth: bool
    results_root: Path = Path("./data")
    app_mode: str = "research"  # "research" or "production"
    demo_mode: bool = False  # If true, fall back to demo data when endpoint fails

    def __init__(self, **data):
        super().__init__(**data)
        self.mattergen_endpoint_url = os.environ.get("MATTERGEN_ENDPOINT_URL", "")
        self.mattergen_use_entra_auth = (
            os.environ.get("MATTERGEN_USE_ENTRA_AUTH", "true").lower() == "true"
        )
        self.mattergen_deployment_name = os.environ.get("MATTERGEN_DEPLOYMENT_NAME", "")
        self.mattersim_endpoint_url = os.environ.get("MATTERSIM_ENDPOINT_URL", "")
        self.mattersim_use_entra_auth = (
            os.environ.get("MATTERSIM_USE_ENTRA_AUTH", "true").lower() == "true"
        )
        self.app_mode = os.environ.get("APP_MODE", "research").lower()
        self.demo_mode = os.environ.get("DEMO_MODE", "false").lower() == "true"


def get_settings() -> Settings:
    return Settings(
        mattergen_endpoint_url="",
        mattergen_use_entra_auth=True,
        mattergen_deployment_name="",
        mattersim_endpoint_url="",
        mattersim_use_entra_auth=True,
    )
