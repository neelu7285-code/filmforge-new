# FilmForge - Screenplay Parser Service

AI-powered screenplay parsing and pre-production breakdown extraction service.

## Architecture

```
services/ai/screenplay-parser/
├── __init__.py          # Package init
├── app.py               # FastAPI REST API (entry point)
├── parser.py            # Rule-based screenplay text parser
├── llm_client.py        # LLM API client (OpenAI, Anthropic, Mock)
├── extractor.py         # Orchestrator combining parser + LLM
├── schemas.py           # Pydantic request/response schemas
├── requirements.txt     # Python dependencies
├── .env.example         # Environment configuration template
├── README.md            # This file
└── tests/
    ├── __init__.py
    ├── test_parser.py   # Parser unit tests
    └── test_extractor.py # Extractor integration tests
```

## Installation

```bash
cd services/ai/screenplay-parser
pip install -r requirements.txt
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### LLM Provider Options

| Provider    | Setting          | API Key Required |
|-------------|------------------|------------------|
| **Mock**    | `LLM_PROVIDER=mock` | No (default for dev) |
| **OpenAI**  | `LLM_PROVIDER=openai` | Yes (`OPENAI_API_KEY`) |
| **Anthropic** | `LLM_PROVIDER=anthropic` | Yes (`ANTHROPIC_API_KEY`) |

The **mock provider** returns structured data without calling any external API, making it ideal for development and testing.

## Running

```bash
# Development (auto-reload)
uvicorn app:app --host 0.0.0.0 --port 8100 --reload

# Or via module
python -m services.ai.screenplay_parser.app
```

## API Endpoints

All endpoints return JSON.

### `GET /api/health`
Health check. Returns service status and LLM availability.

### `POST /api/parse`
Rule-based screenplay parsing (fast, no API calls).

**Request:**
```json
{
  "script_text": "INT. OFFICE - DAY\n\nJOHN enters...",
  "title": "My Movie"
}
```

### `POST /api/breakdown`
Full screenplay breakdown with optional LLM enhancement.

**Request:**
```json
{
  "script_text": "INT. OFFICE - DAY\n\nJOHN enters...",
  "title": "My Movie",
  "use_llm": true
}
```

Returns scenes, characters, props, costumes, locations, vehicles, animals, VFX.

### `POST /api/dialogue`
Extract all dialogue per character.

### `POST /api/continuity`
Detect continuity issues in the screenplay.

### `POST /api/budget`
Estimate production budget from breakdown data.

### `POST /api/compare`
Compare two screenplay versions.

## Integration with Express Backend

The Fullstack Engineer calls this service from Node.js:

```javascript
const response = await fetch('http://localhost:8100/api/breakdown', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    script_text: req.body.script,
    title: req.body.title,
    use_llm: true
  })
});
const data = await response.json();
```

## Database Integration

Parsed results map to the FilmForge database schema:
- **scenes** table ← scene list with headers, settings, locations
- **characters** table ← character names, cast types, scenes appeared
- **breakdowns** table ← props, costumes, vehicles, animals, VFX per type

See `/home/team/shared/DATABASE_SCHEMA.md` for full schema details.

## Testing

```bash
# From the service directory
python -m pytest tests/ -v

# Or from project root
python -m pytest services/ai/screenplay-parser/tests/ -v
```