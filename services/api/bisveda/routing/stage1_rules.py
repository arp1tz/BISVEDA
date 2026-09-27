import json
import math
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from bisveda.config.settings import get_settings


class ExactISMatcher:
    """
    Speed Gate Exact Matcher (Canonical Spec §3.1).
    Detects queries targeted at a specific Indian Standard (e.g. 'IS 2347', 'IS 456:2000')
    and returns catalogue records in < 150 ms without requiring heavy full-text or vector search.
    """

    EXACT_IS_REGEX = re.compile(
        r"\b(?:IS|is|Is)\s*[-:]?\s*(\d+)(?:\s*(?:Part\s*(\d+)|Pt\.?\s*(\d+)))?(?:\s*[:\-–]\s*(\d{4}))?\b"
    )

    def __init__(self, standards_file: Optional[Path] = None):
        settings = get_settings()
        self.standards_file = standards_file or (settings.data_dir / "seed" / "standards.json")
        self.catalog_by_is: Dict[str, Dict[str, Any]] = {}
        self._load_catalog()

    def _load_catalog(self):
        if self.standards_file and self.standards_file.exists():
            try:
                with open(self.standards_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for item in data:
                    is_num = str(item.get("standard_number", "")).strip().upper()
                    if is_num:
                        self.catalog_by_is[is_num] = item
                        # Normalized without space
                        self.catalog_by_is[is_num.replace(" ", "")] = item
            except Exception:
                pass

    def match(self, query: str) -> Optional[Tuple[str, Dict[str, Any]]]:
        clean_q = query.strip()
        m = self.EXACT_IS_REGEX.search(clean_q)
        if not m:
            return None

        num = m.group(1)
        part = m.group(2) or m.group(3)
        year = m.group(4)

        canonical = f"IS {num}"
        if part:
            canonical += f" (Part {part})"

        record = self.catalog_by_is.get(canonical) or self.catalog_by_is.get(canonical.replace(" ", ""))
        if record:
            return canonical, record

        # Also search by base standard number
        base_is = f"IS {num}"
        record = self.catalog_by_is.get(base_is) or self.catalog_by_is.get(base_is.replace(" ", ""))
        if record:
            return canonical, record

        return None


class FAQMatcher:
    """
    Speed Gate Verbatim FAQ Matcher (Canonical Spec §3.1).
    Matches incoming query against official BIS FAQs. Returns official answer and source link in < 200 ms.
    """

    def __init__(self, faqs_file: Optional[Path] = None):
        settings = get_settings()
        self.faqs_file = faqs_file or (settings.data_dir / "seed" / "faqs.json")
        self.faqs: List[Dict[str, Any]] = []
        self._load_faqs()

    def _load_faqs(self):
        if self.faqs_file and self.faqs_file.exists():
            try:
                with open(self.faqs_file, "r", encoding="utf-8") as f:
                    self.faqs = json.load(f)
            except Exception:
                pass

    @staticmethod
    def _tokenize(text: str) -> Set[str]:
        words = re.findall(r"\b[a-zA-Z0-9]{3,}\b", text.lower())
        # Filter basic stop words
        stopwords = {"what", "is", "the", "how", "to", "for", "and", "or", "in", "of", "can", "does", "bis", "are"}
        return set(w for w in words if w not in stopwords)

    def match(self, query: str, threshold: float = 0.65) -> Optional[Dict[str, Any]]:
        q_tokens = self._tokenize(query)
        if len(q_tokens) < 2:
            return None

        best_faq = None
        best_sim = 0.0

        for faq in self.faqs:
            q_text = faq.get("question", "")
            f_tokens = self._tokenize(q_text)
            if not f_tokens:
                continue

            intersection = q_tokens.intersection(f_tokens)
            union = q_tokens.union(f_tokens)
            jaccard = len(intersection) / len(union) if union else 0.0

            # Boost if query is substring or question contains most query tokens
            coverage = len(intersection) / len(q_tokens) if q_tokens else 0.0
            combined_score = 0.6 * jaccard + 0.4 * coverage

            if combined_score > best_sim:
                best_sim = combined_score
                best_faq = faq

        if best_sim >= threshold and best_faq:
            return {
                "faq_id": best_faq.get("faq_id"),
                "question": best_faq.get("question"),
                "answer": best_faq.get("answer"),
                "category": best_faq.get("category"),
                "source_url": best_faq.get("source_url", "https://www.bis.gov.in/faqs/"),
                "similarity_score": round(best_sim, 3),
            }

        return None


class GibberishDetector:
    """
    Gibberish and Random Keystroke Detector (Canonical Spec §3.1).
    Detects keyboard mashing, repeated characters, and unpronounceable strings
    to short-circuit before running expensive retrieval or LLM inference.
    """

    MASH_PATTERNS = [
        re.compile(r"[asdfghjkl]{5,}", re.IGNORECASE),
        re.compile(r"[qwertyuiop]{5,}", re.IGNORECASE),
        re.compile(r"[zxcvbnm]{5,}", re.IGNORECASE),
        re.compile(r"(.)\1{3,}", re.IGNORECASE),  # aaaa, zzzz
    ]

    VOWELS = set("aeiouAEIOU")

    def is_gibberish(self, text: str) -> Tuple[bool, Optional[str]]:
        clean = text.strip()
        if not clean:
            return True, "Empty query text."

        # Keep short valid acronyms and numbers
        if re.match(r"^(?:IS|BIS|QCO|ISI|CRS|HUID|NABL)\s*\d*$", clean, re.IGNORECASE):
            return False, None

        if len(clean) < 3:
            return True, "Query is too short to express a meaningful search."

        # Pattern-based mash check
        for pattern in self.MASH_PATTERNS:
            if pattern.search(clean):
                return True, "Query contains repetitive or keyboard-mashing character sequences."

        # Word-level consonant cluster and vowel check
        words = re.findall(r"\b[a-zA-Z]+\b", clean)
        if words:
            unpronounceable_count = 0
            for w in words:
                if len(w) >= 5:
                    vowel_count = sum(1 for ch in w if ch in self.VOWELS)
                    if vowel_count == 0:
                        unpronounceable_count += 1
                    elif (len(w) >= 7) and (vowel_count / len(w) < 0.15):
                        unpronounceable_count += 1

            if unpronounceable_count > 0 and unpronounceable_count == len(words):
                return True, "Query contains unpronounceable non-lexical words."

        # Character entropy check for random character noise
        if len(clean) >= 8:
            entropy = self._shannon_entropy(clean)
            # Extremely low entropy (e.g. repeated symbols) or unnatural dispersion
            if entropy < 1.2:
                return True, "Query exhibits abnormally low character diversity."

        return False, None

    @staticmethod
    def _shannon_entropy(s: str) -> float:
        freq = {}
        for ch in s:
            freq[ch] = freq.get(ch, 0) + 1
        entropy = 0.0
        n = len(s)
        for count in freq.values():
            p = count / n
            entropy -= p * math.log2(p)
        return entropy


class OffTopicDetector:
    """
    Off-Topic and Domain Boundary Refusal Detector (Canonical Spec §3.1).
    Detects queries clearly outside the scope of Indian Standards, BIS certification,
    regulations, quality control, laboratory testing, and hallmarking.
    """

    OFF_TOPIC_REGEXES = [
        re.compile(r"\b(?:recipe|cook\s+a|baking|how\s+to\s+make\s+biryani|pasta|curry)\b", re.IGNORECASE),
        re.compile(r"\b(?:write\s+a\s+poem|love\s+letter|joke|story\s+about|lyrics)\b", re.IGNORECASE),
        re.compile(r"\b(?:who\s+won\s+(?:the\s+)?(?:ipl|world\s+cup|match|oscar|election))\b", re.IGNORECASE),
        re.compile(r"\b(?:python\s+script\s+for|javascript\s+code\s+for|write\s+code\s+to)\b", re.IGNORECASE),
        re.compile(r"\b(?:diagnose\s+my|symptoms\s+of\s+flu|treatment\s+for\s+cough)\b", re.IGNORECASE),
        re.compile(r"\b(?:movie\s+review|celebrity\s+gossip|horoscope|astrology)\b", re.IGNORECASE),
        re.compile(r"\b(?:how\s+to\s+hack|bypass\s+password|ddos\s+attack|exploit)\b", re.IGNORECASE),
    ]

    def is_off_topic(self, text: str) -> Tuple[bool, Optional[str]]:
        for rx in self.OFF_TOPIC_REGEXES:
            if rx.search(text):
                return (
                    True,
                    "BISVEDA is a dedicated sovereign assistant for Bureau of Indian Standards (BIS), "
                    "Indian Standards specifications, QCOs, certification, and lab testing. "
                    "This query is outside the BIS compliance and standards domain.",
                )
        return False, None
