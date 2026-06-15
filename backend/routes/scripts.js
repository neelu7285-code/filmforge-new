import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const PARSER_URL = process.env.PARSER_URL || 'http://localhost:8100';

function dbQuery(sql) {
  try {
    const escaped = sql.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const stdout = execSync(`team-db "${escaped}"`, {
      encoding: 'utf-8',
      timeout: 15000,
    });
    return JSON.parse(stdout.trim());
  } catch (err) {
    console.error('[DB Error]', err.message);
    throw new Error('Database query failed');
  }
}

function esc(val) {
  return String(val ?? '').replace(/'/g, "''");
}

/**
 * POST /api/scripts/upload
 * Upload a screenplay — accepts text or file content.
 * Forwards to AI parser, stores results in DB.
 * Body: { project_id, script_text, filename? }
 */
router.post('/upload', async (req, res) => {
  try {
    const { project_id, script_text, filename } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }
    if (!script_text || !script_text.trim()) {
      return res.status(400).json({ error: 'script_text is required' });
    }

    // Verify project belongs to user
    const projectCheck = dbQuery(
      `SELECT id FROM projects WHERE id = '${esc(project_id)}' AND user_id = '${esc(req.user.id)}'`
    );
    if (projectCheck.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Update project with script text
    dbQuery(
      `UPDATE projects SET script_text = '${esc(script_text)}', script_filename = '${esc(filename || '')}', status = 'processing', updated_at = datetime('now') WHERE id = '${esc(project_id)}'`
    );

    // Forward to AI parser service
    let parseResult;
    try {
      const response = await fetch(`${PARSER_URL}/api/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_text, title: filename || 'Untitled', project_id }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Parser returned ${response.status}: ${errorText}`);
      }

      parseResult = await response.json();
    } catch (parserErr) {
      console.error('[Parser Error]', parserErr.message);
      // Update project status to draft on failure
      dbQuery(`UPDATE projects SET status = 'draft', updated_at = datetime('now') WHERE id = '${esc(project_id)}'`);
      return res.status(502).json({ error: `Parser service error: ${parserErr.message}` });
    }

    if (!parseResult.success) {
      dbQuery(`UPDATE projects SET status = 'draft', updated_at = datetime('now') WHERE id = '${esc(project_id)}'`);
      return res.status(422).json({ error: parseResult.error || 'Parser failed to process script' });
    }

    // Store scenes in DB
    const scenes = parseResult.scenes || [];
    for (const scene of scenes) {
      const sceneId = uuidv4();
      dbQuery(
        `INSERT INTO scenes (id, project_id, scene_number, header, setting, location, time_of_day, synopsis, characters, props, costumes, vfx, vehicles, animals, crowd_needs, raw_text, page_count) VALUES (
          '${sceneId}', '${esc(project_id)}', ${scene.scene_number ?? 0}, '${esc(scene.header || '')}', '${esc(scene.setting || '')}',
          '${esc(scene.location || '')}', '${esc(scene.time_of_day || '')}', '${esc(scene.synopsis || '')}',
          '${esc(JSON.stringify(scene.characters || []))}', '${esc(JSON.stringify(scene.props || []))}',
          '${esc(JSON.stringify(scene.costumes || []))}', '${esc(JSON.stringify(scene.vfx || []))}',
          '${esc(JSON.stringify(scene.vehicles || []))}', '${esc(JSON.stringify(scene.animals || []))}',
          '${esc(JSON.stringify(scene.crowd_needs || []))}', '${esc(scene.raw_text || '')}', ${scene.page_count_estimate ?? 0}
        )`
      );
    }

    // Store characters in DB
    const characters = parseResult.characters || [];
    for (const char of characters) {
      const charId = uuidv4();
      dbQuery(
        `INSERT INTO characters (id, project_id, name, description, age_range, cast_type, dialogue_count, scenes_appeared) VALUES (
          '${charId}', '${esc(project_id)}', '${esc(char.name || '')}', '${esc(char.description || '')}',
          '${esc(char.age_range || '')}', '${esc(char.cast_type || '')}', ${char.dialogue_count ?? 0},
          '${esc(JSON.stringify(char.scenes_appeared || []))}'
        )`
      );
    }

    // Update project status to completed
    dbQuery(`UPDATE projects SET status = 'completed', updated_at = datetime('now') WHERE id = '${esc(project_id)}'`);

    res.json({
      message: 'Script parsed successfully',
      project_id,
      summary: {
        total_scenes: scenes.length,
        total_characters: characters.length,
        dialogue_count: parseResult.dialogue_count || 0,
        page_estimate: parseResult.total_page_estimate || 0,
      },
    });
  } catch (err) {
    console.error('[Script Upload Error]', err);
    res.status(500).json({ error: 'Script upload failed' });
  }
});

/**
 * GET /api/scripts/:projectId/breakdown
 * Returns full breakdown data (scenes + characters)
 */
router.get('/:projectId/breakdown', (req, res) => {
  try {
    const { projectId } = req.params;

    const scenes = dbQuery(
      `SELECT id, scene_number, header, setting, location, time_of_day, synopsis, characters, props, costumes, vfx, vehicles, animals, crowd_needs, raw_text, page_count
       FROM scenes WHERE project_id = '${esc(projectId)}' ORDER BY scene_number`
    );

    const chars = dbQuery(
      `SELECT id, name, description, age_range, cast_type, dialogue_count, scenes_appeared
       FROM characters WHERE project_id = '${esc(projectId)}' ORDER BY dialogue_count DESC`
    );

    const project = dbQuery(
      `SELECT id, title, script_text, script_filename, status, created_at, updated_at
       FROM projects WHERE id = '${esc(projectId)}'`
    );

    res.json({
      project: project[0] || null,
      scenes,
      characters: chars,
    });
  } catch (err) {
    console.error('[Breakdown Error]', err);
    res.status(500).json({ error: 'Failed to fetch breakdown' });
  }
});

export default router;