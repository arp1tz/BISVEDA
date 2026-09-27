from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple

import httpx

from bisveda.config.settings import get_settings
from bisveda.contracts.adjudication import ApplicabilityClass, KnowledgeTier
from bisveda.contracts.evidence import EvidenceClass, EvidencePackage
from bisveda.contracts.slots import SlotSchema
from bisveda.generation.evidence_only import EvidenceOnlySynthesizer


def load_env_file(env_path: Optional[Path] = None):
    """
    Utility to load environment variables from .env if present.
    """
    if not env_path:
        repo_root = Path(__file__).resolve().parents[4]
        candidates = [repo_root / ".env", repo_root / "prototype" / ".env"]
        for c in candidates:
            if c.exists():
                env_path = c
                break

    if env_path and env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
        except Exception:
            pass


load_env_file()


class MultiProviderLLMClient:
    """
    Multi-Provider LLM Client for BISVEDA V8 (Rule 2, Rule 6, D40).
    Reads GROQ_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY with ordered fallback
    and terminal fallback to EvidenceOnlySynthesizer.
    Guarantees strict conformance to SlotSchema (0 decision fields).
    """

    def __init__(self):
        self.settings = get_settings()
        self.evidence_synthesizer = EvidenceOnlySynthesizer()
        load_env_file()

    def _get_api_keys(self) -> Dict[str, Optional[str]]:
        return {
            "groq": os.getenv("GROQ_API_KEY"),
            "openai": os.getenv("OPENAI_API_KEY"),
            "anthropic": os.getenv("ANTHROPIC_API_KEY"),
            "gemini": os.getenv("GEMINI_API_KEY"),
            "ollama_url": os.getenv("OLLAMA_BASE_URL"),
        }

    def _build_prompt_context(self, pkg: EvidencePackage) -> Tuple[str, str]:
        """
        Builds grounded system and user prompt with authorized citable items.
        """
        adj = pkg.adjudication
        citable_lines = []
        for item in pkg.citable_evidence:
            if item.evidence_class == EvidenceClass.OFFICIAL_SOURCE:
                citable_lines.append(f"[{item.sid}] ({item.locator}): {item.snippet}")

        citable_block = "\n".join(citable_lines) if citable_lines else "None (Tier A catalogue record only)"

        cand_lines = []
        for c in adj.candidates:
            cand_lines.append(
                f"- Standard: {c.is_number} (Applicability: {c.applicability.value}, Tier: {c.tier.value})"
            )
        cand_block = "\n".join(cand_lines) if cand_lines else "No direct candidate standards."

        system_prompt = (
            "You are BISVEDA, the Sovereign AI Assistant for the Bureau of Indian Standards (BIS).\n"
            "You provide legally grounded regulatory guidance for Indian Standards, Quality Control Orders (QCOs), "
            "laboratory testing, and certification schemes (Scheme-I, MSME 30-Day fast track).\n\n"
            "CRITICAL STATUTORY RULES:\n"
            "1. You MUST synthesize answers STRICTLY based on the provided authorized evidence ledger.\n"
            "2. You MUST cite evidence using ONLY the provided markers [S1], [S2], etc. inline in your prose.\n"
            "3. Do NOT invent new standard numbers, regulatory orders, or citation markers.\n"
            "4. For Tier A standards, DO NOT assert proprietary numeric test limits.\n"
            "5. Micro, Small, and Medium Enterprises (MSMEs) and Startups receive an 80% fee concession on Scheme-I.\n"
            "6. You MUST return ONLY a JSON object adhering to the SlotSchema with keys:\n"
            "   - 'summary': 2-5 sentence narrative synthesis connecting the applicable standard, QCO, and certification.\n"
            "   - 'why_explanations': mapping of standard_id (or IS number) to prose explanation of why it applies.\n"
            "   - 'step_explanations': list of prose explanations for the 4-step certification roadmap.\n"
            "   - 'next_action_guidance': clear actionable guidance for immediate next steps.\n"
        )

        user_prompt = (
            f"User Query: '{pkg.original_query}'\n"
            f"Target Market: {pkg.entities.get('market', 'domestic')}, User Persona: {pkg.entities.get('user_type', 'msme')}\n\n"
            f"AUTHORIZED CANDIDATE STANDARDS:\n{cand_block}\n\n"
            f"AUTHORIZED CITABLE EVIDENCE LEDGER:\n{citable_block}\n\n"
            "Output your response strictly as valid JSON adhering to SlotSchema."
        )

        return system_prompt, user_prompt

    def _build_fallback_slots(self, pkg: EvidencePackage) -> SlotSchema:
        """
        Builds a compliant SlotSchema using deterministic evidence-only logic.
        """
        adj = pkg.adjudication
        raw_text = self.evidence_synthesizer.synthesize(pkg)

        top_cand = adj.candidates[0] if adj.candidates else None
        top_std = top_cand.is_number if top_cand else "Standard"

        citable_top = next((item for item in pkg.citable_evidence if top_cand and item.standard_id == top_cand.standard_id), None)
        cit_tag = f"[{citable_top.sid}]" if citable_top else ""

        why_dict = {}
        if top_cand:
            why_dict[top_cand.standard_id] = (
                f"{top_cand.is_number} {cit_tag} directly covers the product specifications, safety requirements, "
                f"and mandatory quality parameters established by the Bureau of Indian Standards."
            )

        steps = [
            "Step 1: Set up in-house testing equipment and quality control processes per the Scheme of Testing and Inspection (STI).",
            "Step 2: Submit an online Form-I application through the BIS Manak Online portal (https://www.manakonline.in).",
            "Step 3: Undergo factory inspection by BIS auditor and independent sample draw for accredited lab testing.",
            "Step 4: Grant of BIS ISI Mark license (CM/L number) within 30 days under the MSME simplified fast-track route.",
        ]

        next_action = (
            f"Verify your in-house lab test equipment against the standard test plan for {top_std}, "
            "prepare your Udyam registration certificate to claim the 80% fee subsidy, and file Form-I on Manak Online."
        )

        return SlotSchema(
            summary=raw_text,
            why_explanations=why_dict,
            step_explanations=steps,
            next_action_guidance=next_action,
        )

    def _slots_to_prose(self, slots: SlotSchema) -> str:
        """
        Formats SlotSchema slots into coherent, compliant markdown text.
        """
        sections: List[str] = [slots.summary]

        if slots.why_explanations:
            why_lines = [f"- **{k}**: {v}" for k, v in slots.why_explanations.items()]
            sections.append("**Standard Applicability Rationale**:\n" + "\n".join(why_lines))

        if slots.step_explanations:
            step_lines = [f"{idx+1}. {step}" for idx, step in enumerate(slots.step_explanations)]
            sections.append("**Licensing & Certification Roadmap**:\n" + "\n".join(step_lines))

        if slots.next_action_guidance:
            sections.append(f"**Immediate Next Actions**:\n{slots.next_action_guidance}")

        return "\n\n".join(sections)

    def _call_groq(self, system_prompt: str, user_prompt: str, api_key: str) -> Optional[SlotSchema]:
        model = os.getenv("HOSTED_PRIMARY_MODEL", "llama-3.3-70b-versatile")
        url = "https://api.groq.com/openai/v1/chat/completions"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "max_tokens": 1024,
        }
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                return SlotSchema(**parsed)
        return None

    def _call_openai(self, system_prompt: str, user_prompt: str, api_key: str) -> Optional[SlotSchema]:
        model = os.getenv("HOSTED_FALLBACK_MODEL", "gpt-4o-mini")
        url = "https://api.openai.com/v1/chat/completions"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.1,
            "max_tokens": 1024,
        }
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                return SlotSchema(**parsed)
        return None

    def _call_gemini(self, system_prompt: str, user_prompt: str, api_key: str) -> Optional[SlotSchema]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": f"{system_prompt}\n\n{user_prompt}"}
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.1,
                "maxOutputTokens": 1024,
            },
        }
        headers = {"Content-Type": "application/json"}
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                content = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(content)
                return SlotSchema(**parsed)
        return None

    def _call_anthropic(self, system_prompt: str, user_prompt: str, api_key: str) -> Optional[SlotSchema]:
        model = os.getenv("HOSTED_ANTHROPIC_MODEL", "claude-3-5-sonnet-20241022")
        url = "https://api.anthropic.com/v1/messages"
        payload = {
            "model": model,
            "max_tokens": 1024,
            "system": system_prompt,
            "messages": [
                {"role": "user", "content": f"{user_prompt}\n\nPlease respond strictly with valid JSON conforming to the requested SlotSchema."}
            ],
            "temperature": 0.1,
        }
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                content = data["content"][0]["text"]
                # Strip markdown code fence if present
                clean_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", content.strip(), flags=re.DOTALL)
                parsed = json.loads(clean_json)
                return SlotSchema(**parsed)
        return None

    def _call_ollama(self, system_prompt: str, user_prompt: str, base_url: str) -> Optional[SlotSchema]:
        model = os.getenv("LOCAL_MODEL", "qwen2.5:7b")
        url = f"{base_url.rstrip('/')}/api/chat"
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "format": "json",
            "stream": False,
            "options": {"temperature": 0.1},
        }
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["message"]["content"]
                parsed = json.loads(content)
                return SlotSchema(**parsed)
        return None

    def generate(self, pkg: EvidencePackage) -> Tuple[str, SlotSchema, str]:
        """
        Generates grounded prose conforming to SlotSchema.
        Tries Groq -> OpenAI -> Anthropic -> Gemini -> Ollama -> EvidenceOnlySynthesizer.
        Returns (raw_prose_text, slot_schema, provider_name).
        """
        # Scenario 1: Abstention or out of corpus -> deterministic refusal
        if pkg.adjudication.out_of_corpus or not pkg.adjudication.candidates:
            slots = self._build_fallback_slots(pkg)
            return slots.summary, slots, "evidence_only_abstention"

        # Scenario 2: Check for API keys
        keys = self._get_api_keys()
        system_prompt, user_prompt = self._build_prompt_context(pkg)

        # 1. Try Groq (if key present)
        if keys.get("groq"):
            try:
                slots = self._call_groq(system_prompt, user_prompt, keys["groq"])
                if slots:
                    return self._slots_to_prose(slots), slots, "groq"
            except Exception:
                pass

        # 2. Try OpenAI (if key present)
        if keys.get("openai"):
            try:
                slots = self._call_openai(system_prompt, user_prompt, keys["openai"])
                if slots:
                    return self._slots_to_prose(slots), slots, "openai"
            except Exception:
                pass

        # 3. Try Anthropic (if key present)
        if keys.get("anthropic"):
            try:
                slots = self._call_anthropic(system_prompt, user_prompt, keys["anthropic"])
                if slots:
                    return self._slots_to_prose(slots), slots, "anthropic"
            except Exception:
                pass

        # 4. Try Gemini (if key present)
        if keys.get("gemini"):
            try:
                slots = self._call_gemini(system_prompt, user_prompt, keys["gemini"])
                if slots:
                    return self._slots_to_prose(slots), slots, "gemini"
            except Exception:
                pass

        # 5. Try Local Ollama (if service is up)
        if keys.get("ollama_url"):
            try:
                slots = self._call_ollama(system_prompt, user_prompt, keys["ollama_url"])
                if slots:
                    return self._slots_to_prose(slots), slots, "ollama"
            except Exception:
                pass

        # 6. Terminal Fallback: Deterministic Evidence-Only (Rule 6)
        fallback_slots = self._build_fallback_slots(pkg)
        raw_text = self._slots_to_prose(fallback_slots)
        return raw_text, fallback_slots, "evidence_only"
