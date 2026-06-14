import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

/**
 * Helper: run a team-db SQL query and return parsed JSON result.
 */
function dbQuery(sql) {
  try {
    // Escape $ and " signs so bash doesn't interpret them
    const escaped = sql.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const stdout = execSync(`team-db "${escaped}"`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return JSON.parse(stdout.trim());
  } catch (err) {
    console.error('[DB Error]', err.message);
    throw new Error('Database query failed');
  }
}

/**
 * Helper: escape single quotes for SQL
 */
function esc(val) {
  return String(val ?? '').replace(/'/g, "''");
}

/**
 * GET /api/projects
 * List all projects for the authenticated user.
 */
router.get('/', (req, res) => {
  try {
    const rows = dbQuery(
      `SELECT id, title, status, description, script_path, created_at, updated_at
       FROM projects
       WHERE user_id = '${esc(req.user.id)}'
       ORDER BY updated_at DESC`
    );

    res.json({ projects: rows });
  } catch (err) {
    console.error('[Projects List Error]', err);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

/**
 * POST /api/projects
 * Create a new project.
 * Body: { title, description? }
 */
router.post('/', (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Project title is required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    dbQuery(
      `INSERT INTO projects (id, user_id, title, description, created_at, updated_at)
       VALUES ('${id}', '${esc(req.user.id)}', '${esc(title)}', '${esc(description || '')}', '${now}', '${now}')`
    );

    res.status(201).json({
      message: 'Project created',
      project: { id, title, status: 'draft', description: description || '', created_at: now, updated_at: now },
    });
  } catch (err) {
    console.error('[Project Create Error]', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * GET /api/projects/:id
 * Get a single project's details.
 */
router.get('/:id', (req, res) => {
  try {
    const rows = dbQuery(
      `SELECT id, title, status, description, script_path, created_at, updated_at
       FROM projects
       WHERE id = '${esc(req.params.id)}' AND user_id = '${esc(req.user.id)}'`
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: rows[0] });
  } catch (err) {
    console.error('[Project Get Error]', err);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

/**
 * PATCH /api/projects/:id
 * Update a project (rename or change description).
 * Body: { title?, description? }
 */
router.patch('/:id', (req, res) => {
  try {
    const { title, description, status } = req.body;

    // Build SET clauses dynamically
    const sets = [];
    if (title !== undefined) sets.push(`title = '${esc(title)}'`);
    if (description !== undefined) sets.push(`description = '${esc(description)}'`);
    if (status !== undefined) sets.push(`status = '${esc(status)}'`);

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    sets.push(`updated_at = datetime('now')`);

    dbQuery(
      `UPDATE projects SET ${sets.join(', ')}
       WHERE id = '${esc(req.params.id)}' AND user_id = '${esc(req.user.id)}'`
    );

    // Fetch the updated project
    const rows = dbQuery(
      `SELECT id, title, status, description, script_path, created_at, updated_at
       FROM projects
       WHERE id = '${esc(req.params.id)}'`
    );

    res.json({ message: 'Project updated', project: rows[0] || null });
  } catch (err) {
    console.error('[Project Update Error]', err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project.
 */
router.delete('/:id', (req, res) => {
  try {
    dbQuery(
      `DELETE FROM projects
       WHERE id = '${esc(req.params.id)}' AND user_id = '${esc(req.user.id)}'`
    );

    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('[Project Delete Error]', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;