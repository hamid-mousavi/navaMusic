// server/db/repos/jobRepo.ts
import { db } from '../index.js';
import { IScanJobRepo, ScanJob } from '../types.js';

export class ScanJobRepo implements IScanJobRepo {
  findAll(limit = 50): ScanJob[] {
    const stmt = db.prepare('SELECT * FROM scan_jobs ORDER BY started_at DESC LIMIT ?');
    return stmt.all(limit) as any[];
  }

  findById(id: string): ScanJob | null {
    const stmt = db.prepare('SELECT * FROM scan_jobs WHERE id = ?');
    const row = stmt.get(id);
    return row ? (row as unknown as ScanJob) : null;
  }

  create(job: ScanJob): ScanJob {
    const stmt = db.prepare(`
      INSERT INTO scan_jobs (
        id, source_id, trigger, status, found, new_count, error, started_at, finished_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      job.id,
      job.source_id,
      job.trigger || 'manual',
      job.status || 'queued',
      job.found || 0,
      job.new_count || 0,
      job.error ?? null,
      job.started_at || new Date().toISOString(),
      job.finished_at ?? null
    );

    return job;
  }

  update(id: string, updates: Partial<ScanJob>): ScanJob | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    const allowedKeys: (keyof ScanJob)[] = [
      'status',
      'found',
      'new_count',
      'error',
      'started_at',
      'finished_at',
    ];

    for (const key of allowedKeys) {
      if (key in updates) {
        fields.push(`${key} = ?`);
        values.push((updates as any)[key]);
      }
    }

    if (fields.length === 0) return existing;

    values.push(id);
    db.prepare(`UPDATE scan_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  findActiveJobs(): ScanJob[] {
    const stmt = db.prepare("SELECT * FROM scan_jobs WHERE status IN ('queued', 'running')");
    return stmt.all() as any[];
  }
}
