// server/scheduler/index.ts
// زمان‌بند درون‌پروسه‌ای و صف اسکن منابع (In-process Queue & Scheduler)

import { sourceRepo, scanJobRepo, auditRepo } from '../db/repos/index.js';
import { Source, ScanJob } from '../db/types.js';
import { sourceService } from '../services/sourceService.js';
import { youtubeAdapter } from '../adapters/youtube.js';
import { webAdapter } from '../adapters/webUrl/index.js';

class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private runningSources = new Set<string>(); // قفل هر منبع حداکثر ۱ اسکن همزمان
  private activeConcurrency = 0; // حداکثر ۲ اسکن همزمان در کل سیستم
  private readonly MAX_CONCURRENT_SCANS = 2;

  /**
   * شروع تایمر بررسی خودکار منابع سررسید شده
   */
  public start(intervalMs = 60000): void {
    if (this.timer) return;
    console.log('[Scheduler] Background scheduler started.');
    this.timer = setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Scheduler] Background scheduler stopped.');
    }
  }

  /**
   * اجرای دوره‌ای برای منابع سررسید شده
   */
  private async tick(): Promise<void> {
    try {
      const dueSources = sourceService.getDueSources();
      for (const source of dueSources) {
        if (this.activeConcurrency >= this.MAX_CONCURRENT_SCANS) {
          break; // سقف موازی‌سازی پر است، در دور بعد انجام می‌شود
        }
        if (this.runningSources.has(source.id)) {
          continue;
        }
        // اجرای غیرمسدودکننده
        this.executeScan(source, 'scheduled').catch((err) =>
          console.error(`[Scheduler] Error in scheduled scan for ${source.id}:`, err)
        );
      }
    } catch (err) {
      console.error('[Scheduler] Error during tick:', err);
    }
  }

  /**
   * اسکن دستی یک منبع مشخص
   */
  public async scanSource(sourceId: string, trigger: 'manual' | 'scheduled' | 'bot' = 'manual'): Promise<ScanJob> {
    const source = sourceRepo.findById(sourceId);
    if (!source) {
      throw new Error(`منبع با شناسه ${sourceId} یافت نشد.`);
    }

    if (this.runningSources.has(sourceId)) {
      throw new Error('اسکن این منبع هم‌اکنون در حال اجرا است.');
    }

    return await this.executeScan(source, trigger);
  }

  /**
   * اسکن تمامی منابع فعال
   */
  public async scanAllDue(): Promise<void> {
    const all = sourceRepo.findAll().filter((s) => s.enabled === 1);
    for (const source of all) {
      if (!this.runningSources.has(source.id)) {
        this.executeScan(source, 'manual').catch((err) =>
          console.error(`[Scheduler] Error scanning ${source.id}:`, err)
        );
      }
    }
  }

  /**
   * منطق اجرایی اسکن با صف و کنترل خطا
   */
  private async executeScan(source: Source, trigger: 'manual' | 'scheduled' | 'bot'): Promise<ScanJob> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const job: ScanJob = {
      id: jobId,
      source_id: source.id,
      trigger,
      status: 'running',
      found: 0,
      new_count: 0,
      error: null,
      started_at: new Date().toISOString(),
      finished_at: null,
    };

    scanJobRepo.create(job);
    this.runningSources.add(source.id);
    this.activeConcurrency++;

    sourceRepo.update(source.id, {
      last_run_at: new Date().toISOString(),
      last_status: 'running',
    });

    auditRepo.log({
      actor_type: 'worker',
      actor_id: 'scheduler',
      action: 'scan_started',
      entity: 'sources',
      entity_id: source.id,
      meta_json: JSON.stringify({ jobId, trigger, title: source.title }),
    });

    let foundCount = 0;
    let newCount = 0;
    let errorMsg: string | null = null;

    try {
      // انتخاب آداپتور مناسب بر اساس نوع منبع
      if (source.type === 'youtube_channel') {
        const items = await youtubeAdapter.scan(source);
        foundCount = items.length;

        for (const item of items) {
          try {
            const ingested = await youtubeAdapter.downloadAndIngest(item, source);
            if (ingested) newCount++;
          } catch (itemErr: any) {
            console.warn(`[Scheduler] Could not ingest item ${item.title}:`, itemErr.message);
          }
        }
      } else if (source.type === 'web_url') {
        const items = await webAdapter.scan(source);
        foundCount = items.length;

        for (const item of items) {
          try {
            const ingested = await webAdapter.downloadAndIngest(item, source);
            if (ingested) newCount++;
          } catch (itemErr: any) {
            console.warn(`[Scheduler] Could not ingest web item ${item.title}:`, itemErr.message);
          }
        }
      } else if (source.type === 'telegram_channel') {
        // کانال تلگرام توسط ورکر پایتون (Telethon) از طریق /api/internal/ingest پردازش می‌شود
        foundCount = 0;
        newCount = 0;
      }

      // به‌روزرسانی موفق جاب
      scanJobRepo.update(jobId, {
        status: 'done',
        found: foundCount,
        new_count: newCount,
        finished_at: new Date().toISOString(),
      });

      sourceRepo.update(source.id, {
        last_status: `success (${newCount} جدید)`,
      });

      auditRepo.log({
        actor_type: 'worker',
        actor_id: 'scheduler',
        action: 'scan_finished',
        entity: 'sources',
        entity_id: source.id,
        meta_json: JSON.stringify({ jobId, foundCount, newCount }),
      });
    } catch (scanErr: any) {
      errorMsg = scanErr.message || 'خطای ناشناخته در اسکن منبع';
      console.error(`[Scheduler] Scan failed for source ${source.id}:`, scanErr);

      scanJobRepo.update(jobId, {
        status: 'failed',
        error: errorMsg,
        finished_at: new Date().toISOString(),
      });

      sourceRepo.update(source.id, {
        last_status: `failed: ${(errorMsg || '').slice(0, 50)}`,
      });

      auditRepo.log({
        actor_type: 'worker',
        actor_id: 'scheduler',
        action: 'scan_failed',
        entity: 'sources',
        entity_id: source.id,
        meta_json: JSON.stringify({ jobId, error: errorMsg }),
      });
    } finally {
      this.runningSources.delete(source.id);
      this.activeConcurrency = Math.max(0, this.activeConcurrency - 1);
    }

    return scanJobRepo.findById(jobId)!;
  }
}

export const scheduler = new Scheduler();
