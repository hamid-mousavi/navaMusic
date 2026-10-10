// server/db/repos/reciterRepo.ts
import { db } from '../index.js';
import { IReciterRepo, Reciter } from '../types.js';

export class ReciterRepo implements IReciterRepo {
  findAll(): Reciter[] {
    const stmt = db.prepare('SELECT * FROM reciters ORDER BY tracks_count DESC, name ASC');
    return stmt.all() as any[];
  }

  findById(id: string): Reciter | null {
    const stmt = db.prepare('SELECT * FROM reciters WHERE id = ?');
    const row = stmt.get(id);
    return row ? (row as unknown as Reciter) : null;
  }

  create(reciter: Reciter): Reciter {
    const stmt = db.prepare(`
      INSERT INTO reciters (id, name, title, bio, avatar_url, tracks_count, style, accent_color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      reciter.id,
      reciter.name,
      reciter.title,
      reciter.bio || '',
      reciter.avatar_url || '',
      reciter.tracks_count || 0,
      reciter.style || '',
      reciter.accent_color || '#10b981'
    );
    return reciter;
  }

  update(id: string, updates: Partial<Reciter>): Reciter | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    const allowedKeys: (keyof Reciter)[] = [
      'name',
      'title',
      'bio',
      'avatar_url',
      'tracks_count',
      'style',
      'accent_color',
    ];

    for (const key of allowedKeys) {
      if (key in updates) {
        fields.push(`${key} = ?`);
        values.push((updates as any)[key]);
      }
    }

    if (fields.length === 0) return existing;

    values.push(id);
    db.prepare(`UPDATE reciters SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    db.prepare('DELETE FROM reciters WHERE id = ?').run(id);
    return true;
  }

  updateTracksCount(id: string, delta: number): void {
    db.prepare('UPDATE reciters SET tracks_count = MAX(0, tracks_count + ?) WHERE id = ?').run(
      delta,
      id
    );
  }
}
