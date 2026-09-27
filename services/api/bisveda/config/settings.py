import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml
from pydantic import BaseModel, Field

CONFIG_DIR = Path(__file__).resolve().parent
REPO_ROOT = Path(__file__).resolve().parents[4]

class ProviderConfig(BaseModel):
    litellm_model: Optional[str] = None
    timeout_s: int = 20
    api_key_env: Optional[str] = None
    api_base: Optional[str] = None
    kind: Optional[str] = None

class ModelRegistryPolicy(BaseModel):
    retries_per_provider: int = 0
    cooldown_s: int = 60
    terminal_fallback: str = "evidence_only"

class ModelRegistryConfig(BaseModel):
    roles: Dict[str, List[str]] = Field(default_factory=dict)
    providers: Dict[str, ProviderConfig] = Field(default_factory=dict)
    policy: ModelRegistryPolicy = Field(default_factory=ModelRegistryPolicy)

class FeatureFlags(BaseModel):
    generation_enabled: bool = False
    strict_tier_enforcement: bool = True
    require_adjudication_before_gen: bool = True
    quarantine_uploads: bool = True
    preserve_citation_markers: bool = True
    relevance_floor: float = 0.45
    audit_logging: bool = True
    bhashini_enabled: bool = False
    local_pin_centroids: bool = True

class Settings(BaseModel):
    app_name: str = "BISVEDA V8 API Gateway"
    version: str = "8.0.0"
    environment: str = Field(default_factory=lambda: os.getenv("ENVIRONMENT", "development"))
    repo_root: Path = REPO_ROOT
    storage_root: Path = Field(default_factory=lambda: REPO_ROOT / "storage")
    data_dir: Path = Field(default_factory=lambda: REPO_ROOT / "data")
    flags: FeatureFlags = Field(default_factory=FeatureFlags)
    model_registry: ModelRegistryConfig = Field(default_factory=ModelRegistryConfig)

    class Config:
        arbitrary_types_allowed = True

def load_settings() -> Settings:
    flags_path = CONFIG_DIR / "flags.yaml"
    flags_data = {}
    if flags_path.exists():
        with open(flags_path, "r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)
            if raw and "flags" in raw:
                flags_data = raw["flags"]

    registry_path = CONFIG_DIR / "model_registry.yaml"
    registry_data = {}
    if registry_path.exists():
        with open(registry_path, "r", encoding="utf-8") as f:
            registry_data = yaml.safe_load(f) or {}

    flags = FeatureFlags(**flags_data)
    
    # Environment variable overrides
    if os.getenv("GENERATION_ENABLED") is not None:
        flags.generation_enabled = os.getenv("GENERATION_ENABLED").lower() in ("true", "1", "yes")

    model_registry = ModelRegistryConfig(**registry_data)

    return Settings(
        flags=flags,
        model_registry=model_registry,
    )

_settings: Optional[Settings] = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings
