import json
from pathlib import Path
from typing import Dict, List, Optional, Set
import yaml
from pydantic import BaseModel, Field

class TaxonomyGroup(BaseModel):
    id: str
    name: str
    committees: List[str]
    must_contain: List[str]

class TaxonomyValidationReport(BaseModel):
    is_valid: bool
    total_groups: int
    total_must_contain_standards: int
    verified_standards_count: int
    missing_standards: Dict[str, List[str]] = Field(default_factory=dict)
    committee_coverage: Dict[str, List[str]] = Field(default_factory=dict)
    errors: List[str] = Field(default_factory=list)

class TaxonomyInvariantError(Exception):
    """Raised when a priority product group violates must-contain invariants."""
    pass

class TaxonomyValidator:
    def __init__(self, taxonomy_file: Optional[Path] = None, standards_file: Optional[Path] = None):
        repo_root = Path(__file__).resolve().parents[4]
        self.taxonomy_file = taxonomy_file or repo_root / "data" / "taxonomy" / "groups.yaml"
        self.standards_file = standards_file or repo_root / "data" / "seed" / "standards.json"

    def validate(self, raise_on_error: bool = False) -> TaxonomyValidationReport:
        errors: List[str] = []
        if not self.taxonomy_file.exists():
            msg = f"Taxonomy file not found at {self.taxonomy_file}"
            if raise_on_error:
                raise TaxonomyInvariantError(msg)
            return TaxonomyValidationReport(
                is_valid=False,
                total_groups=0,
                total_must_contain_standards=0,
                verified_standards_count=0,
                errors=[msg]
            )

        if not self.standards_file.exists():
            msg = f"Standards catalog file not found at {self.standards_file}"
            if raise_on_error:
                raise TaxonomyInvariantError(msg)
            return TaxonomyValidationReport(
                is_valid=False,
                total_groups=0,
                total_must_contain_standards=0,
                verified_standards_count=0,
                errors=[msg]
            )

        with open(self.taxonomy_file, "r", encoding="utf-8") as f:
            raw_tax = yaml.safe_load(f) or {}

        with open(self.standards_file, "r", encoding="utf-8") as f:
            standards_data = json.load(f)

        raw_groups = raw_tax.get("groups", [])
        if not raw_groups:
            errors.append("Taxonomy file contains no product groups.")

        # Index available standard numbers
        catalog_numbers: Set[str] = set()
        for s in standards_data:
            num = s.get("standard_number") or s.get("is_number")
            if num:
                catalog_numbers.add(num.strip().upper())

        missing_by_group: Dict[str, List[str]] = {}
        committee_cov: Dict[str, List[str]] = {}
        total_must_contain = 0
        verified_count = 0

        for g_data in raw_groups:
            group = TaxonomyGroup(**g_data)
            committee_cov[group.id] = group.committees
            group_missing = []

            for required_std in group.must_contain:
                total_must_contain += 1
                norm_req = required_std.strip().upper()
                if norm_req in catalog_numbers:
                    verified_count += 1
                else:
                    group_missing.append(required_std)

            if group_missing:
                missing_by_group[group.id] = group_missing
                errors.append(f"Group '{group.id}' missing required standards: {group_missing}")

        is_valid = len(errors) == 0
        report = TaxonomyValidationReport(
            is_valid=is_valid,
            total_groups=len(raw_groups),
            total_must_contain_standards=total_must_contain,
            verified_standards_count=verified_count,
            missing_standards=missing_by_group,
            committee_coverage=committee_cov,
            errors=errors,
        )

        if not is_valid and raise_on_error:
            raise TaxonomyInvariantError(f"Taxonomy invariant violation: {errors}")

        return report

def validate_taxonomy_invariants() -> TaxonomyValidationReport:
    """Helper function to run validation and return report."""
    validator = TaxonomyValidator()
    return validator.validate(raise_on_error=True)
