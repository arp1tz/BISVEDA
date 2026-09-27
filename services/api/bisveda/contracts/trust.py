from typing import List, Optional
from pydantic import BaseModel, Field

class TrustCheckResult(BaseModel):
    check_name: str
    passed: bool
    details: str

class TrustResult(BaseModel):
    passed: bool
    blocked: bool = False
    block_reason: Optional[str] = None
    clean_text: str
    verified_citations: List[str] = Field(default_factory=list)
    stripped_citations: List[str] = Field(default_factory=list)
    caveats: List[str] = Field(default_factory=list)
    checks: List[TrustCheckResult] = Field(default_factory=list)
