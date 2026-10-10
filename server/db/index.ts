// server/db/index.ts
// اتصال پایگاه داده SQLite و اجرای خودکار Migrationها

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');

const DB_PATH = path.join(DATA_DIR, 'app.db');

// اطمینان از وجود پوشه داده‌ها
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// باز کردن اتصال پایگاه داده
export const db = new DatabaseSync(DB_PATH);

// فعال‌سازی حالت‌های اجرایی امن و پرسرعت بر اساس مستند فنی
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

// -------------------------------------------------------------
// سیستم مایگریشن خودکار
// -------------------------------------------------------------
function runMigrations() {
  // ۱. ساخت جدول رهگیری مایگریشن‌ها در صورت عدم وجود
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationsDir = path.join(process.cwd(), 'server', 'db', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  // خواندن فایل‌های sql به ترتیب شماره نسخه
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const getMigrationStmt = db.prepare('SELECT version FROM schema_migrations WHERE version = ?');
  const recordMigrationStmt = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
  );

  for (const file of files) {
    const match = file.match(/^(\d+)_(.+)\.sql$/);
    if (!match) continue;

    const version = parseInt(match[1], 10);
    const name = match[2];

    const existing = getMigrationStmt.get(version);
    if (!existing) {
      console.log(`[Database Migration] Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      db.exec(sql);
      recordMigrationStmt.run(version, name, new Date().toISOString());
      console.log(`[Database Migration] Applied ${file} successfully.`);
    }
  }
}

// اجرای مایگریشن‌ها هنگام لود اولیه ماژول
try {
  runMigrations();
} catch (err) {
  console.error('[Database Migration] Error running migrations:', err);
  throw err;
}

// -------------------------------------------------------------
// پشتیبان‌گیری دوره‌ای از دیتابیس (VACUUM INTO)
// -------------------------------------------------------------
export function backupDatabase(targetFolder?: string): string | null {
  try {
    const backupDir = targetFolder || path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup_app_${timestamp}.db`);

    // ایجاد یک رونوشت فشرده و امن از دیتابیس با VACUUM INTO
    db.exec(`VACUUM INTO '${backupFile.replace(/'/g, "''")}';`);
    console.log(`[Database Backup] Created backup at ${backupFile}`);

    // پاکسازی نسخه‌های قدیمی‌تر (نگهداری حداکثر ۱۴ نسخه مطابق مستند)
    const allBackups = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('backup_app_') && f.endsWith('.db'))
      .sort();

    if (allBackups.length > 14) {
      const toDelete = allBackups.slice(0, allBackups.length - 14);
      for (const delFile of toDelete) {
        fs.unlinkSync(path.join(backupDir, delFile));
      }
    }

    return backupFile;
  } catch (err) {
    console.error('[Database Backup] Error creating backup:', err);
    return null;
  }
}
