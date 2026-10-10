// server/db/repos/takedownRepo.ts
// مخزن درخواست‌های حذف اثر و کپی‌رایت (DMCA / Takedown Requests)

import { db } from '../index.js';
import { TakedownRequest } from '../types.js';

export class TakedownRepo {
  create(data: Omit<TakedownRequest, 'created_at'> & { created_at?: string }): TakedownRequest {
    const createdAt = data.created_at || new Date().toISOString();
    const contact = data.requester_contact || data.requester_email || data.requester_name || '';

    const stmt = db.prepare(`
      INSERT INTO takedown_requests (id, track_id, requester_contact, reason, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      data.id,
      data.track_id,
      contact,
      data.reason,
      data.status || 'pending',
      createdAt
    );

    return {
      ...data,
      requester_contact: contact,
      created_at: createdAt,
    };
  }

  findAll(limit = 50): TakedownRequest[] {
    const stmt = db.prepare('SELECT * FROM takedown_requests ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(limit) as unknown as TakedownRequest[];
    return rows;
  }

  findById(id: string): TakedownRequest | null {
    const stmt = db.prepare('SELECT * FROM takedown_requests WHERE id = ?');
    const row = stmt.get(id);
    return (row as unknown as TakedownRequest) || null;
  }

  updateStatus(id: string, status: 'pending' | 'reviewed' | 'resolved' | 'rejected'): boolean {
    const stmt = db.prepare('UPDATE takedown_requests SET status = ? WHERE id = ?');
    const res = stmt.run(status, id);
    return res.changes > 0;
  }
}
