// server/db/repos/auditRepo.ts
import { db } from '../index.js';
import { IAuditRepo, AuditLog } from '../types.js';

export class AuditRepo implements IAuditRepo {
  log(entry: Omit<AuditLog, 'id' | 'at'> & { id?: string; at?: string }): AuditLog {
    const id = entry.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const at = entry.at || new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO audit_log (id, at, actor_type, actor_id, action, entity, entity_id, meta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      at,
      entry.actor_type,
      entry.actor_id ?? null,
      entry.action,
      entry.entity,
      entry.entity_id ?? null,
      entry.meta_json || '{}'
    );

    return {
      id,
      at,
      actor_type: entry.actor_type,
      actor_id: entry.actor_id ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id ?? null,
      meta_json: entry.meta_json || '{}',
    };
  }

  listRecent(limit = 100): AuditLog[] {
    const stmt = db.prepare('SELECT * FROM audit_log ORDER BY at DESC LIMIT ?');
    return stmt.all(limit) as any[];
  }
}
