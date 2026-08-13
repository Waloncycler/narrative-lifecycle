import express from 'express';
import cors from 'cors';
import { db } from '../db/index';
import { systemRuns, stageDiffs, genericArtifacts } from '../db/schema';
import { desc, eq, like } from 'drizzle-orm';

const app = express();
app.use(cors());
app.use(express.json());

// Get recent runs
app.get('/api/runs', (req, res) => {
  try {
    const runs = db.select().from(systemRuns).orderBy(desc(systemRuns.started_at)).limit(50).all();
    res.json(runs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent diffs
app.get('/api/diffs', (req, res) => {
  try {
    const diffs = db.select().from(stageDiffs).orderBy(desc(stageDiffs.generated_at)).limit(50).all();
    const parsedDiffs = diffs.map(d => JSON.parse(d.diff_json));
    res.json(parsedDiffs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent dashboard cards
app.get('/api/cards', (req, res) => {
  try {
    const cards = db.select().from(genericArtifacts)
      .where(like(genericArtifacts.artifact_id, 'dashboard_cards/%'))
      .all();
    const parsedCards = cards.map(c => JSON.parse(c.content_json));
    res.json(parsedCards);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get scores
app.get('/api/scores', (req, res) => {
  try {
    const scores = db.select().from(genericArtifacts)
      .where(like(genericArtifacts.artifact_id, 'scores/%'))
      .all();
    const parsedScores = scores.map(c => JSON.parse(c.content_json));
    res.json(parsedScores);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific artifact
app.get('/api/artifact', (req, res) => {
  try {
    const id = req.query.id as string;
    if (!id) {
      return res.status(400).json({ error: 'Missing id query param' });
    }
    const artifact = db.select().from(genericArtifacts).where(eq(genericArtifacts.artifact_id, id)).get();
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    res.json(JSON.parse(artifact.content_json));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Narrative Lifecycle API listening on port ${PORT}`);
});
