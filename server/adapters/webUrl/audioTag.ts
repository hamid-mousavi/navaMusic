// server/adapters/webUrl/audioTag.ts
// استخراج فایل‌های صوتی از صفحات وب دارای تگ‌های audio یا source

import { validateSafeUrl } from '../ssrf.js';
import { DiscoveredItem } from '../types.js';
import { Source } from '../../db/types.js';
import { candidateService } from '../../services/candidateService.js';
import { trackRepo } from '../../db/repos/index.js';

export async function parseAudioTags(pageUrl: string): Promise<DiscoveredItem[]> {
  const safeUrl = await validateSafeUrl(pageUrl);

  const response = await fetch(safeUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) navaMusic/1.0' },
  });

  if (!response.ok) {
    throw new Error(`خطا در دریافت صفحه وب: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const items: DiscoveredItem[] = [];

  // یافتن تگ‌های <audio src="..."> یا <source src="...">
  const audioSrcRegex = /<(?:audio|source)[^>]+src=["']([^"']+\.(?:mp3|m4a|ogg|wav)[^"']*)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = audioSrcRegex.exec(html)) !== null) {
    const rawSrc = match[1].trim();
    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(rawSrc, safeUrl).toString();
    } catch (_) {
      continue;
    }

    const filename = absoluteUrl.split('/').pop()?.split('?')[0] || 'audio.mp3';
    items.push({
      externalId: absoluteUrl,
      title: filename.replace(/\.[^/.]+$/, ''),
      url: absoluteUrl,
      downloadUrl: absoluteUrl,
    });
  }

  return items;
}

export async function downloadAndIngestAudioTag(item: DiscoveredItem, source: Source) {
  if (!item.downloadUrl) return null;

  const existing = trackRepo.findBySource('web_url', item.externalId);
  if (existing) return existing;

  const safeAudioUrl = await validateSafeUrl(item.downloadUrl);
  const res = await fetch(safeAudioUrl);
  if (!res.ok) throw new Error(`دانلود فایل صوتی ناموفق بود: ${res.status}`);

  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);

  return await candidateService.ingest({
    buffer,
    title: item.title,
    sourceType: 'web_url',
    sourceExternalId: item.externalId,
    sourceUrl: item.url,
    sourceOwnerName: source.title,
    reciterId: source.default_reciter_id || undefined,
    categoryId: source.default_category_id || undefined,
    autoPublish: source.auto_publish === 1,
    actor: 'adapter_audio_tag',
  });
}
