"""Configuration loader – reads .env and config.yaml."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

# Load .env on first import
load_dotenv(override=False)

_CONFIG: dict[str, Any] | None = None


def _load_yaml() -> dict[str, Any]:
    global _CONFIG
    if _CONFIG is not None:
        return _CONFIG

    config_path = Path(os.getenv("CONFIG_PATH", "config.yaml"))
    if not config_path.exists():
        # Fall back to the example file for defaults
        config_path = Path(__file__).parent.parent.parent / "config.yaml.example"

    if config_path.exists():
        with config_path.open() as fh:
            _CONFIG = yaml.safe_load(fh) or {}
    else:
        _CONFIG = {}

    return _CONFIG


def get(key: str, default: Any = None) -> Any:
    """Retrieve a top-level config key from config.yaml."""
    return _load_yaml().get(key, default)


def get_database_url() -> str:
    return os.getenv("DATABASE_URL", "sqlite:///./network_agent.db")


def get_anthropic_key() -> str | None:
    return os.getenv("ANTHROPIC_API_KEY")


def use_playwright() -> bool:
    return os.getenv("USE_PLAYWRIGHT", "false").lower() in ("1", "true", "yes")


def rate_limits() -> dict[str, Any]:
    return get("rate_limiting", {
        "requests_per_second": 1.0,
        "retry_attempts": 3,
        "retry_backoff_base": 2,
        "connect_timeout": 10,
        "read_timeout": 30,
    })


def scoring_weights() -> dict[str, float]:
    return get("scoring_weights", {
        "overdue_days": 0.4,
        "alignment": 0.3,
        "influence": 0.2,
        "tie_strength": 0.1,
    })


def allowed_domains() -> list[str]:
    return get("allowed_domains", [])


def user_agent() -> str:
    return get("user_agent", "NetworkAgent/0.1 (local research tool)")
