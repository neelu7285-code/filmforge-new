"""
Screenplay Parser - Rule-based screenplay text parser.

Supports:
  - Standard screenplay format (INT./EXT. headers)
  - Fountain format markup
  - Raw text / .txt files
  - Scene detection, dialogue extraction, character identification

This is the first-pass parser. Output feeds into the LLM for enhanced extraction.
"""

from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field, asdict

logger = logging.getLogger(__name__)


# ─── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class ParsedScene:
    """A single parsed scene from the screenplay."""
    scene_number: int = 0
    header: str = ""
    setting: str = ""  # INT, EXT, INT/EXT
    location: str = ""
    time_of_day: str = ""
    raw_text: str = ""
    characters: list[str] = field(default_factory=list)
    dialogue_lines: list[dict] = field(default_factory=list)
    transitions: list[str] = field(default_factory=list)


@dataclass
class ParsedScreenplay:
    """Full parsed screenplay result."""
    title: str = ""
    scenes: list[ParsedScene] = field(default_factory=list)
    all_characters: list[str] = field(default_factory=list)
    raw_text: str = ""
    estimated_pages: float = 0.0


# ─── Regex Patterns ────────────────────────────────────────────────────────────

SCENE_HEADER_RE = re.compile(
    r'^(?P<number>\d+\.?)?\s*'
    r'(?P<setting>INT\.?\s*/?\s*EXT\.?|INT\.?|EXT\.?|I\.?\s*/\s*E\.?)'
    r'\s+(?P<location>.+?)'
    r'(?:\s*[-–—]\s*(?P<time>DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|LATER|CONTINUOUS|MOMENTS?\s+LATER|THE\s+NEXT\s+\w+|SUNRISE|SUNSET|FLASHBACK|DARK|LIGHT))?\s*$',
    re.IGNORECASE
)

ALT_SCENE_RE = re.compile(r'^SCENE\s+(\d+)[.:]?\s*(.*)$', re.IGNORECASE)

CHARACTER_CUE_RE = re.compile(r'^([A-Z][A-Z\s\-\.\']{1,49}?)(?:\s*\(.*\))?\s*$')

PARENTHETICAL_RE = re.compile(r'^\s*\(.*\)\s*$')

TRANSITION_RE = re.compile(
    r'^(FADE\s+(IN|OUT)|CUT\s+TO|DISSOLVE\s+TO|SMASH\s+CUT\s+TO|MATCH\s+CUT\s+TO|JUMP\s+CUT\s+TO|FADE\s+TO\s+BLACK|IRIS\s+(IN|OUT)|TIME\s+CUT|FADE\s+INTO)\s*[.:]?\s*$',
    re.IGNORECASE
)

FOUNTAIN_HEADING_RE = re.compile(r'^\.([A-Z].*)$')
FOUNTAIN_TRANSITION_RE = re.compile(r'^>(.*)<\s*$')
BLANK_LINE_RE = re.compile(r'^\s*$')
PAGE_BREAK_RE = re.compile(r'^={3,}\s*$')
SETTING_RE = re.compile(r'\b(INT\.?\s*/?\s*EXT\.?|INT\.?|EXT\.?|I\.?\s*/\s*E\.?)\b', re.IGNORECASE)
TIME_RE = re.compile(r'\b(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|LATER|SUNRISE|SUNSET|CONTINUOUS|FLASHBACK)\b', re.IGNORECASE)


# ─── Parser ────────────────────────────────────────────────────────────────────

class ScreenplayParser:
    """
    Parses screenplay text into structured scenes, characters, and dialogue.
    Handles standard screenplay format and Fountain markup.
    """

    def __init__(self):
        self.scenes: list[ParsedScene] = []
        self._current_scene: ParsedScene | None = None
        self._in_dialogue = False
        self._last_character: str | None = None
        self._all_dialogue_characters: set[str] = set()

    def parse(self, text: str, title: str = "") -> ParsedScreenplay:
        self.scenes = []
        self._current_scene = None
        self._in_dialogue = False
        self._last_character = None
        self._all_dialogue_characters = set()

        lines = text.split('\n')
        i = 0
        line_count = len(lines)

        while i < line_count:
            raw_line = lines[i]
            line = raw_line.strip()
            line_num = i + 1

            if BLANK_LINE_RE.match(line) or PAGE_BREAK_RE.match(line):
                self._finalize_dialogue_block()
                i += 1
                continue

            if self._is_scene_header(line, line_num):
                is_header, header_data = self._parse_scene_header(line)
                if is_header and header_data:
                    self._start_new_scene(header_data, raw_line)
                    i += 1
                    continue

            if self._is_transition(line):
                self._handle_transition(line)
                i += 1
                continue

            if self._is_dialogue_cue(line, lines, i, line_count):
                self._handle_dialogue_cue(line)
                i += 1
                continue

            if self._in_dialogue and PARENTHETICAL_RE.match(line):
                if self._current_scene and self._last_character:
                    if self._current_scene.dialogue_lines:
                        parenthetical = line.strip("() ")
                        self._current_scene.dialogue_lines[-1]["parenthetical"] = parenthetical
                i += 1
                continue

            if self._in_dialogue and line and not PARENTHETICAL_RE.match(line):
                if self._current_scene and self._last_character:
                    self._current_scene.dialogue_lines.append({
                        "character": self._last_character,
                        "text": line,
                        "parenthetical": "",
                    })
                i += 1
                continue

            if self._current_scene:
                self._current_scene.raw_text += raw_line + "\n"
            i += 1

        if self._current_scene:
            self.scenes.append(self._current_scene)

        result = ParsedScreenplay(
            title=title or self._guess_title(text),
            scenes=self.scenes,
            all_characters=sorted(self._all_dialogue_characters),
            raw_text=text,
            estimated_pages=self._estimate_pages(text),
        )
        return result

    # ─── Internal helpers ──────────────────────────────────────────────────────

    def _is_scene_header(self, line: str, line_num: int) -> bool:
        if FOUNTAIN_HEADING_RE.match(line):
            return True
        if SCENE_HEADER_RE.match(line):
            return True
        if ALT_SCENE_RE.match(line):
            return True
        return False

    def _parse_scene_header(self, line: str) -> tuple[bool, dict | None]:
        fountain_match = FOUNTAIN_HEADING_RE.match(line)
        if fountain_match:
            inner = fountain_match.group(1).strip()
            header_match = SCENE_HEADER_RE.match(inner)
            if header_match:
                return True, header_match.groupdict()
            else:
                return True, {"number": None, "setting": "", "location": inner, "time": None}

        header_match = SCENE_HEADER_RE.match(line)
        if header_match:
            data = header_match.groupdict()
            if data.get("number"):
                data["number"] = data["number"].rstrip(".")
            data["setting"] = data["setting"].upper().rstrip(".")
            data["location"] = data["location"].strip()
            if data.get("time"):
                data["time"] = data["time"].upper()
            return True, data

        alt_match = ALT_SCENE_RE.match(line)
        if alt_match:
            num = alt_match.group(1)
            rest = alt_match.group(2).strip()
            setting_match = SETTING_RE.match(rest)
            extra = {"number": num, "setting": "", "location": rest, "time": None}
            if setting_match:
                extra["setting"] = setting_match.group(1).upper()
            return True, extra

        return False, None

    def _start_new_scene(self, header_data: dict, raw_line: str):
        if self._current_scene:
            self.scenes.append(self._current_scene)

        setting = header_data.get("setting", "")
        location = header_data.get("location", "")
        time_of_day = header_data.get("time", "")

        if not time_of_day and "-" in location:
            parts = location.rsplit("-", 1)
            potential_time = parts[1].strip().upper()
            if TIME_RE.match(potential_time):
                location = parts[0].strip()
                time_of_day = potential_time

        self._current_scene = ParsedScene(
            scene_number=int(header_data["number"]) if header_data.get("number") else len(self.scenes) + 1,
            header=raw_line.strip(),
            setting=setting,
            location=location,
            time_of_day=time_of_day,
            raw_text="",
        )
        self._in_dialogue = False
        self._last_character = None

    def _is_transition(self, line: str) -> bool:
        if TRANSITION_RE.match(line):
            return True
        if FOUNTAIN_TRANSITION_RE.match(line):
            return True
        return False

    def _handle_transition(self, line: str):
        if self._current_scene:
            transition = line.strip().rstrip(".:")
            self._current_scene.transitions.append(transition)

    def _is_dialogue_cue(self, line: str, lines: list[str], idx: int, total: int) -> bool:
        line_clean = line.strip().rstrip()
        if not re.match(r'^[A-Z][A-Z\s\-\.\'\"\(\)]{0,49}$', line_clean):
            return False
        if TRANSITION_RE.match(line_clean):
            return False
        for j in range(idx + 1, min(idx + 3, total)):
            next_line = lines[j].strip()
            if not next_line:
                continue
            if re.match(r'^[A-Z\s\-\.\'\"\(\)]{2,}$', next_line) and len(next_line) > 1:
                return False
            if self._is_scene_header(next_line, j):
                return False
            return True
        return False

    def _handle_dialogue_cue(self, line: str):
        char_name = line.strip().rstrip()
        char_name = re.sub(r'\s*\(.*\)\s*$', '', char_name).strip()
        self._in_dialogue = True
        self._last_character = char_name
        self._all_dialogue_characters.add(char_name)

    def _finalize_dialogue_block(self):
        self._in_dialogue = False
        self._last_character = None

    def _guess_title(self, text: str) -> str:
        """Guess the title from the first non-empty non-dialogue non-header line."""
        lines = text.strip().split('\n')
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            if self._is_scene_header(stripped, 1):
                continue
            if re.match(r'^[A-Z][A-Z\s\-\.\'\"\(\)]{1,49}$', stripped) and len(stripped) <= 30:
                continue
            if TRANSITION_RE.match(stripped):
                continue
            return stripped
        return "Untitled Screenplay"

    def _estimate_pages(self, text: str) -> float:
        lines = text.split('\n')
        non_empty = [l for l in lines if l.strip()]
        return round(len(non_empty) / 55.0, 1)


# ─── Convenience Functions ─────────────────────────────────────────────────────

def parse_screenplay(text: str, title: str = "") -> ParsedScreenplay:
    """Convenience function to parse a screenplay."""
    parser = ScreenplayParser()
    return parser.parse(text, title)


def parsed_to_dict(parsed: ParsedScreenplay) -> dict:
    """Convert ParsedScreenplay to a serializable dict."""
    return {
        "title": parsed.title,
        "scenes": [asdict(s) for s in parsed.scenes],
        "all_characters": parsed.all_characters,
        "estimated_pages": parsed.estimated_pages,
    }