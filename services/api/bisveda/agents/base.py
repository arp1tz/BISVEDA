from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseSpecialistAgent(ABC):
    """
    Base contract for bounded specialist agents (Canonical Spec §3.3 & Architecture §7).
    Every agent is strictly bounded in scope, deterministic in decision logic,
    and returns grounded structured artifacts.
    """

    agent_id: str
    agent_name: str
    description: str

    @abstractmethod
    def run(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute bounded agent logic against the given context dictionary.
        """
        pass
