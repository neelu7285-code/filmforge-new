"""Pydantic schemas for the Screenplay Parser service.

These define the data contract between the AI service and the backend.
Matches the database schema in /home/team/shared/DATABASE_SCHEMA.md
"""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


# ─── Request Schemas ───────────────────────────────────────────────────────────

class ParseRequest(BaseModel):
    """Request to parse a screenplay."""
    script_text: str = Field(..., description="Raw screenplay text content")
    script_filename: str | None = Field(None, description="Original filename if uploaded")
    title: str | None = Field(None, description="Project title")
    project_id: str | None = Field(None, description="Existing project ID if re-parsing")


class BreakdownRequest(ParseRequest):
    """Request for full intelligent breakdown with LLM enhancement."""
    use_llm: bool = Field(True, description="Whether to use LLM for enhanced extraction")


class DialogueRequest(BaseModel):
    """Request to extract dialogue."""
    script_text: str = Field(..., description="Raw screenplay text")


class CompareRequest(BaseModel):
    """Request to compare two screenplay versions."""
    script_a: str = Field(..., description="First screenplay version")
    script_b: str = Field(..., description="Second screenplay version")
    title_a: str | None = Field(None, description="Label for version A")
    title_b: str | None = Field(None, description="Label for version B")


class BudgetRequest(BaseModel):
    """Request for budget estimation from breakdown data."""
    breakdown_data: dict[str, Any] = Field(..., description="Full script breakdown data")


# ─── Response Schemas ──────────────────────────────────────────────────────────

class SceneResponse(BaseModel):
    """A single scene breakdown."""
    scene_number: int
    header: str
    setting: str  # INT, EXT, or INT/EXT
    location: str
    time_of_day: str  # DAY, NIGHT, DAWN, DUSK, CONTINUOUS
    characters: list[str] = []
    props: list[str] = []
    costumes: list[str] = []
    vfx: list[str] = []
    vehicles: list[str] = []
    animals: list[str] = []
    crowd_needs: list[str] = []
    synopsis: str = ""
    page_count_estimate: float = 0.0
    raw_text: str = Field("", description="Raw text of the scene for reference")


class CharacterResponse(BaseModel):
    """A character extracted from the screenplay."""
    name: str
    age_range: str = ""
    description: str = ""
    cast_type: str = "supporting"  # lead, supporting, minor, cameo
    dialogue_count: int = 0
    scenes_appeared: list[int] = []


class DialogueLine(BaseModel):
    """A single line of dialogue."""
    character: str
    text: str
    parenthetical: str = ""
    scene_number: int = 0


class DialogueResponse(BaseModel):
    """All dialogue extracted from the screenplay."""
    dialogue: list[DialogueLine] = []
    dialogue_by_character: dict[str, list[dict[str, Any]]] = {}


class ContinuityIssue(BaseModel):
    """A potential continuity issue detected."""
    severity: str = "info"  # error, warning, info
    category: str  # character, prop, time, location, costume, weather
    description: str
    scene_a: int | None = None
    scene_b: int | None = None
    suggestion: str = ""


class ContinuityResponse(BaseModel):
    """Continuity analysis results."""
    issues: list[ContinuityIssue] = []
    summary: str = ""


class BudgetResponse(BaseModel):
    """Budget estimation result."""
    total_range_low: float
    total_range_high: float
    currency: str = "USD"
    above_the_line: dict[str, float] = {}
    below_the_line: dict[str, float] = {}
    post_production: dict[str, float] = {}
    contingency_percentage: float = 10.0
    shooting_days_estimate: int = 0
    crew_size_estimate: int = 0
    breakdown: dict[str, Any] = {}


class VersionChange(BaseModel):
    """A change detected between versions."""
    type: str  # added, removed, modified
    description: str
    details: str = ""


class CompareResponse(BaseModel):
    """Screenplay version comparison result."""
    changes: list[VersionChange] = []
    scenes_added: list[str] = []
    scenes_removed: list[str] = []
    scenes_modified: list[dict[str, Any]] = []
    characters_added: list[str] = []
    characters_removed: list[str] = []
    page_count_change: int = 0
    summary: str = ""


class ParseResponse(BaseModel):
    """Response from the screenplay parser."""
    success: bool = True
    title: str = ""
    scenes: list[SceneResponse] = []
    characters: list[CharacterResponse] = []
    dialogue_count: int = 0
    total_page_estimate: float = 0.0
    error: str | None = None


class BreakdownResponse(BaseModel):
    """Full screenplay breakdown response with all extractions."""
    success: bool = True
    scenes: list[SceneResponse] = []
    characters: list[CharacterResponse] = []
    dialogue: DialogueResponse | None = None
    props_by_scene: dict[str, list[str]] = {}
    locations: list[str] = []
    costumes_by_scene: dict[str, list[str]] = {}
    vehicles_needed: list[str] = []
    animals_needed: list[str] = []
    vfx_needed: list[str] = []
    crowd_needs: list[str] = []
    total_scenes: int = 0
    total_characters: int = 0
    total_dialogue_lines: int = 0
    estimated_pages: float = 0.0
    error: str | None = None
    llm_used: bool = False