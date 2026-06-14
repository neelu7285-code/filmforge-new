"""
LLM Client - Abstraction layer for AI model integration.

Supports OpenAI, Anthropic Claude, and a mock provider for testing.
Handles prompt construction, API calls, rate limiting, and error handling.

Configuration is read from environment variables and the shared YAML configs.
"""

from __future__ import annotations

import os
import json
import logging
import re
from enum import Enum
from typing import Any

import yaml

logger = logging.getLogger(__name__)


# ─── Provider Enum ─────────────────────────────────────────────────────────────

class LLMProvider(str, Enum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    MOCK = "mock"


# ─── Shared Configuration ──────────────────────────────────────────────────────

def _load_config() -> dict[str, Any]:
    """Load shared AI configuration from the shared directory."""
    config_paths = [
        "/home/team/shared/ai-prompts/screenplay-config.yaml",
        "screenplay-config.yaml",
    ]
    for path in config_paths:
        try:
            with open(path) as f:
                return yaml.safe_load(f)
        except (FileNotFoundError, OSError):
            continue
    logger.warning("No config file found, using defaults")
    return {}


def _load_prompts() -> dict[str, str]:
    """Load shared prompt templates from the shared directory."""
    prompts_paths = [
        "/home/team/shared/ai-prompts/screenplay-breakdown-prompts.yaml",
        "screenplay-breakdown-prompts.yaml",
    ]
    for path in prompts_paths:
        try:
            with open(path) as f:
                data = yaml.safe_load(f)
                return {k: v for k, v in data.items() if isinstance(v, str)}
        except (FileNotFoundError, OSError):
            continue
    logger.warning("No prompts file found, using built-in fallbacks")
    return {}


# ─── Client ────────────────────────────────────────────────────────────────────

class LLMClient:
    """
    Unified client for LLM API calls.

    Usage:
        client = LLMClient()
        result = client.analyze(prompt_template, script_text)
    """

    def __init__(self):
        config = _load_config()
        prompts = _load_prompts()
        self.prompts = prompts

        # Determine provider from environment or config
        provider_str = os.getenv("LLM_PROVIDER", "").lower()
        if not provider_str:
            provider_str = config.get("llm", {}).get("default_provider", "mock")

        self.provider = LLMProvider(provider_str)

        # Provider-specific config (defaults for mock provider)
        llm_config = config.get("llm", {})
        self.model = "mock"
        self.api_key = ""
        if self.provider == LLMProvider.OPENAI:
            self.model = os.getenv("OPENAI_MODEL") or llm_config.get("openai", {}).get("model", "gpt-4o-mini")
            self.api_key = os.getenv("OPENAI_API_KEY", "")
        elif self.provider == LLMProvider.ANTHROPIC:
            self.model = os.getenv("ANTHROPIC_MODEL") or llm_config.get("anthropic", {}).get("model", "claude-3-haiku-20240307")
            self.api_key = os.getenv("ANTHROPIC_API_KEY", "")

        self.temperature = float(os.getenv("LLM_TEMPERATURE", str(llm_config.get("openai", {}).get("temperature", 0.3))))
        self.max_tokens = int(os.getenv("LLM_MAX_TOKENS", str(llm_config.get("openai", {}).get("max_tokens", 4096))))

        logger.info(f"LLMClient initialized with provider={self.provider.value} model={self.model}")

    def is_available(self) -> bool:
        """Check if the LLM provider is available (has API key)."""
        if self.provider == LLMProvider.MOCK:
            return True
        return bool(self.api_key)

    def analyze(self, prompt_key: str, script_text: str, max_retries: int = 2) -> dict[str, Any]:
        """
        Analyze screenplay text using the specified prompt template.

        Args:
            prompt_key: Key of the prompt template to use (e.g., "scene_breakdown_prompt")
            script_text: The screenplay text to analyze
            max_retries: Number of retries on API failure

        Returns:
            Parsed JSON response from the LLM

        Raises:
            ValueError: If prompt_key is not found
            RuntimeError: If all API calls fail
        """
        if prompt_key not in self.prompts:
            raise ValueError(f"Unknown prompt key: {prompt_key}. Available: {list(self.prompts.keys())}")

        system_prompt = self.prompts[prompt_key]

        if self.provider == LLMProvider.MOCK:
            return self._mock_analysis(prompt_key, script_text)

        if self.provider == LLMProvider.OPENAI:
            return self._call_openai(system_prompt, script_text, max_retries)

        if self.provider == LLMProvider.ANTHROPIC:
            return self._call_anthropic(system_prompt, script_text, max_retries)

        raise RuntimeError(f"Unsupported provider: {self.provider}")

    def analyze_with_prompt(self, system_prompt: str, user_text: str, max_retries: int = 2) -> dict[str, Any]:
        """
        Analyze text with a custom system prompt (not from the prompt library).

        Args:
            system_prompt: The system prompt text
            user_text: The user's input text
            max_retries: Number of retries

        Returns:
            Parsed JSON response
        """
        if self.provider == LLMProvider.MOCK:
            return {"analysis_type": "custom", "note": "Mock provider - no actual LLM call", "data": {"prompt_preview": system_prompt[:200]}}

        if self.provider == LLMProvider.OPENAI:
            return self._call_openai(system_prompt, user_text, max_retries)

        if self.provider == LLMProvider.ANTHROPIC:
            return self._call_anthropic(system_prompt, user_text, max_retries)

        raise RuntimeError(f"Unsupported provider: {self.provider}")

    # ─── Provider Implementations ──────────────────────────────────────────────

    def _call_openai(self, system_prompt: str, user_text: str, max_retries: int) -> dict[str, Any]:
        """Call OpenAI API."""
        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_text},
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content
            return json.loads(content)
        except Exception as e:
            logger.error(f"OpenAI API call failed: {e}")
            if max_retries > 0:
                return self._call_openai(system_prompt, user_text, max_retries - 1)
            raise RuntimeError(f"OpenAI API call failed after retries: {e}")

    def _call_anthropic(self, system_prompt: str, user_text: str, max_retries: int) -> dict[str, Any]:
        """Call Anthropic Claude API."""
        try:
            from anthropic import Anthropic
            client = Anthropic(api_key=self.api_key)
            response = client.messages.create(
                model=self.model,
                system=system_prompt,
                messages=[{"role": "user", "content": user_text}],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
            )
            content = response.content[0].text if response.content else "{}"
            # Extract JSON from response (Claude sometimes wraps in markdown)
            json_match = self._extract_json(content)
            return json.loads(json_match)
        except Exception as e:
            logger.error(f"Anthropic API call failed: {e}")
            if max_retries > 0:
                return self._call_anthropic(system_prompt, user_text, max_retries - 1)
            raise RuntimeError(f"Anthropic API call failed after retries: {e}")

    def _mock_analysis(self, prompt_key: str, script_text: str) -> dict[str, Any]:
        """
        Mock analysis - returns template-structured mock data.
        Used when no LLM API key is configured (for development/testing).
        """
        from .parser import parse_screenplay

        parsed = parse_screenplay(script_text)

        if prompt_key == "scene_breakdown_prompt":
            scenes_data = []
            for i, scene in enumerate(parsed.scenes):
                scenes_data.append({
                    "scene_number": scene.scene_number,
                    "header": scene.header,
                    "setting": scene.setting or "INT",
                    "location": scene.location or "Unknown",
                    "time_of_day": scene.time_of_day or "DAY",
                    "characters": scene.characters if scene.characters else parsed.all_characters[:3],
                    "props": [],
                    "costumes": [],
                    "vehicles": [],
                    "animals": [],
                    "crowd_requirements": [],
                    "vfx_requirements": [],
                    "synopsis": f"Scene {scene.scene_number}",
                    "page_count_estimate": 1.0,
                })
            return {"scenes": scenes_data}

        if prompt_key == "character_extraction_prompt":
            return [
                {
                    "name": char,
                    "age_range": "20-40",
                    "description": f"A character in the screenplay",
                    "cast_type": "supporting",
                    "dialogue_count": 0,
                    "scenes_appeared": [s.scene_number for s in parsed.scenes],
                }
                for char in parsed.all_characters
            ]

        if prompt_key == "dialogue_extraction_prompt":
            dialogue = []
            for scene in parsed.scenes:
                for dl in scene.dialogue_lines:
                    dialogue.append({
                        "character": dl["character"],
                        "text": dl["text"],
                        "parenthetical": dl.get("parenthetical", ""),
                        "scene_number": scene.scene_number,
                    })
            return {"dialogue": dialogue}

        if prompt_key == "continuity_detection_prompt":
            return {"issues": [], "summary": "No continuity issues detected (mock analysis)."}

        if prompt_key == "budget_estimation_prompt":
            return {
                "total_range_low": 50000.0,
                "total_range_high": 150000.0,
                "currency": "USD",
                "above_the_line": {"cast": 25000.0, "director": 10000.0},
                "below_the_line": {"crew": 20000.0, "equipment": 15000.0, "locations": 10000.0},
                "post_production": {"editing": 8000.0, "sound": 5000.0, "color": 3000.0},
                "contingency_percentage": 10.0,
                "shooting_days_estimate": max(1, len(parsed.scenes) // 3),
                "crew_size_estimate": 15,
            }

        return {"result": f"Mock analysis for {prompt_key}", "characters": parsed.all_characters}

    # ─── Utility ───────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_json(text: str) -> str:
        """Extract JSON object/array from text that may contain markdown or other text."""
        # Try to find JSON between ``` markers first
        code_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
        if code_match:
            return code_match.group(1).strip()

        # Try to find a top-level JSON object or array
        for start_char, end_char in [('{', '}'), ('[', ']')]:
            start = text.find(start_char)
            if start >= 0:
                # Find matching end bracket
                depth = 0
                for i in range(start, len(text)):
                    if text[i] == start_char:
                        depth += 1
                    elif text[i] == end_char:
                        depth -= 1
                        if depth == 0:
                            return text[start:i + 1]
        return text