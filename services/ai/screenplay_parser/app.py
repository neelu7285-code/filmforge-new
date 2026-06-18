"""
FilmForge - Screenplay Parser Service

FastAPI application that provides REST endpoints for screenplay parsing and
pre-production breakdown extraction.

Endpoints:
  POST /api/parse          - Rule-based screenplay parsing
  POST /api/breakdown      - Full screenplay breakdown with LLM enhancement
  POST /api/dialogue       - Dialogue extraction
  POST /api/continuity     - Continuity issue detection
  POST /api/budget         - Budget estimation
  POST /api/compare        - Script version comparison
  GET  /api/health         - Health check

Usage:
    uvicorn app:app --host 0.0.0.0 --port 8100
"""

from __future__ import annotations

import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .extractor import ScreenplayExtractor
from .llm_client import LLMClient
from .schemas import (
    ParseRequest,
    BreakdownRequest,
    DialogueRequest,
    CompareRequest,
    BudgetRequest,
    ParseResponse,
    BreakdownResponse,
    DialogueResponse,
    ContinuityResponse,
    BudgetResponse,
    CompareResponse,
)

logger = logging.getLogger(__name__)

# ─── Application State ─────────────────────────────────────────────────────────

class AppState:
    """Holds application-wide state including the extractor instance."""
    extractor: ScreenplayExtractor | None = None


state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize resources on startup, clean up on shutdown."""
    logger.info("Starting Screenplay Parser Service...")
    try:
        llm_client = LLMClient()
        state.extractor = ScreenplayExtractor(llm_client=llm_client)
        logger.info(f"Screenplay Extractor initialized (LLM available: {llm_client.is_available()})")
    except Exception as e:
        logger.warning(f"Failed to initialize LLM client, using rule-based only: {e}")
        state.extractor = ScreenplayExtractor(llm_client=None)
    yield
    logger.info("Shutting down Screenplay Parser Service...")


# ─── FastAPI Application ───────────────────────────────────────────────────────

app = FastAPI(
    title="FilmForge - Screenplay Parser Service",
    description="AI-powered screenplay parsing and pre-production breakdown extraction",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: allow the Express backend to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your backend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Helper ────────────────────────────────────────────────────────────────────

def get_extractor() -> ScreenplayExtractor:
    """Get the extractor instance."""
    if state.extractor is None:
        raise HTTPException(status_code=503, detail="Service not initialized yet")
    return state.extractor


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    extractor = get_extractor()
    return {
        "status": "healthy",
        "service": "screenplay-parser",
        "version": "1.0.0",
        "llm_available": extractor.llm.is_available() if extractor.llm else False,
    }


@app.post("/api/parse", response_model=ParseResponse)
async def parse_screenplay(request: ParseRequest):
    """
    Parse a screenplay using rule-based parsing.

    Fast path - no LLM API calls needed. Returns scene structure and character list.
    """
    extractor = get_extractor()
    result = extractor.parse(
        script_text=request.script_text,
        title=request.title or "",
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    return result


@app.post("/api/breakdown", response_model=BreakdownResponse)
async def full_breakdown(request: BreakdownRequest):
    """
    Full screenplay breakdown with optional LLM enhancement.

    Returns comprehensive breakdown including scenes, characters, props,
    costumes, locations, vehicles, animals, VFX, and crowd needs.
    """
    extractor = get_extractor()
    result = extractor.breakdown(
        script_text=request.script_text,
        title=request.title or "",
        use_llm=request.use_llm,
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.error)
    return result


@app.post("/api/dialogue", response_model=DialogueResponse)
async def extract_dialogue(request: DialogueRequest):
    """
    Extract all dialogue from a screenplay, organized by character and scene.
    """
    extractor = get_extractor()
    return extractor.extract_dialogue(script_text=request.script_text)


@app.post("/api/continuity", response_model=ContinuityResponse)
async def detect_continuity(request: ParseRequest):
    """
    Detect potential continuity issues in the screenplay.
    Uses LLM when available, falls back to rule-based checks.
    """
    extractor = get_extractor()
    return extractor.detect_continuity(script_text=request.script_text)


@app.post("/api/budget", response_model=BudgetResponse)
async def estimate_budget(request: BudgetRequest):
    """
    Estimate production budget from breakdown data.
    """
    extractor = get_extractor()
    return extractor.estimate_budget(breakdown_data=request.breakdown_data)


@app.post("/api/compare", response_model=CompareResponse)
async def compare_versions(request: CompareRequest):
    """
    Compare two screenplay versions and identify changes.
    """
    extractor = get_extractor()
    return extractor.compare_versions(
        script_a=request.script_a,
        script_b=request.script_b,
        title_a=request.title_a or "",
        title_b=request.title_b or "",
    )


# ─── Main Entry Point ─────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    host = os.getenv("SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("SERVICE_PORT", "8100"))

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=True,
        log_level="info",
    )