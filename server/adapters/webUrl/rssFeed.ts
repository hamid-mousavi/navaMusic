// server/adapters/webUrl/rssFeed.ts
// آداپتور اسکن پادکست‌ها و فیدهای RSS/Atom صوتی

import { validateSafeUrl } from '../ssrf.js';
import { DiscoveredItem } from '../types.js';
import { Source } from '../../db/types.js';
import { candidateService } from '../../services/candidateService.js';
import { trackRepo } from '../../db/repos/index.js';

export async function parseRssFeed(feedUrl: string): Promise<DiscoveredItem[]> {
  const safeUrl = await validateSafeUrl(feedUrl);

  const response = await fetch(safeUrl, {
    headers: { 'User-Agent': 'navaMusic/1.0 (Podcast Aggregator; +https://navamusic.app)' },
  });

  if (!response.ok) {
    throw new Error(`خطا در دریافت فید RSS: ${response.status} ${response.statusText}`);
  }

  const xmlText = await response.text();
  const items: DiscoveredItem[] = [];

  // پارس با رگولار اکسپرشن بهینه بدون وابستگی به پکیج‌های سنگین
  const itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches.slice(0, 20)) {
    // استخراج عنوان
    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'قطعه صوتی فید';

    // استخراج GUID یا لینک
    const guidMatch = itemXml.match(/<guid[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/guid>/i);
    const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
    const externalId = (guidMatch ? guidMatch[1] : linkMatch ? linkMatch[1] : title).trim();

    // استخراج فایل صوتی از تگ enclosure
    const enclosureMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']audio\/([^"']+)["']/i);
    if (enclosureMatch) {
      const audioUrl = enclosureMatch[1].trim();
      items.push({
        externalId,
        title,
        url: audioUrl,
        downloadUrl: audioUrl,
      });
    }
  }

  return items;
}

export async function downloadAndIngestRssItem(item: DiscoveredItem, source: Source) {
  if (!item.downloadUrl) return null;

  const existing = trackRepo.findBySource('web_url', item.externalId);
  if (existing) return existing;

  const safeAudioUrl = await validateSafeUrl(item.downloadUrl);
  const res = await fetch(safeAudioUrl);
  if (!res.ok) throw new Error(`دانلود فایل صوتی پادکست ناموفق بود: ${res.status}`);

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
    actor: 'adapter_rss',
  });
}
