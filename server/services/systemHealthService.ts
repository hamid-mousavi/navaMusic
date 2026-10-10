// server/services/systemHealthService.ts
// پایش سلامت همه‌جانبه سیستم، منابع سرور و پاکسازی خودکار (System Health & Observability)

import os from 'os';
import path from 'path';
import fs from 'fs';
import { db } from '../db/index.js';
import {
  trackRepo,
  reciterRepo,
  categoryRepo,
  sourceRepo,
  scanJobRepo,
  userRepo,
  auditRepo,
  takedownRepo,
} from '../db/repos/index.js';
import { storageService } from './storageService.js';
import { backupService } from './backupService.js';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');

const DB_PATH = path.join(DATA_DIR, 'app.db');
const STAGING_DIR = path.join(DATA_DIR, 'staging');

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts = [];
  if (d > 0) parts.push(`${d} روز`);
  if (h > 0) parts.push(`${h} ساعت`);
  if (m > 0) parts.push(`${m} دقیقه`);
  parts.push(`${s} ثانیه`);
  return parts.join(' و ');
}

export class SystemHealthService {
  /**
   * دریافت گزارش جامع از تمام بخش‌ها و منابع سامانه
   */
  public getComprehensiveHealth() {
    const memory = process.memoryUsage();
    const uptimeSec = Math.floor(process.uptime());

    // ۱. اطلاعات سخت‌افزاری و پروسه
    const system = {
      uptimeSeconds: uptimeSec,
      uptimeFormatted: formatUptime(uptimeSec),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuCount: os.cpus().length,
      freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
      totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
      processMemory: {
        rssMb: (memory.rss / (1024 * 1024)).toFixed(2),
        heapUsedMb: (memory.heapUsed / (1024 * 1024)).toFixed(2),
        heapTotalMb: (memory.heapTotal / (1024 * 1024)).toFixed(2),
        externalMb: (memory.external / (1024 * 1024)).toFixed(2),
      },
    };

    // ۲. وضعیت پایگاه داده SQLite
    let dbSizeBytes = 0;
    try {
      if (fs.existsSync(DB_PATH)) {
        dbSizeBytes = fs.statSync(DB_PATH).size;
      }
    } catch (_) {}

    const integrity = backupService.checkIntegrity();
    const publishedCount = trackRepo.listPublished({ limit: 1, offset: 0 }).total;
    const pendingCount = trackRepo.countByStatus('pending');
    const uploadingCount = trackRepo.countByStatus('uploading');
    const rejectedCount = trackRepo.countByStatus('rejected');
    const uploadFailedCount = trackRepo.countByStatus('upload_failed');
    const hiddenCount = trackRepo.countByStatus('hidden');
    const totalTracks =
      publishedCount +
      pendingCount +
      uploadingCount +
      rejectedCount +
      uploadFailedCount +
      hiddenCount;

    const database = {
      dbSizeBytes,
      dbSizeFormatted: (dbSizeBytes / (1024 * 1024)).toFixed(2) + ' MB',
      integrityOk: integrity.ok,
      integrityDetails: integrity,
      stats: {
        totalTracks,
        publishedCount,
        pendingCount,
        uploadingCount,
        rejectedCount,
        uploadFailedCount,
        recitersCount: reciterRepo.findAll().length,
        categoriesCount: categoryRepo.findAll().length,
        sourcesCount: sourceRepo.findAll().length,
        scanJobsCount: scanJobRepo.findAll(100).length,
        usersCount: userRepo.findAll().length,
        takedownRequestsCount: takedownRepo.findAll(100).length,
      },
    };

    // ۳. وضعیت استیجینگ محلی
    let stagingFilesCount = 0;
    let stagingSizeBytes = 0;
    let oldestFileHours = 0;

    if (fs.existsSync(STAGING_DIR)) {
      try {
        const files = fs.readdirSync(STAGING_DIR);
        stagingFilesCount = files.length;
        const now = Date.now();

        for (const f of files) {
          const p = path.join(STAGING_DIR, f);
          try {
            const st = fs.statSync(p);
            stagingSizeBytes += st.size;
            const ageHours = (now - st.mtimeMs) / (1000 * 3600);
            if (ageHours > oldestFileHours) {
              oldestFileHours = ageHours;
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    const staging = {
      path: STAGING_DIR,
      filesCount: stagingFilesCount,
      sizeBytes: stagingSizeBytes,
      sizeMb: (stagingSizeBytes / (1024 * 1024)).toFixed(2),
      oldestFileHours: Math.round(oldestFileHours),
      ttlDays: parseInt(process.env.STAGING_TTL_DAYS || '7', 10),
    };

    // ۴. وضعیت فضای ابری S3 ابر آروان
    const arvan = {
      isConfigured: !!(process.env.ARVAN_ACCESS_KEY && process.env.ARVAN_SECRET_KEY),
      bucket: process.env.ARVAN_BUCKET || 'madahi-media-vault',
      endpoint: process.env.ARVAN_ENDPOINT || 'https://s3.ir-thr-at1.arvanstorage.ir',
      cdnDomain: process.env.ARVAN_CDN_DOMAIN || '',
    };

    // ۵. وضعیت ربات تلگرام
    const telegram = {
      isBotConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
      targetChannel: process.env.TELEGRAM_TARGET_CHANNEL || '@madahi_channel',
      internalTokenConfigured: !!process.env.INTERNAL_API_TOKEN,
    };

    // ۶. وضعیت نسخه‌های پشتیبان
    const backups = backupService.listBackups();

    return {
      success: true,
      timestamp: new Date().toISOString(),
      status: integrity.ok ? 'healthy' : 'degraded',
      system,
      database,
      staging,
      arvan,
      telegram,
      backupsSummary: {
        totalBackups: backups.length,
        latestBackupAt: backups[0]?.createdAt || null,
      },
    };
  }

  /**
   * اجرای عملیات پاکسازی و بهینه‌سازی سراسری سیستم
   */
  public runSystemCleanup(options?: {
    stagingTtlDays?: number;
    auditRetentionDays?: number;
    actor?: string;
  }): {
    cleanedStagingFiles: number;
    cleanedAuditLogs: number;
    databaseOptimized: boolean;
  } {
    const actor = options?.actor || 'admin';
    const stagingTtl = options?.stagingTtlDays ?? parseInt(process.env.STAGING_TTL_DAYS || '7', 10);
    const auditRetention = options?.auditRetentionDays ?? 60;

    // ۱. پاکسازی فایل‌های منقضی استیجینگ
    const cleanedStagingFiles = storageService.cleanupExpiredStaging(stagingTtl);

    // ۲. پاکسازی لاگ‌های قدیمی ممیزی
    let cleanedAuditLogs = 0;
    try {
      const cutoffDate = new Date(Date.now() - auditRetention * 24 * 60 * 60 * 1000).toISOString();
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM audit_log WHERE at < ?');
      const row: any = countStmt.get(cutoffDate);
      cleanedAuditLogs = row?.count || 0;

      if (cleanedAuditLogs > 0) {
        db.prepare('DELETE FROM audit_log WHERE at < ?').run(cutoffDate);
      }
    } catch (err) {
      console.error('[HealthService] Error cleaning audit logs:', err);
    }

    // ۳. بهینه‌سازی دیتابیس با PRAGMA optimize
    let databaseOptimized = false;
    try {
      db.exec('PRAGMA optimize;');
      databaseOptimized = true;
    } catch (err) {
      console.error('[HealthService] Error running PRAGMA optimize:', err);
    }

    // ثبت در ممیزی
    auditRepo.log({
      actor_type: 'web',
      actor_id: actor,
      action: 'system_cleanup_executed',
      entity: 'system',
      entity_id: null,
      meta_json: JSON.stringify({
        cleanedStagingFiles,
        cleanedAuditLogs,
        databaseOptimized,
        stagingTtl,
        auditRetention,
      }),
    });

    return {
      cleanedStagingFiles,
      cleanedAuditLogs,
      databaseOptimized,
    };
  }
}

export const systemHealthService = new SystemHealthService();
