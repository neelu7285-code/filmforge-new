"""
Extractor - Orchestrator that combines rule-based parsing with LLM enhancement.

Pipeline:
  1. Rule-based parser extracts structural elements (scenes, dialogue, characters)
  2. LLM enhances with intelligent breakdown (props, costumes, VFX, etc.)
  3. Results are merged into comprehensive breakdown response

This module provides the main public API that the REST endpoint calls.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from .parser import ScreenplayParser, ParsedScene, ParsedScreenplay
from .llm_client import LLMClient
from .schemas import (
    ParseResponse,
    SceneResponse,
    CharacterResponse,
    BreakdownResponse,
    DialogueResponse,
    DialogueLine,
    ContinuityResponse,
    ContinuityIssue,
    BudgetResponse,
    CompareResponse,
    VersionChange,
)

logger = logging.getLogger(__name__)


class ScreenplayExtractor:
    """
    Orchestrator that extracts full pre-production breakdowns from screenplays.

    Combines rule-based parsing with optional LLM enhancement.
    """

    def __init__(self, llm_client: LLMClient | None = None):
        self.parser = ScreenplayParser()
        self.llm = llm_client or LLMClient()

    # ─── Main Public API ───────────────────────────────────────────────────────

    def parse(self, script_text: str, title: str = "") -> ParseResponse:
        """
        Parse a screenplay using rule-based parsing only.
        Fast, no API calls needed.

        Args:
            script_text: Raw screenplay text
            title: Optional project title

        Returns:
            ParseResponse with scene and character data
        """
        try:
            parsed = self.parser.parse(script_text, title)

            scenes = []
            for scene in parsed.scenes:
                char_names = self._get_scene_characters(scene, parsed)
                scenes.append(SceneResponse(
                    scene_number=scene.scene_number,
                    header=scene.header,
                    setting=scene.setting or self._infer_setting(scene.header),
                    location=scene.location or self._infer_location(scene.header),
                    time_of_day=scene.time_of_day or self._infer_time_of_day(scene.header),
                    characters=char_names,
                    synopsis="",
                    raw_text=scene.raw_text[:500] if scene.raw_text else "",
                ))

            characters = [
                CharacterResponse(
                    name=char,
                    cast_type="supporting",
                    scenes_appeared=[s.scene_number for s in parsed.scenes if char in self._get_scene_characters(s, parsed)],
                )
                for char in parsed.all_characters
            ]

            return ParseResponse(
                success=True,
                title=parsed.title,
                scenes=scenes,
                characters=characters,
                dialogue_count=sum(len(s.dialogue_lines) for s in parsed.scenes),
                total_page_estimate=parsed.estimated_pages,
            )
        except Exception as e:
            logger.exception("Parse failed")
            return ParseResponse(success=False, error=str(e))

    def breakdown(self, script_text: str, title: str = "", use_llm: bool = True) -> BreakdownResponse:
        """
        Full screenplay breakdown with optional LLM enhancement.

        Pipeline:
          1. Rule-based parse (fast)
          2. LLM-enhanced extraction (intelligent, if enabled)
          3. Merge results

        Args:
            script_text: Raw screenplay text
            title: Optional project title
            use_llm: Whether to use LLM for enhanced extraction

        Returns:
            BreakdownResponse with comprehensive breakdown data
        """
        try:
            # Step 1: Rule-based parse
            parse_result = self.parse(script_text, title)
            if not parse_result.success:
                return BreakdownResponse(success=False, error=parse_result.error)

            llm_used = False

            # Step 2: LLM enhancement
            if use_llm and self.llm.is_available():
                try:
                    llm_result = self.llm.analyze("scene_breakdown_prompt", script_text)
                    llm_characters = self.llm.analyze("character_extraction_prompt", script_text)
                    llm_used = True

                    # Merge LLM data into parse result
                    self._merge_llm_scenes(parse_result, llm_result)
                    self._merge_llm_characters(parse_result, llm_characters)
                except Exception as e:
                    logger.warning(f"LLM enhancement failed, falling back to rule-based: {e}")

            # Step 3: Build comprehensive breakdown
            props_by_scene: dict[str, list[str]] = {}
            costumes_by_scene: dict[str, list[str]] = {}
            all_locations: set[str] = set()
            all_vehicles: set[str] = set()
            all_animals: set[str] = set()
            all_vfx: set[str] = set()
            all_crowd: set[str] = set()

            for scene in parse_result.scenes:
                key = f"scene_{scene.scene_number}"
                props_by_scene[key] = scene.props
                costumes_by_scene[key] = scene.costumes
                if scene.location:
                    all_locations.add(scene.location)
                all_vehicles.update(scene.vehicles)
                all_animals.update(scene.animals)
                all_vfx.update(scene.vfx)
                all_crowd.update(scene.crowd_needs)

            return BreakdownResponse(
                success=True,
                scenes=parse_result.scenes,
                characters=parse_result.characters,
                dialogue=self._extract_dialogue(script_text) if not llm_used else None,
                props_by_scene=props_by_scene,
                locations=sorted(all_locations),
                costumes_by_scene=costumes_by_scene,
                vehicles_needed=sorted(all_vehicles),
                animals_needed=sorted(all_animals),
                vfx_needed=sorted(all_vfx),
                crowd_needs=sorted(all_crowd),
                total_scenes=len(parse_result.scenes),
                total_characters=len(parse_result.characters),
                total_dialogue_lines=parse_result.dialogue_count,
                estimated_pages=parse_result.total_page_estimate,
                llm_used=llm_used,
            )
        except Exception as e:
            logger.exception("Breakdown failed")
            return BreakdownResponse(success=False, error=str(e))

    def extract_dialogue(self, script_text: str) -> DialogueResponse:
        """Extract all dialogue from a screenplay."""
        return self._extract_dialogue(script_text)

    def detect_continuity(self, script_text: str) -> ContinuityResponse:
        """Detect potential continuity issues using LLM."""
        try:
            if self.llm.is_available():
                result = self.llm.analyze("continuity_detection_prompt", script_text)
                issues = []
                for issue_data in result.get("issues", []):
                    issues.append(ContinuityIssue(
                        severity=issue_data.get("severity", "info"),
                        category=issue_data.get("category", "general"),
                        description=issue_data.get("description", ""),
                        scene_a=issue_data.get("scene_a"),
                        scene_b=issue_data.get("scene_b"),
                        suggestion=issue_data.get("suggestion", ""),
                    ))
                return ContinuityResponse(
                    issues=issues,
                    summary=result.get("summary", ""),
                )
            else:
                # Rule-based continuity check (basic)
                parsed = self.parser.parse(script_text)
                issues = self._basic_continuity_check(parsed)
                return ContinuityResponse(
                    issues=issues,
                    summary=f"Found {len(issues)} potential issues (rule-based analysis)",
                )
        except Exception as e:
            logger.exception("Continuity detection failed")
            return ContinuityResponse(issues=[], summary=f"Error: {e}")

    def estimate_budget(self, breakdown_data: dict[str, Any]) -> BudgetResponse:
        """Estimate production budget from breakdown data."""
        try:
            if self.llm.is_available():
                budget_request = {
                    "total_scenes": breakdown_data.get("total_scenes", 0),
                    "total_characters": breakdown_data.get("total_characters", 0),
                    "total_dialogue_lines": breakdown_data.get("total_dialogue_lines", 0),
                    "estimated_pages": breakdown_data.get("estimated_pages", 0),
                    "locations": breakdown_data.get("locations", []),
                    "vehicles_needed": breakdown_data.get("vehicles_needed", []),
                    "vfx_needed": breakdown_data.get("vfx_needed", []),
                    "crowd_needs": breakdown_data.get("crowd_needs", []),
                }
                result = self.llm.analyze_with_prompt(
                    "You are a film budget estimator. Return a JSON budget breakdown.",
                    json.dumps(budget_request),
                )
                return BudgetResponse(
                    total_range_low=result.get("total_range_low", 50000),
                    total_range_high=result.get("total_range_high", 150000),
                    currency=result.get("currency", "USD"),
                    above_the_line=result.get("above_the_line", {}),
                    below_the_line=result.get("below_the_line", {}),
                    post_production=result.get("post_production", {}),
                    contingency_percentage=result.get("contingency_percentage", 10),
                    shooting_days_estimate=result.get("shooting_days_estimate", 5),
                    crew_size_estimate=result.get("crew_size_estimate", 10),
                )
            else:
                scenes = breakdown_data.get("total_scenes", 0)
                chars = breakdown_data.get("total_characters", 0)
                locations = len(breakdown_data.get("locations", []))

                base_budget = 10000 + (scenes * 2000) + (chars * 500) + (locations * 3000)
                return BudgetResponse(
                    total_range_low=float(base_budget),
                    total_range_high=float(base_budget * 2.5),
                    shooting_days_estimate=max(1, scenes // 3),
                    crew_size_estimate=max(5, 10 + chars),
                )
        except Exception as e:
            logger.exception("Budget estimation failed")
            return BudgetResponse(total_range_low=0, total_range_high=0, shooting_days_estimate=0, crew_size_estimate=0)

    def compare_versions(self, script_a: str, script_b: str, title_a: str = "", title_b: str = "") -> CompareResponse:
        """Compare two screenplay versions."""
        try:
            parsed_a = self.parser.parse(script_a, title_a)
            parsed_b = self.parser.parse(script_b, title_b)

            changes: list[VersionChange] = []
            scenes_a = {s.header: s for s in parsed_a.scenes}
            scenes_b = {s.header: s for s in parsed_b.scenes}

            headers_a = set(scenes_a.keys())
            headers_b = set(scenes_b.keys())

            added = headers_b - headers_a
            removed = headers_a - headers_b
            common = headers_a & headers_b

            for header in added:
                changes.append(VersionChange(type="added", description=f"Scene added: {header}", details=""))
                changes[-1].description = f"Scene added: {header}"

            for header in removed:
                changes.append(VersionChange(type="removed", description=f"Scene removed: {header}", details=""))

            # Check for modified scenes (same header, different content)
            for header in common:
                scene_a = scenes_a[header]
                scene_b = scenes_b[header]
                if scene_a.raw_text != scene_b.raw_text:
                    changes.append(VersionChange(type="modified", description=f"Scene modified: {header}", details="Content differs between versions"))

            # Character changes
            chars_a = set(parsed_a.all_characters)
            chars_b = set(parsed_b.all_characters)
            chars_added = sorted(chars_b - chars_a)
            chars_removed = sorted(chars_a - chars_b)

            page_diff = round(parsed_b.estimated_pages - parsed_a.estimated_pages, 1)

            summary_parts = []
            if added:
                summary_parts.append(f"{len(added)} scenes added")
            if removed:
                summary_parts.append(f"{len(removed)} scenes removed")
            if len(common) != len(headers_a):
                summary_parts.append(f"{len(common)} scenes unchanged")
            if chars_added:
                summary_parts.append(f"{len(chars_added)} characters added")
            if chars_removed:
                summary_parts.append(f"{len(chars_removed)} characters removed")

            summary = "; ".join(summary_parts) if summary_parts else "No significant changes detected"

            return CompareResponse(
                changes=changes,
                scenes_added=sorted(added),
                scenes_removed=sorted(removed),
                characters_added=chars_added,
                characters_removed=chars_removed,
                page_count_change=page_diff,
                summary=summary,
            )
        except Exception as e:
            logger.exception("Version comparison failed")
            return CompareResponse(summary=f"Error: {e}")

    # ─── Internal Helpers ──────────────────────────────────────────────────────

    def _get_scene_characters(self, scene: ParsedScene, parsed: ParsedScreenplay) -> list[str]:
        """Get character names appearing in a scene."""
        chars = set()
        for dl in scene.dialogue_lines:
            if dl["character"]:
                chars.add(dl["character"])
        return sorted(chars)

    def _infer_setting(self, header: str) -> str:
        """Infer INT/EXT from scene header."""
        import re
        match = re.search(r'\b(INT\.?\s*/?\s*EXT\.?|INT\.?|EXT\.?|I\.?\s*/\s*E\.?)\b', header, re.IGNORECASE)
        if match:
            val = match.group(1).upper()
            if '/' in val or 'I/E' in val:
                return "INT/EXT"
            return "INT" if "INT" in val else "EXT"
        return ""

    def _infer_location(self, header: str) -> str:
        """Extract location from scene header."""
        import re
        # Strip the INT/EXT prefix
        header_clean = re.sub(r'^(INT\.?\s*/?\s*EXT\.?|INT\.?|EXT\.?|I\.?\s*/\s*E\.?)\s+', '', header, flags=re.IGNORECASE)
        # Strip time suffix
        header_clean = re.sub(r'\s*[-–—]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|LATER|CONTINUOUS).*$', '', header_clean, flags=re.IGNORECASE)
        return header_clean.strip()

    def _infer_time_of_day(self, header: str) -> str:
        """Infer time of day from scene header."""
        import re
        match = re.search(r'(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|LATER|CONTINUOUS|SUNRISE|SUNSET)', header, re.IGNORECASE)
        if match:
            return match.group(1).upper()
        return ""

    def _merge_llm_scenes(self, parse_result: ParseResponse, llm_result: dict[str, Any]):
        """Merge LLM scene breakdown into parse result."""
        llm_scenes = llm_result.get("scenes", [])
        if not llm_scenes:
            return

        # Match LLM scenes to parsed scenes by scene number
        llm_by_number = {}
        for s in llm_scenes:
            num = s.get("scene_number", 0)
            llm_by_number[num] = s

        for scene in parse_result.scenes:
            llm_data = llm_by_number.get(scene.scene_number) or llm_by_number.get(len(parse_result.scenes) - scene.scene_number)
            if llm_data:
                if scene.location == "" and llm_data.get("location"):
                    scene.location = llm_data["location"]
                if scene.setting == "" and llm_data.get("setting"):
                    scene.setting = llm_data["setting"]
                if scene.time_of_day == "" and llm_data.get("time_of_day"):
                    scene.time_of_day = llm_data["time_of_day"]

                # Props, costumes, VFX from LLM
                scene.props = list(set(scene.props + llm_data.get("props", [])))
                scene.costumes = list(set(scene.costumes + llm_data.get("costumes", [])))
                scene.vfx = list(set(scene.vfx + llm_data.get("vfx_requirements", [])))
                scene.vehicles = list(set(scene.vehicles + llm_data.get("vehicles", [])))
                scene.animals = list(set(scene.animals + llm_data.get("animals", [])))
                scene.crowd_needs = list(set(scene.crowd_needs + llm_data.get("crowd_requirements", [])))

                if llm_data.get("synopsis") and not scene.synopsis:
                    scene.synopsis = llm_data["synopsis"]

    def _merge_llm_characters(self, parse_result: ParseResponse, llm_characters: list[dict[str, Any]]):
        """Merge LLM character data into parse result."""
        if not isinstance(llm_characters, list):
            return

        llm_char_map = {}
        for char_data in llm_characters:
            name = char_data.get("name", "")
            if name:
                llm_char_map[name.upper()] = char_data

        for char_resp in parse_result.characters:
            llm_data = llm_char_map.get(char_resp.name.upper())
            if llm_data:
                char_resp.age_range = llm_data.get("age_range", "")
                char_resp.description = llm_data.get("description", "")
                char_resp.cast_type = llm_data.get("cast_type", "supporting")
                char_resp.dialogue_count = llm_data.get("dialogue_count", 0)

    def _extract_dialogue(self, script_text: str) -> DialogueResponse:
        """Extract dialogue using rule-based parser."""
        parsed = self.parser.parse(script_text)
        dialogue_lines: list[DialogueLine] = []
        by_character: dict[str, list[dict[str, Any]]] = {}

        for scene in parsed.scenes:
            for dl in scene.dialogue_lines:
                line = DialogueLine(
                    character=dl["character"],
                    text=dl["text"],
                    parenthetical=dl.get("parenthetical", ""),
                    scene_number=scene.scene_number,
                )
                dialogue_lines.append(line)

                if dl["character"] not in by_character:
                    by_character[dl["character"]] = []
                by_character[dl["character"]].append({
                    "text": dl["text"],
                    "parenthetical": dl.get("parenthetical", ""),
                    "scene_number": scene.scene_number,
                })

        return DialogueResponse(
            dialogue=dialogue_lines,
            dialogue_by_character=by_character,
        )

    def _basic_continuity_check(self, parsed: ParsedScreenplay) -> list[ContinuityIssue]:
        """Basic rule-based continuity checks."""
        issues: list[ContinuityIssue] = []

        # Check 1: Characters appearing in non-sequential scenes without reintroduction
        for char_name in parsed.all_characters:
            scene_appearances = []
            for scene in parsed.scenes:
                for dl in scene.dialogue_lines:
                    if dl["character"] == char_name:
                        scene_appearances.append(scene.scene_number)
                        break

            if len(scene_appearances) > 1:
                gaps = []
                for i in range(len(scene_appearances) - 1):
                    diff = scene_appearances[i + 1] - scene_appearances[i]
                    if diff > 5:
                        gaps.append((scene_appearances[i], scene_appearances[i + 1]))
                for gap in gaps:
                    issues.append(ContinuityIssue(
                        severity="info",
                        category="character",
                        description=f"Character '{char_name}' disappears between scenes {gap[0]} and {gap[1]} (gap of {gap[1] - gap[0]} scenes)",
                        scene_a=gap[0],
                        scene_b=gap[1],
                        suggestion="Consider whether the character's absence is intentional",
                    ))

        return issues