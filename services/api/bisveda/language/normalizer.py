import json
from pathlib import Path
import re
import unicodedata
from typing import Any, Dict, List, Optional


def normalize_text(text: str) -> str:
    """
    Applies Unicode NFC normalization, normalizes dashes, spaces, and punctuation.
    """
    if not text:
        return ""
    # 1. Unicode NFC normalization
    norm = unicodedata.normalize("NFC", text)
    # 2. Normalize hyphens and dashes (en-dash, em-dash, minus, etc.)
    norm = re.sub(r"[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]", "-", norm)
    # 3. Normalize quotes
    norm = re.sub(r"[\u2018\u2019]", "'", norm)
    norm = re.sub(r"[\u201C\u201D]", '"', norm)
    # 4. Standardize whitespace
    norm = re.sub(r"\s+", " ", norm).strip()
    return norm


# Matches IS numbers with spaces, colons, hyphens, optional parts, and optional years
# e.g. "IS 2347", "IS:2347", "IS-2347", "IS2347", "IS 2347:2017", "IS 1489 (Part 1)", "IS 1239 Pt 1"
IS_PATTERN = re.compile(
    r"\bIS\s*[:\-]?\s*(\d{1,5}(?:\s*(?:\(Part\s*\d+\)|Part\s*\d+|Pt\s*\d+))?(?:\s*:\s*\d{4})?)\b",
    re.IGNORECASE,
)

IS_DIGITS_ONLY = re.compile(
    r"\bIS\s*[:\-]?\s*(\d{1,5})\b",
    re.IGNORECASE,
)


def extract_is_numbers(text: str) -> List[str]:
    """
    Extracts all occurrences of Indian Standard references and returns them
    in canonicalized form, e.g. 'IS 2347' or 'IS 2347:2017'.
    """
    normalized = normalize_text(text)
    matches = IS_PATTERN.findall(normalized)
    canonical = []
    for m in matches:
        clean_part = re.sub(r"\s+", " ", m.strip())
        canonical.append(f"IS {clean_part}")
    return canonical


def canonicalize_is_number(raw_is: str) -> str:
    """
    Canonicalizes an IS string to standard 'IS <number>' format.
    Example: 'IS:2347' -> 'IS 2347', 'is2347' -> 'IS 2347'
    """
    m = IS_PATTERN.search(normalize_text(raw_is))
    if m:
        clean_part = re.sub(r"\s+", " ", m.group(1).strip())
        return f"IS {clean_part}"
    # Fallback digit extraction
    digits = re.search(r"\d+", raw_is)
    if digits:
        return f"IS {digits.group(0)}"
    return raw_is.strip().upper()


def extract_is_digits(text: str) -> Optional[str]:
    """
    Extracts the primary integer standard number (e.g. '2347' from 'IS:2347:2017').
    """
    m = IS_DIGITS_ONLY.search(normalize_text(text))
    if m:
        return m.group(1)
    return None


class DisambiguationRouter:
    """
    Pre-RAG Intent Routing & Ambiguity Trap.
    Catches polysemous product queries ('water bottle', 'cooker', 'cement', 'fan', 'pipe')
    and returns disambiguation options unless distinguishing modifiers are present.
    """

    def __init__(self, catalog_path: Optional[Path] = None):
        if not catalog_path:
            repo_root = Path(__file__).resolve().parents[4]
            catalog_path = repo_root / "data" / "seed" / "disambiguation.json"
        self.catalog_path = catalog_path
        self.rules: Dict[str, Any] = {}
        self._load()

    def _load(self):
        if self.catalog_path.exists():
            try:
                with open(self.catalog_path, "r", encoding="utf-8") as f:
                    self.rules = json.load(f)
            except Exception:
                self.rules = {}

    def check_ambiguity(self, query: str) -> Dict[str, Any]:
        """
        Evaluates whether the query is ambiguous.
        Returns:
            {"is_ambiguous": bool, "term": Optional[str], "question": Optional[str], "options": List[Dict]}
        """
        clean_query = normalize_text(query).lower()

        # If an explicit IS number is already provided, do not trap as ambiguous
        if IS_DIGITS_ONLY.search(clean_query):
            return {"is_ambiguous": False}

        # Specific qualifiers that resolve polysemy
        specific_modifiers = [
            "stainless steel", "vacuum", "insulated", "drinking water", "natural mineral",
            "mineral water", "packaged water", "ceiling fan", "exhaust fan", "table fan",
            "pedestal fan", "opc", "ppc", "slag", "portland", "pressure cooker",
            "electric cooker", "commercial cooker", "cpvc", "upvc", "hdpe", "galvanized",
            "domestic pressure", "gas stove", "helmet"
        ]

        # Check each polysemous term
        for term_key, rule in self.rules.items():
            key_lower = term_key.lower()
            key_pattern = rf"\b{re.escape(key_lower)}(?:s)?\b"

            if re.search(key_pattern, clean_query):
                # Check if specific modifiers resolve the ambiguity
                has_modifier = any(mod in clean_query for mod in specific_modifiers)
                tokens = clean_query.split()

                # If query is short (<= 4 words) and lacks specific disambiguating modifiers
                if len(tokens) <= 4 and not has_modifier:
                    return {
                        "is_ambiguous": True,
                        "term": rule.get("term", term_key),
                        "question": rule.get("question", f"Which type of {term_key} are you manufacturing?"),
                        "options": rule.get("options", []),
                    }
                elif clean_query.strip() in (key_lower, f"{key_lower}s"):
                    return {
                        "is_ambiguous": True,
                        "term": rule.get("term", term_key),
                        "question": rule.get("question", f"Which type of {term_key} are you manufacturing?"),
                        "options": rule.get("options", []),
                    }

        return {"is_ambiguous": False}
