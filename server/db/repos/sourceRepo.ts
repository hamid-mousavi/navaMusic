// server/db/repos/sourceRepo.ts
import { db } from '../index.js';
import { ISourceRepo, Source } from '../types.js';

export class SourceRepo implements ISourceRepo {
  findAll(): Source[] {
    const stmt = db.prepare('SELECT * FROM sources ORDER BY created_at DESC');
    return stmt.all() as any[];
  }

  findById(id: string): Source | null {
    const stmt = db.prepare('SELECT * FROM sources WHERE id = ?');
    const row = stmt.get(id);
    return row ? (row as unknown as Source) : null;
  }

  findDueForScan(now: string): Source[] {
    // بازگرداندن منابعی که فعال هستند و زمان اجرای آن‌ها فرا رسیده است
    const stmt = db.prepare(`
      SELECT * FROM sources
      WHERE enabled = 1
      ORDER BY last_run_at ASC NULLS FIRST
    `);
    return stmt.all() as any[];
  }

  create(source: Source): Source {
    const stmt = db.prepare(`
      INSERT INTO sources (
        id, type, ref, title, schedule, enabled, auto_publish,
        default_reciter_id, default_category_id, filters_json,
        last_run_at, last_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      source.id,
      source.type,
      source.ref,
      source.title,
      source.schedule || 'daily',
      source.enabled !== undefined ? source.enabled : 1,
      source.auto_publish !== undefined ? source.auto_publish : 0,
      source.default_reciter_id ?? null,
      source.default_category_id ?? null,
      source.filters_json || '{}',
      source.last_run_at ?? null,
      source.last_status ?? null,
      source.created_at || new Date().toISOString()
    );

    return source;
  }

  update(id: string, updates: Partial<Source>): Source | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    const allowedKeys: (keyof Source)[] = [
      'type',
      'ref',
      'title',
      'schedule',
      'enabled',
      'auto_publish',
      'default_reciter_id',
      'default_category_id',
      'filters_json',
      'last_run_at',
      'last_status',
    ];

    for (const key of allowedKeys) {
      if (key in updates) {
        fields.push(`${key} = ?`);
        values.push((updates as any)[key]);
      }
    }

    if (fields.length === 0) return existing;

    values.push(id);
    db.prepare(`UPDATE sources SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    db.prepare('DELETE FROM sources WHERE id = ?').run(id);
    return true;
  }
}
