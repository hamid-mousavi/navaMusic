// server/adapters/webUrl/index.ts
// دیسپچر یکپارچه آداپتورهای وب

import { IScanAdapter, DiscoveredItem } from '../types.js';
import { Source } from '../../db/types.js';
import { processDirectAudio } from './directAudio.js';
import { parseRssFeed, downloadAndIngestRssItem } from './rssFeed.js';
import { parseAudioTags, downloadAndIngestAudioTag } from './audioTag.js';

export class WebAdapter implements IScanAdapter {
  public async scan(source: Source): Promise<DiscoveredItem[]> {
    const url = source.ref.trim();

    // ۱. بررسی لینک مستقیم فایل صوتی
    if (/\.(mp3|m4a|ogg|wav)($|\?)/i.test(url)) {
      return [
        {
          externalId: url,
          title: source.title,
          url,
          downloadUrl: url,
        },
      ];
    }

    // ۲. بررسی فید RSS / پادکست
    if (url.includes('/rss') || url.includes('/feed') || url.endsWith('.xml')) {
      try {
        return await parseRssFeed(url);
      } catch (_) {}
    }

    // ۳. بررسی تگ‌های صوتی در صفحه HTML
    try {
      const audioTags = await parseAudioTags(url);
      if (audioTags.length > 0) return audioTags;
    } catch (_) {}

    // در غیر این صورت فید RSS را امتحان کن
    try {
      return await parseRssFeed(url);
    } catch (_) {
      return [];
    }
  }

  public async downloadAndIngest(item: DiscoveredItem, source: Source): Promise<any> {
    if (/\.(mp3|m4a|ogg|wav)($|\?)/i.test(item.url)) {
      return await processDirectAudio(item.url, source, item.title);
    }
    if (item.downloadUrl) {
      return await downloadAndIngestRssItem(item, source);
    }
    return null;
  }
}

export const webAdapter = new WebAdapter();
