// server/db/repos/settingsRepo.ts
import { db } from '../index.js';
import { ISettingsRepo } from '../types.js';

export class SettingsRepo implements ISettingsRepo {
  get(key: string, defaultValue?: string): string | null {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key) as any;
    if (row && row.value !== undefined) {
      return row.value;
    }
    return defaultValue !== undefined ? defaultValue : null;
  }

  set(key: string, value: string): void {
    const stmt = db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(key, value);
  }

  getAll(): Record<string, string> {
    const stmt = db.prepare('SELECT key, value FROM settings');
    const rows = stmt.all() as any[];
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.key] = r.value;
    }
    return result;
  }
}
