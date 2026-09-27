from typing import Dict, List
from pydantic import BaseModel, Field

class SlotSchema(BaseModel):
    """
    Generation Slot Schema (V8 §10.2).
    
    NON-NEGOTIABLE RULE 2:
    This schema contains ONLY prose fields and inline [S#] markers.
    It MUST NOT contain fields for:
      - applicability
      - grounding_state
      - confidence / confidence_label
      - qco_status / mandatory_status
      - eligibility
      - candidate_is_numbers / is_numbers_list
      - citation_targets
    
    All regulatory facts are established deterministically by L4 Adjudication.
    The LLM synthesizes prose within authorized slots only.
    """
    summary: str = Field(
        description="2-5 sentence narrative synthesis connecting the applicable standard, QCO status, and certification path. Must include [S#] citations."
    )
    why_explanations: Dict[str, str] = Field(
        default_factory=dict,
        description="Map of standard_id to prose explanation of why this standard applies based strictly on matched attributes. Must include [S#] citations."
    )
    step_explanations: List[str] = Field(
        default_factory=list,
        description="Prose explanation for each ordered step of the certification roadmap."
    )
    next_action_guidance: str = Field(
        description="Clear actionable guidance for the manufacturer's immediate next steps."
    )
