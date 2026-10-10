// server/db/repos/categoryRepo.ts
import { db } from '../index.js';
import { ICategoryRepo, Category } from '../types.js';

export class CategoryRepo implements ICategoryRepo {
  findAll(): Category[] {
    const stmt = db.prepare('SELECT * FROM categories ORDER BY tracks_count DESC');
    return stmt.all() as any[];
  }

  findById(id: string): Category | null {
    const stmt = db.prepare('SELECT * FROM categories WHERE id = ?');
    const row = stmt.get(id);
    return row ? (row as unknown as Category) : null;
  }

  findBySlug(slug: string): Category | null {
    const stmt = db.prepare('SELECT * FROM categories WHERE slug = ?');
    const row = stmt.get(slug);
    return row ? (row as unknown as Category) : null;
  }

  create(category: Category): Category {
    const stmt = db.prepare(`
      INSERT INTO categories (id, name, slug, icon_name, tracks_count, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      category.id,
      category.name,
      category.slug,
      category.icon_name || 'Sparkles',
      category.tracks_count || 0,
      category.description || ''
    );
    return category;
  }

  update(id: string, updates: Partial<Category>): Category | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];

    const allowedKeys: (keyof Category)[] = [
      'name',
      'slug',
      'icon_name',
      'tracks_count',
      'description',
    ];

    for (const key of allowedKeys) {
      if (key in updates) {
        fields.push(`${key} = ?`);
        values.push((updates as any)[key]);
      }
    }

    if (fields.length === 0) return existing;

    values.push(id);
    db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  delete(id: string): boolean {
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return true;
  }

  updateTracksCount(id: string, delta: number): void {
    db.prepare('UPDATE categories SET tracks_count = MAX(0, tracks_count + ?) WHERE id = ?').run(
      delta,
      id
    );
  }
}
