// server/db/repos/trackRepo.ts
import { db } from '../index.js';
import { ITrackRepo, Track, TrackStatus } from '../types.js';

export class TrackRepo implements ITrackRepo {
  findById(id: string): Track | null {
    const stmt = db.prepare(`
      SELECT t.*, r.name as reciter_name, c.name as category_name
      FROM tracks t
      LEFT JOIN reciters r ON t.reciter_id = r.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `);
    const row = stmt.get(id) as any;
    return row ? (row as Track) : null;
  }

  findBySource(sourceType: string, sourceExternalId: string): Track | null {
    const stmt = db.prepare(`
      SELECT t.*, r.name as reciter_name, c.name as category_name
      FROM tracks t
      LEFT JOIN reciters r ON t.reciter_id = r.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.source_type = ? AND t.source_external_id = ?
    `);
    const row = stmt.get(sourceType, sourceExternalId) as any;
    return row ? (row as Track) : null;
  }

  findByContentHash(hash: string): Track | null {
    const stmt = db.prepare(`
      SELECT t.*, r.name as reciter_name, c.name as category_name
      FROM tracks t
      LEFT JOIN reciters r ON t.reciter_id = r.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.content_hash = ?
    `);
    const row = stmt.get(hash) as any;
    return row ? (row as Track) : null;
  }

  listPublished(options?: {
    query?: string;
    reciterId?: string;
    categoryId?: string;
    limit?: number;
    offset?: number;
  }): { tracks: Track[]; total: number } {
    let whereClause = "WHERE t.status = 'published'";
    const params: any[] = [];

    if (options?.query && options.query.trim()) {
      whereClause += ' AND (t.title LIKE ? OR t.occasion LIKE ? OR t.tags_json LIKE ?)';
      const q = `%${options.query.trim()}%`;
      params.push(q, q, q);
    }

    if (options?.reciterId && options.reciterId !== 'all') {
      whereClause += ' AND t.reciter_id = ?';
      params.push(options.reciterId);
    }

    if (options?.categoryId && options.categoryId !== 'cat-all') {
      whereClause += ' AND t.category_id = ?';
      params.push(options.categoryId);
    }

    // شمارش کل
    const countStmt = db.prepare(`SELECT COUNT(*) as cnt FROM tracks t ${whereClause}`);
    const countResult = countStmt.get(...params) as any;
    const total = countResult ? countResult.cnt : 0;

    // استخراج لیست
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const querySql = `
      SELECT t.*, r.name as reciter_name, c.name as category_name
      FROM tracks t
      LEFT JOIN reciters r ON t.reciter_id = r.id
      LEFT JOIN categories c ON t.category_id = c.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const listStmt = db.prepare(querySql);
    const rows = listStmt.all(...params, limit, offset) as any[];
    return {
      tracks: rows as Track[],
      total,
    };
  }

  listCandidates(status?: TrackStatus): Track[] {
    let sql = `
      SELECT t.*, r.name as reciter_name, c.name as category_name
      FROM tracks t
      LEFT JOIN reciters r ON t.reciter_id = r.id
      LEFT JOIN categories c ON t.category_id = c.id
    `;
    const params: any[] = [];

    if (status) {
      sql += ' WHERE t.status = ?';
      params.push(status);
    } else {
      sql += " WHERE t.status != 'published' AND t.status != 'rejected'";
    }

    sql += ' ORDER BY t.created_at DESC';

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as any[];
    return rows as Track[];
  }

  listAll(): Track[] {
    const stmt = db.prepare(`
      SELECT t.*, r.name as reciter_name, c.name as category_name
      FROM tracks t
      LEFT JOIN reciters r ON t.reciter_id = r.id
      LEFT JOIN categories c ON t.category_id = c.id
      ORDER BY t.created_at DESC
    `);
    const rows = stmt.all() as any[];
    return rows as Track[];
  }

  create(track: Track): Track {
    const stmt = db.prepare(`
      INSERT INTO tracks (
        id, title, reciter_id, category_id, occasion, tags_json, lyrics_json,
        duration, bitrate, file_size, content_hash, source_id, source_type,
        source_external_id, source_url, source_owner_name, staging_path, s3_key,
        audio_url, cover_url, ai_suggestion_json, status, reject_reason,
        reviewed_by, reviewed_at, published_at, channel_message_id, play_count, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);

    stmt.run(
      track.id,
      track.title,
      track.reciter_id ?? null,
      track.category_id ?? null,
      track.occasion ?? null,
      track.tags_json || '[]',
      track.lyrics_json || '[]',
      track.duration || 0,
      track.bitrate || '320 kbps',
      track.file_size || 0,
      track.content_hash ?? null,
      track.source_id ?? null,
      track.source_type ?? null,
      track.source_external_id ?? null,
      track.source_url ?? null,
      track.source_owner_name ?? null,
      track.staging_path ?? null,
      track.s3_key ?? null,
      track.audio_url ?? null,
      track.cover_url || '',
      track.ai_suggestion_json ?? null,
      track.status || 'pending',
      track.reject_reason ?? null,
      track.reviewed_by ?? null,
      track.reviewed_at ?? null,
      track.published_at ?? null,
      track.channel_message_id ?? null,
      track.play_count || 0,
      track.created_at || new Date().toISOString()
    );

    return this.findById(track.id) || track;
  }

  update(id: string, updates: Partial<Track>): Track | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    const allowedKeys: (keyof Track)[] = [
      'title',
      'reciter_id',
      'category_id',
      'occasion',
      'tags_json',
      'lyrics_json',
      'duration',
      'bitrate',
      'file_size',
      'content_hash',
      'source_id',
      'source_type',
      'source_external_id',
      'source_url',
      'source_owner_name',
      'staging_path',
      's3_key',
      'audio_url',
      'cover_url',
      'ai_suggestion_json',
      'status',
      'reject_reason',
      'reviewed_by',
      'reviewed_at',
      'published_at',
      'channel_message_id',
      'play_count',
    ];

    for (const key of allowedKeys) {
      if (key in updates) {
        fields.push(`${key} = ?`);
        values.push((updates as any)[key]);
      }
    }

    if (fields.length === 0) return existing;

    values.push(id);
    const sql = `UPDATE tracks SET ${fields.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...values);

    return this.findById(id);
  }

  delete(id: string): boolean {
    const stmt = db.prepare('DELETE FROM tracks WHERE id = ?');
    stmt.run(id);
    return true;
  }

  incrementPlayCount(id: string): void {
    const stmt = db.prepare('UPDATE tracks SET play_count = play_count + 1 WHERE id = ?');
    stmt.run(id);
  }

  countByStatus(status: TrackStatus): number {
    const stmt = db.prepare('SELECT COUNT(*) as cnt FROM tracks WHERE status = ?');
    const res = stmt.get(status) as any;
    return res ? res.cnt : 0;
  }
}
