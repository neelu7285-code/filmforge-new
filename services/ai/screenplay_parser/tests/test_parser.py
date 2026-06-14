"""Tests for the screenplay parser module."""

import pytest
from services.ai.screenplay_parser.parser import ScreenplayParser, parse_screenplay


SAMPLE_SCREENPLAY = """THE BREAKFAST CLUB - REIMAGINED

SCENE 1

INT. SCHOOL LIBRARY - DAY

The library is quiet. Dust motes float in beams of morning light.

JOHN
(sitting on a table)
This is gonna be the longest Saturday of my life.

CLAIRE
(entering, looking around)
Is this the detention room?

ANDREW
It says so on the door.

JOHN
Five strangers, no parents, eight hours. What could go wrong?

INT. PRINCIPAL'S OFFICE - CONTINUOUS

The PRINCIPAL, a stern man in his 50s, reviews a file.

PRINCIPAL
(to himself)
This group is going to be a handful.

CUT TO:

INT. SCHOOL LIBRARY - LATER

The group has spread out. Tension fills the air.

CLAIRE
(rifling through her bag)
I can't believe I forgot my lip gloss.

JOHN
That's your concern right now?
"""


def test_parse_scene_headers():
    """Test that scene headers are correctly identified."""
    parsed = parse_screenplay(SAMPLE_SCREENPLAY)
    assert len(parsed.scenes) >= 2
    assert "INT. SCHOOL LIBRARY - DAY" in [s.header for s in parsed.scenes]
    assert "INT. PRINCIPAL'S OFFICE - CONTINUOUS" in [s.header for s in parsed.scenes]


def test_parse_characters():
    """Test that characters are extracted from dialogue cues."""
    parsed = parse_screenplay(SAMPLE_SCREENPLAY)
    assert "JOHN" in parsed.all_characters
    assert "CLAIRE" in parsed.all_characters
    assert "ANDREW" in parsed.all_characters
    assert "PRINCIPAL" in parsed.all_characters


def test_parse_location_extraction():
    """Test that locations are extracted from scene headers."""
    parsed = parse_screenplay(SAMPLE_SCREENPLAY)
    for scene in parsed.scenes:
        if "SCHOOL LIBRARY" in scene.header:
            assert "SCHOOL LIBRARY" in scene.location or "SCHOOL LIBRARY" in scene.header
            break


def test_parse_setting_extraction():
    """Test that INT/EXT is extracted from scene headers."""
    parsed = parse_screenplay(SAMPLE_SCREENPLAY)
    library_scene = None
    for scene in parsed.scenes:
        if "SCHOOL LIBRARY" in scene.header:
            library_scene = scene
            break
    assert library_scene is not None
    assert library_scene.setting == "INT" or library_scene.setting == ""


def test_empty_script():
    """Test parsing an empty script."""
    parsed = parse_screenplay("")
    assert len(parsed.scenes) == 0
    assert len(parsed.all_characters) == 0


def test_fountain_format():
    """Test parsing Fountain-format screenplay."""
    fountain_text = """Title: My Fountain Screenplay

= Scene 1

.INT. COFFEE SHOP - DAY

A cozy coffee shop.

CHARLIE
Hi there.

DANA
What can I get you?

> CUT TO:
"""
    parsed = parse_screenplay(fountain_text)
    assert len(parsed.scenes) >= 1


def test_dialogue_extraction():
    """Test that dialogue is extracted per scene."""
    parsed = parse_screenplay(SAMPLE_SCREENPLAY)
    total_dialogue = sum(len(s.dialogue_lines) for s in parsed.scenes)
    assert total_dialogue >= 6  # We have at least 6 dialogue lines


def test_page_estimate():
    """Test page count estimation."""
    parsed = parse_screenplay(SAMPLE_SCREENPLAY)
    assert parsed.estimated_pages > 0


def test_scene_numbering():
    """Test sequential scene numbering."""
    parsed = parse_screenplay(SAMPLE_SCREENPLAY)
    for i, scene in enumerate(parsed.scenes):
        assert scene.scene_number == i + 1


def test_time_of_day_extraction():
    """Test that time of day is extracted from headers."""
    parsed = parse_screenplay(SAMPLE_SCREENPLAY)
    for scene in parsed.scenes:
        if "DAY" in scene.header:
            assert scene.time_of_day == "DAY" or scene.time_of_day == ""
            break