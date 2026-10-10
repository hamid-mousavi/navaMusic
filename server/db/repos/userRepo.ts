// server/db/repos/userRepo.ts
import { db } from '../index.js';
import { IUserRepo, User } from '../types.js';

export class UserRepo implements IUserRepo {
  findAll(): User[] {
    const stmt = db.prepare('SELECT id, telegram_id, username, role, active, created_at FROM users');
    return stmt.all() as any[];
  }

  findById(id: string): User | null {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id);
    return row ? (row as unknown as User) : null;
  }

  findByUsername(username: string): User | null {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const row = stmt.get(username);
    return row ? (row as unknown as User) : null;
  }

  findByTelegramId(telegramId: string): User | null {
    const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = ?');
    const row = stmt.get(telegramId);
    return row ? (row as unknown as User) : null;
  }

  create(user: User): User {
    const stmt = db.prepare(`
      INSERT INTO users (id, telegram_id, username, password_hash, role, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      user.id,
      user.telegram_id ?? null,
      user.username ?? null,
      user.password_hash ?? null,
      user.role || 'reviewer',
      user.active !== undefined ? user.active : 1,
      user.created_at || new Date().toISOString()
    );
    return user;
  }

  update(id: string, updates: Partial<User>): User | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    const allowedKeys: (keyof User)[] = [
      'telegram_id',
      'username',
      'password_hash',
      'role',
      'active',
    ];

    for (const key of allowedKeys) {
      if (key in updates) {
        fields.push(`${key} = ?`);
        values.push((updates as any)[key]);
      }
    }

    if (fields.length === 0) return existing;

    values.push(id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return true;
  }

  count(): number {
    const res = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any;
    return res ? res.cnt : 0;
  }
}
