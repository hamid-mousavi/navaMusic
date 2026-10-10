// server/adapters/webUrl/directAudio.ts
// آداپتور دریافت مستقیم فایل‌های صوتی با اعتبارسنجی ضد SSRF

import { validateSafeUrl } from '../ssrf.js';
import { candidateService } from '../../services/candidateService.js';
import { trackRepo } from '../../db/repos/index.js';
import { Source } from '../../db/types.js';

export async function processDirectAudio(url: string, source?: Source, title?: string) {
  // ۱. اعتبارسنجی ضد SSRF
  const safeUrl = await validateSafeUrl(url);

  // ۲. بررسی ضد تکرار بر اساس URL
  const existing = trackRepo.findBySource('web_url', safeUrl);
  if (existing) {
    return existing;
  }

  // ۳. دانلود فایل صوتی
  const response = await fetch(safeUrl, {
    headers: { 'User-Agent': 'navaMusic/1.0 (+https://navamusic.app)' },
  });

  if (!response.ok) {
    throw new Error(`خطا در دانلود فایل صوتی: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const finalTitle =
    title ||
    source?.title ||
    safeUrl.split('/').pop()?.replace(/\.[^/.]+$/, '') ||
    'نوای استخراج شده از وب';

  // ۴. ورود به خط لوله استیجینگ
  return await candidateService.ingest({
    buffer,
    title: finalTitle,
    sourceType: 'web_url',
    sourceExternalId: safeUrl,
    sourceUrl: safeUrl,
    reciterId: source?.default_reciter_id || undefined,
    categoryId: source?.default_category_id || undefined,
    autoPublish: source ? source.auto_publish === 1 : false,
    actor: 'adapter_direct_audio',
  });
}
