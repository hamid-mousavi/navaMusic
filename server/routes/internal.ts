// server/routes/internal.ts
// وب‌سرویس اختصاصی ارتباط ورکرها (Telethon و پردازش‌ها) با سامانه مرکزی

import { Router } from 'express';
import multer from 'multer';
import { requireInternalToken } from '../middleware/auth.js';
import { sourceRepo, scanJobRepo } from '../db/repos/index.js';
import { sourceService } from '../services/sourceService.js';
import { candidateService } from '../services/candidateService.js';

const router = Router();
const upload = multer({ limits: { fileSize: 150 * 1024 * 1024 } }); // تا ۱۵۰ مگابایت

// همه مسیرهای این ماژول ملزم به داشتن INTERNAL_API_TOKEN معتبر هستند
router.use(requireInternalToken);

/**
 * ۱. دریافت فهرست منابع نیازمند اسکن جهت ورکر تلگرام یا ورکر خارجی
 */
router.get('/sources', (req, res) => {
  const typeFilter = req.query.type as string;
  const dueOnly = req.query.due === '1' || req.query.due === 'true';

  let sources = dueOnly ? sourceService.getDueSources() : sourceRepo.findAll();

  if (typeFilter) {
    sources = sources.filter((s) => s.type === typeFilter);
  }

  res.json({
    success: true,
    sources: sources.map((s) => ({
      id: s.id,
      type: s.type,
      ref: s.ref,
      title: s.title,
      schedule: s.schedule,
      auto_publish: s.auto_publish === 1,
      default_reciter_id: s.default_reciter_id,
      default_category_id: s.default_category_id,
      filters: JSON.parse(s.filters_json || '{}'),
      last_run_at: s.last_run_at,
    })),
  });
});

/**
 * ۲. دریافت فایل صوتی و متادیتا از ورکر تلگرام و ارسال به خط لوله کاندیدها (Ingest)
 */
router.post('/ingest', upload.single('audio') as any, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'فایل صوتی ارسال نشده است.' });
    }

    const {
      title,
      sourceType,
      sourceExternalId,
      sourceUrl,
      sourceOwnerName,
      reciterId,
      categoryId,
      occasion,
      tags,
      autoPublish,
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'عنوان قطعه الزامی است.' });
    }

    let parsedTags: string[] = [];
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (_) {
        parsedTags = [String(tags)];
      }
    }

    const candidate = await candidateService.ingest({
      buffer: file.buffer,
      title: String(title).trim(),
      sourceType: sourceType || 'telegram_channel',
      sourceExternalId: sourceExternalId ? String(sourceExternalId) : undefined,
      sourceUrl: sourceUrl ? String(sourceUrl) : undefined,
      sourceOwnerName: sourceOwnerName ? String(sourceOwnerName) : undefined,
      reciterId: reciterId || undefined,
      categoryId: categoryId || undefined,
      occasion: occasion || undefined,
      tags: parsedTags,
      autoPublish: autoPublish === 'true' || autoPublish === '1' || autoPublish === true,
      actor: 'worker_telegram',
    });

    res.json({
      success: true,
      candidate: {
        id: candidate.id,
        title: candidate.title,
        status: candidate.status,
        duration: candidate.duration,
        file_size: candidate.file_size,
        content_hash: candidate.content_hash,
      },
    });
  } catch (err: any) {
    console.error('[InternalAPI] Ingest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ۳. گزارش اتمام یا خطای اسکن یک منبع توسط ورکر خارجی
 */
router.post('/jobs/report', (req, res) => {
  try {
    const { sourceId, status, found, newCount, error } = req.body;
    if (!sourceId) {
      return res.status(400).json({ success: false, error: 'شناسه منبع الزامی است.' });
    }

    const job = scanJobRepo.create({
      id: `job-worker-${Date.now()}`,
      source_id: sourceId,
      trigger: 'bot',
      status: status || 'done',
      found: Number(found) || 0,
      new_count: Number(newCount) || 0,
      error: error || null,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    });

    sourceRepo.update(sourceId, {
      last_run_at: new Date().toISOString(),
      last_status: status === 'done' ? `success (${newCount} جدید)` : `failed: ${error || ''}`,
    });

    res.json({ success: true, job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
