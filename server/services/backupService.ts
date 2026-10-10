// server/services/backupService.ts
// مدیریت جامع نسخه‌های پشتیبان (Backup & Restore) و بررسی سلامت دیتابیس

import path from 'path';
import fs from 'fs';
import { db } from '../db/index.js';
import { auditRepo } from '../db/repos/index.js';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');

const BACKUP_DIR = path.join(DATA_DIR, 'backups');

export interface BackupItem {
  filename: string;
  type: 'sqlite' | 'json';
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  path: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export class BackupService {
  constructor() {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  /**
   * ایجاد نسخه پشتیبان فوری اتمیک از دیتابیس
   * شامل فایل باینری SQLite با VACUUM INTO و فایل ساخت‌یافته JSON
   */
  public createBackup(actor = 'admin'): {
    sqliteBackup: BackupItem;
    jsonBackup: BackupItem;
  } {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sqliteFilename = `backup_app_${timestamp}.db`;
    const jsonFilename = `backup_app_${timestamp}.json`;

    const sqlitePath = path.join(BACKUP_DIR, sqliteFilename);
    const jsonPath = path.join(BACKUP_DIR, jsonFilename);

    // ۱. تولید فایل SQLite با دستور ایمن VACUUM INTO
    db.exec(`VACUUM INTO '${sqlitePath.replace(/'/g, "''")}';`);
    const sqliteStat = fs.statSync(sqlitePath);

    // ۲. تولید خروجی کامل JSON با ساختار داده‌های همه جداول
    const tables = [
      'users',
      'reciters',
      'categories',
      'sources',
      'scan_jobs',
      'tracks',
      'audit_log',
      'settings',
      'takedown_requests',
    ];

    const dumpData: Record<string, any> = {
      version: 7,
      createdAt: new Date().toISOString(),
      metadata: {
        actor,
        engine: 'SQLite 3 (WAL)',
      },
      tables: {},
    };

    for (const table of tables) {
      try {
        const rows = db.prepare(`SELECT * FROM ${table}`).all();
        dumpData.tables[table] = rows;
      } catch (err: any) {
        dumpData.tables[table] = [];
      }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(dumpData, null, 2), 'utf8');
    const jsonStat = fs.statSync(jsonPath);

    // ثبت در ممیزی
    auditRepo.log({
      actor_type: 'web',
      actor_id: actor,
      action: 'database_backup_created',
      entity: 'database',
      entity_id: sqliteFilename,
      meta_json: JSON.stringify({
        sqliteSize: sqliteStat.size,
        jsonSize: jsonStat.size,
      }),
    });

    // سیاست نگهداری: حفظ حداکثر ۲۰ نسخه اخیر
    this.rotateBackups(20);

    return {
      sqliteBackup: {
        filename: sqliteFilename,
        type: 'sqlite',
        sizeBytes: sqliteStat.size,
        sizeFormatted: formatBytes(sqliteStat.size),
        createdAt: new Date().toISOString(),
        path: sqlitePath,
      },
      jsonBackup: {
        filename: jsonFilename,
        type: 'json',
        sizeBytes: jsonStat.size,
        sizeFormatted: formatBytes(jsonStat.size),
        createdAt: new Date().toISOString(),
        path: jsonPath,
      },
    };
  }

  /**
   * دریافت فهرست تمام نسخه‌های پشتیبان موجود
   */
  public listBackups(): BackupItem[] {
    if (!fs.existsSync(BACKUP_DIR)) return [];

    const files = fs.readdirSync(BACKUP_DIR);
    const result: BackupItem[] = [];

    for (const file of files) {
      if (!file.startsWith('backup_app_')) continue;
      const fullPath = path.join(BACKUP_DIR, file);

      try {
        const stat = fs.statSync(fullPath);
        const isDb = file.endsWith('.db');
        const isJson = file.endsWith('.json');

        if (isDb || isJson) {
          result.push({
            filename: file,
            type: isDb ? 'sqlite' : 'json',
            sizeBytes: stat.size,
            sizeFormatted: formatBytes(stat.size),
            createdAt: stat.mtime.toISOString(),
            path: fullPath,
          });
        }
      } catch (_) {}
    }

    // مرتب‌سازی از جدیدترین به قدیمی‌ترین
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * مسیر امن فایل بک‌آپ برای دانلود با محافظت در برابر Path Traversal
   */
  public getBackupFilePath(filename: string): string | null {
    // جلوگیری از Directory Traversal
    const safeName = path.basename(filename);
    const fullPath = path.join(BACKUP_DIR, safeName);

    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
    return null;
  }

  /**
   * حذف یک نسخه پشتیبان خاص
   */
  public deleteBackup(filename: string, actor = 'admin'): boolean {
    const safeName = path.basename(filename);
    const fullPath = path.join(BACKUP_DIR, safeName);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      auditRepo.log({
        actor_type: 'web',
        actor_id: actor,
        action: 'database_backup_deleted',
        entity: 'database',
        entity_id: safeName,
        meta_json: '{}',
      });
      return true;
    }
    return false;
  }

  /**
   * بررسی یکپارچگی و سلامت داده‌های دیتابیس با دستورات PRAGMA
   */
  public checkIntegrity(): {
    ok: boolean;
    integrityCheck: string;
    quickCheck: string;
    foreignKeyCheck: string;
  } {
    try {
      const integrityRow: any = db.prepare('PRAGMA integrity_check').get();
      const integrityCheck = integrityRow ? Object.values(integrityRow)[0] as string : 'ok';

      const quickRow: any = db.prepare('PRAGMA quick_check').get();
      const quickCheck = quickRow ? Object.values(quickRow)[0] as string : 'ok';

      const fkRows = db.prepare('PRAGMA foreign_key_check').all();
      const foreignKeyCheck = fkRows.length === 0 ? 'ok' : `${fkRows.length} خطای کلید خارجی شناسایی شد`;

      const ok =
        integrityCheck === 'ok' &&
        quickCheck === 'ok' &&
        fkRows.length === 0;

      return {
        ok,
        integrityCheck,
        quickCheck,
        foreignKeyCheck,
      };
    } catch (err: any) {
      return {
        ok: false,
        integrityCheck: err.message,
        quickCheck: err.message,
        foreignKeyCheck: err.message,
      };
    }
  }

  /**
   * چرخش و پاکسازی بک‌آپ‌های قدیمی
   */
  private rotateBackups(keepCount = 20): void {
    try {
      const backups = this.listBackups();
      if (backups.length > keepCount) {
        const toDelete = backups.slice(keepCount);
        for (const item of toDelete) {
          try {
            fs.unlinkSync(item.path);
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error('[BackupService] Error rotating backups:', err);
    }
  }
}

export const backupService = new BackupService();
