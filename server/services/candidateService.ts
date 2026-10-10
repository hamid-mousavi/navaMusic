// server/services/candidateService.ts
// جریان پردازش کاندیدها، فیلتر ضد تکرار، ffmpeg و استیجینگ بر اساس بخش ۶ مستند

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { trackRepo, reciterRepo, categoryRepo, auditRepo } from '../db/repos/index.js';
import { storageService } from './storageService.js';
import { metadataService } from './metadataService.js';
import { botService } from '../bot/botService.js';
import { Track } from '../db/types.js';

const execFileAsync = promisify(execFile);

export interface IngestOptions {
  buffer?: Buffer;
  localFilePath?: string;
  title: string;
  sourceType: string;
  sourceExternalId?: string;
  sourceUrl?: string;
  sourceOwnerName?: string;
  reciterId?: string;
  categoryId?: string;
  occasion?: string;
  tags?: string[];
  autoPublish?: boolean;
  actor?: string;
}

export class CandidateService {
  /**
   * محاسبه هش محتوای فایل صوتی (SHA-256) جهت ضد تکرار
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const fileStream = fs.createReadStream(filePath);
    return new Promise((resolve, reject) => {
      fileStream.on('data', (data) => hash.update(data));
      fileStream.on('end', () => resolve(hash.digest('hex')));
      fileStream.on('error', (err) => reject(err));
    });
  }

  /**
   * استخراج مدت زمان فایل صوتی با ffprobe
   */
  private async probeAudioDuration(filePath: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ]);
      const durationSeconds = parseFloat(stdout.trim());
      return Math.round(durationSeconds) || 0;
    } catch (_) {
      return 0;
    }
  }

  /**
   * تبدیل و نرمال‌سازی فایل با ffmpeg به MP3 ۳۲۰kbps
   */
  private async convertToStandardMp3(inputPath: string, outputPath: string): Promise<void> {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ar',
      '44100',
      '-ac',
      '2',
      '-b:a',
      '320k',
      outputPath,
    ]);
  }

  /**
   * دریافت و پردازش کاندید جدید (Ingest Pipeline)
   */
  public async ingest(options: IngestOptions): Promise<Track> {
    const trackId = `track-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // ۱. بررسی ضد تکرار قبل از دانلود با (source_type, source_external_id)
    if (options.sourceType && options.sourceExternalId) {
      const existingBySource = trackRepo.findBySource(
        options.sourceType,
        options.sourceExternalId
      );
      if (existingBySource) {
        console.log(`[CandidateService] Duplicate track detected by source ID: ${options.sourceExternalId}`);
        return existingBySource;
      }
    }

    // ۲. ذخیره فایل ورودی در مسیر موقت اولیه
    let tempRawPath = '';
    if (options.buffer) {
      tempRawPath = storageService.getStagingPath(`raw-${trackId}.tmp`);
      await fs.promises.writeFile(tempRawPath, options.buffer);
    } else if (options.localFilePath) {
      tempRawPath = options.localFilePath;
    } else {
      throw new Error('فایل صوتی جهت پردازش ارائه نشده است.');
    }

    // ۳. پردازش و تبدیل با ffmpeg به MP3 استاندارد در staging
    const stagingMp3Path = storageService.getStagingPath(`${trackId}.mp3`);
    try {
      await this.convertToStandardMp3(tempRawPath, stagingMp3Path);
    } catch (ffmpegErr: any) {
      // فایل‌های خراب به عنوان کاندید pending ثبت نشوند (قاعده بخش ۶)
      storageService.deleteStagingFile(tempRawPath);
      storageService.deleteStagingFile(stagingMp3Path);
      throw new Error(`خطای پردازش رسانه با ffmpeg (فایل خراب یا نامعتبر): ${ffmpegErr.message}`);
    }

    // پاکسازی فایل خام موقت
    if (options.buffer && fs.existsSync(tempRawPath)) {
      storageService.deleteStagingFile(tempRawPath);
    }

    // ۴. استخراج اطلاعات فایل (مدت، حجم، هش محتوا)
    const duration = await this.probeAudioDuration(stagingMp3Path);
    const stat = fs.statSync(stagingMp3Path);
    const fileSizeMb = parseFloat((stat.size / (1024 * 1024)).toFixed(2));
    const contentHash = await this.calculateFileHash(stagingMp3Path);

    // ۵. بررسی ضد تکرار بعد از پردازش با content_hash (SHA-256)
    const existingByHash = trackRepo.findByContentHash(contentHash);
    if (existingByHash) {
      console.log(`[CandidateService] Duplicate track detected by content hash: ${contentHash}`);
      storageService.deleteStagingFile(stagingMp3Path);
      return existingByHash;
    }

    // ۶. استعلام پیشنهاد هوشمند متادیتا از Gemini
    let aiSuggestionJson: string | null = null;
    try {
      const suggestion = await metadataService.suggestMetadata(options.title);
      if (suggestion) {
        aiSuggestionJson = JSON.stringify(suggestion);
      }
    } catch (_) {}

    // ۷. درج کاندید در دیتابیس با وضعیت pending
    const newTrack: Track = {
      id: trackId,
      title: options.title,
      reciter_id: options.reciterId || null,
      category_id: options.categoryId || null,
      occasion: options.occasion || null,
      tags_json: JSON.stringify(options.tags || ['مداحی']),
      lyrics_json: '[]',
      duration,
      bitrate: '320 kbps',
      file_size: fileSizeMb,
      content_hash: contentHash,
      source_id: null,
      source_type: options.sourceType,
      source_external_id: options.sourceExternalId || trackId,
      source_url: options.sourceUrl || null,
      source_owner_name: options.sourceOwnerName || null,
      staging_path: stagingMp3Path,
      s3_key: null,
      audio_url: null,
      cover_url: '',
      ai_suggestion_json: aiSuggestionJson,
      status: 'pending',
      reject_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      published_at: null,
      channel_message_id: null,
      play_count: 0,
      created_at: new Date().toISOString(),
    };

    trackRepo.create(newTrack);

    auditRepo.log({
      actor_type: (options.actor as any) || 'web',
      actor_id: null,
      action: 'candidate_ingested',
      entity: 'tracks',
      entity_id: trackId,
      meta_json: JSON.stringify({
        title: options.title,
        duration,
        fileSizeMb,
        sourceType: options.sourceType,
      }),
    });

    // اطلاع‌رسانی آنی به ادمین‌های تلگرام دارای شناسه معتبر
    botService.notifyAdminsNewCandidate(newTrack).catch((e) =>
      console.warn('[CandidateService] Telegram admin notify notice:', e.message)
    );

    // ۸. در صورت فعال بودن انتشار خودکار (auto_publish) منبع، انتشار مستقیم انجام شود
    if (options.autoPublish) {
      try {
        return await this.approve(trackId, { actor: 'system' });
      } catch (err) {
        console.warn(`[CandidateService] Auto-publish failed for ${trackId}:`, err);
      }
    }

    return newTrack;
  }

  /**
   * تأیید و انتشار کاندید (Idempotent: pending -> uploading -> published)
   */
  public async approve(
    id: string,
    overrides?: Partial<Track> & { actor?: string }
  ): Promise<Track> {
    const track = trackRepo.findById(id);
    if (!track) {
      throw new Error(`اثر با شناسه ${id} یافت نشد.`);
    }

    // قاعده Idempotent: اگر قبلاً تأیید یا در حال آپلود است، دوباره کاری نکن
    if (track.status === 'published') {
      return track;
    }
    if (track.status === 'uploading') {
      return track;
    }

    // تغییر وضعیت اتمی به uploading جهت قفل همزمانی
    trackRepo.update(id, { status: 'uploading' });

    try {
      const stagingPath = track.staging_path;
      if (!stagingPath || !fs.existsSync(stagingPath)) {
        throw new Error('فایل استیجینگ جهت آپلود در دیسک سرور یافت نشد.');
      }

      // آپلود در ابر آروان و پاکسازی فایل محلی پس از موفقیت
      const { s3Key, audioUrl } = await storageService.uploadCandidateToArvan(stagingPath, id);

      const publishedTrack = trackRepo.update(id, {
        ...overrides,
        status: 'published',
        s3_key: s3Key,
        audio_url: audioUrl,
        staging_path: null,
        published_at: new Date().toISOString(),
        reviewed_by: overrides?.actor || 'admin',
        reviewed_at: new Date().toISOString(),
      });

      // به‌روزرسانی شمارنده‌ها
      if (publishedTrack?.reciter_id) {
        reciterRepo.updateTracksCount(publishedTrack.reciter_id, +1);
      }
      if (publishedTrack?.category_id) {
        categoryRepo.updateTracksCount(publishedTrack.category_id, +1);
      }
      categoryRepo.updateTracksCount('cat-all', +1);

      auditRepo.log({
        actor_type: overrides?.actor === 'system' ? 'system' : 'web',
        actor_id: null,
        action: 'candidate_approved_and_published',
        entity: 'tracks',
        entity_id: id,
        meta_json: JSON.stringify({ s3Key, audioUrl, actor: overrides?.actor || 'admin' }),
      });

      return publishedTrack!;
    } catch (uploadErr: any) {
      // در صورت خطای آپلود در آروان، وضعیت به upload_failed تغییر می‌کند و فایل staging حفظ می‌شود
      console.error(`[CandidateService] Upload to Arvan failed for track ${id}:`, uploadErr);
      trackRepo.update(id, {
        status: 'upload_failed',
        reject_reason: `خطای آپلود در ابر آروان: ${uploadErr.message}`,
      });

      auditRepo.log({
        actor_type: 'system',
        actor_id: null,
        action: 'upload_failed',
        entity: 'tracks',
        entity_id: id,
        meta_json: JSON.stringify({ error: uploadErr.message }),
      });

      throw uploadErr;
    }
  }

  /**
   * رد کاندید و حذف فایل موقت از دیسک
   */
  public async reject(id: string, reason = 'رد توسط مدیر', actor = 'admin'): Promise<Track> {
    const track = trackRepo.findById(id);
    if (!track) {
      throw new Error(`کاندید با شناسه ${id} یافت نشد.`);
    }

    // حذف فایل استیجینگ بر اساس قاعده مستند
    if (track.staging_path) {
      storageService.deleteStagingFile(track.staging_path);
    }

    const updated = trackRepo.update(id, {
      status: 'rejected',
      reject_reason: reason,
      staging_path: null,
      reviewed_by: actor,
      reviewed_at: new Date().toISOString(),
    });

    auditRepo.log({
      actor_type: 'web',
      actor_id: null,
      action: 'candidate_rejected',
      entity: 'tracks',
      entity_id: id,
      meta_json: JSON.stringify({ reason, actor }),
    });

    return updated!;
  }

  /**
   * تلاش مجدد برای آپلود فایل‌های با وضعیت upload_failed
   */
  public async retryUpload(id: string, actor = 'admin'): Promise<Track> {
    const track = trackRepo.findById(id);
    if (!track) {
      throw new Error(`کاندید با شناسه ${id} یافت نشد.`);
    }

    if (track.status !== 'upload_failed' && track.status !== 'pending') {
      throw new Error(`تنها کاندیدهای ناموفق یا در انتظار مجاز به تلاش مجدد هستند. وضعیت جاری: ${track.status}`);
    }

    return this.approve(id, { actor });
  }
}

export const candidateService = new CandidateService();
