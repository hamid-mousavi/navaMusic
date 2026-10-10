// server/adapters/types.ts
// تعاریف و رابط‌های مشترک آداپتورهای اسکن و پایش منابع

import { Source } from '../db/types.js';

export interface DiscoveredItem {
  externalId: string;
  title: string;
  url: string;
  duration?: number;
  downloadUrl?: string;
  author?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
}

export interface IScanAdapter {
  scan(source: Source): Promise<DiscoveredItem[]>;
  downloadAndIngest(item: DiscoveredItem, source: Source): Promise<any>;
}
