// server/services/storageService.ts
// مدیریت فایل‌های استیجینگ محلی و آپلود ابری در ابر آروان (S3)

import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { trackRepo, auditRepo } from '../db/repos/index.js';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');

const STAGING_DIR = path.join(DATA_DIR, 'staging');

// اطمینان از وجود پوشه استیجینگ
if (!fs.existsSync(STAGING_DIR)) {
  fs.mkdirSync(STAGING_DIR, { recursive: true });
}

export class StorageService {
  /**
   * دریافت مسیر کامل پوشه استیجینگ
   */
  public getStagingDir(): string {
    return STAGING_DIR;
  }

  /**
   * ایجاد مسیر فایل جدید در استیجینگ
   */
  public getStagingPath(filename: string): string {
    return path.join(STAGING_DIR, filename);
  }

  /**
   * ذخیره بافر یا استریم ورودی در استیجینگ
   */
  public async saveToStaging(filename: string, buffer: Buffer): Promise<string> {
    const targetPath = this.getStagingPath(filename);
    await fs.promises.writeFile(targetPath, buffer);
    return targetPath;
  }

  /**
   * استریم فایل صوتی کاندید از استیجینگ با پشتیبانی کامل از Range Header (HTTP 206)
   */
  public streamStagingFile(filePath: string, req: Request, res: Response): boolean {
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'فایل کاندید در استیجینگ یافت نشد.' });
      return false;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // تعیین پسوند و نوع MIME
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.m4a' ? 'audio/mp4' : ext === '.ogg' ? 'audio/ogg' : 'audio/mpeg';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
        return false;
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }

    return true;
  }

  /**
   * حذف فایل از استیجینگ
   */
  public deleteStagingFile(filePath: string | null): boolean {
    if (!filePath) return false;
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch (err) {
      console.warn(`[StorageService] Could not delete staging file ${filePath}:`, err);
    }
    return false;
  }

  /**
   * ساخت کلاینت S3 ابر آروان
   */
  private getS3Client(): { client: S3Client; bucket: string; endpoint: string; cdnDomain: string } | null {
    const accessKey = process.env.ARVAN_ACCESS_KEY;
    const secretKey = process.env.ARVAN_SECRET_KEY;
    const bucket = process.env.ARVAN_BUCKET || process.env.ARVAN_BUCKET_NAME || 'madahi-media-vault';
    const endpoint =
      process.env.ARVAN_ENDPOINT ||
      process.env.ARVAN_S3_ENDPOINT ||
      'https://s3.ir-thr-at1.arvanstorage.ir';
    const region = process.env.ARVAN_REGION || process.env.ARVAN_S3_REGION || 'ir-thr-at1';
    const cdnDomain = process.env.ARVAN_CDN_DOMAIN || '';

    if (!accessKey || !secretKey) {
      return null;
    }

    const client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });

    return { client, bucket, endpoint, cdnDomain };
  }

  /**
   * آپلود کاندید تأیید شده به ابر آروان
   * کلید: audio/YYYY-MM/<trackId>.<ext>
   */
  public async uploadCandidateToArvan(
    stagingPath: string,
    trackId: string
  ): Promise<{ s3Key: string; audioUrl: string }> {
    if (!fs.existsSync(stagingPath)) {
      throw new Error(`فایل استیجینگ در مسیر یافت نشد: ${stagingPath}`);
    }

    const s3Config = this.getS3Client();
    if (!s3Config) {
      throw new Error('کلیدهای دسترسی ابر آروان در متغیرهای محیطی تنظیم نشده‌اند.');
    }

    const fileExt = path.extname(stagingPath).replace('.', '') || 'mp3';
    const datePrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
    const s3Key = `audio/${datePrefix}/${trackId}.${fileExt}`;

    const fileBuffer = await fs.promises.readFile(stagingPath);
    const contentType = fileExt === 'm4a' ? 'audio/mp4' : 'audio/mpeg';

    const command = new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read',
    });

    await s3Config.client.send(command);

    // تولید آدرس دسترسی عمومی
    let audioUrl = '';
    if (s3Config.cdnDomain) {
      const cleanCdn = s3Config.cdnDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      audioUrl = `https://${cleanCdn}/${s3Key}`;
    } else {
      const cleanEndpoint = s3Config.endpoint.replace(/\/$/, '');
      audioUrl = `${cleanEndpoint}/${s3Config.bucket}/${s3Key}`;
    }

    // حذف فایل استیجینگ پس از موفقیت در آپلود بر اساس قاعده D4 مستند
    this.deleteStagingFile(stagingPath);

    return { s3Key, audioUrl };
  }

  /**
   * پاک‌سازی فایل‌های منقضی شده استیجینگ (STAGING_TTL_DAYS)
   */
  public cleanupExpiredStaging(days = 7): number {
    try {
      if (!fs.existsSync(STAGING_DIR)) return 0;
      const files = fs.readdirSync(STAGING_DIR);
      const now = Date.now();
      const ttlMs = days * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const fullPath = path.join(STAGING_DIR, file);
        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > ttlMs) {
            fs.unlinkSync(fullPath);
            deletedCount++;
          }
        } catch (_) {}
      }

      if (deletedCount > 0) {
        auditRepo.log({
          actor_type: 'system',
          actor_id: 'staging_cleaner',
          action: 'staging_cleanup',
          entity: 'storage',
          entity_id: null,
          meta_json: JSON.stringify({ deletedCount, ttlDays: days }),
        });
      }

      return deletedCount;
    } catch (err) {
      console.error('[StorageService] Error cleaning expired staging files:', err);
      return 0;
    }
  }
}

export const storageService = new StorageService();
