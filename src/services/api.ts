import { Track, Reciter, Category, YouTubeChannelSource, TelegramSource, BotConfig, ScraperLog } from '../types';

export interface DatabasePayload {
  version: number;
  lastUpdated: string;
  tracks: Track[];
  pendingQueue: Track[];
  reciters: Reciter[];
  categories: Category[];
  youtubeChannels: YouTubeChannelSource[];
  telegramSources: TelegramSource[];
  botConfig: BotConfig;
  logs: ScraperLog[];
  stats: {
    totalPlays: number;
    totalExtractions: number;
  };
}

export const api = {
  // 1. Full Database Sync
  async getFullDatabase(): Promise<DatabasePayload | null> {
    try {
      const res = await fetch('/api/db/all');
      const data = await res.json();
      if (data.success && data.data) {
        return data.data;
      }
    } catch (e) {
      console.warn('[API] Could not fetch database from server, using local fallback:', e);
    }
    return null;
  },

  // 2. Tracks
  async getTracks(): Promise<Track[]> {
    const res = await fetch('/api/tracks');
    const data = await res.json();
    return data.tracks || [];
  },

  async addTrack(track: Partial<Track>): Promise<Track> {
    const res = await fetch('/api/tracks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(track),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در ثبت قطعه');
    return data.track;
  },

  async updateTrack(id: string, updates: Partial<Track>): Promise<Track> {
    const res = await fetch(`/api/tracks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در ویرایش قطعه');
    return data.track;
  },

  async deleteTrack(id: string): Promise<boolean> {
    const res = await fetch(`/api/tracks/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return !!data.success;
  },

  // 3. Pending Queue
  async getQueue(): Promise<Track[]> {
    const res = await fetch('/api/queue');
    const data = await res.json();
    return data.queue || [];
  },

  async updateQueueItem(id: string, updates: Partial<Track>): Promise<Track> {
    const res = await fetch(`/api/queue/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در ویرایش آیتم');
    return data.item;
  },

  async deleteQueueItem(id: string): Promise<boolean> {
    const res = await fetch(`/api/queue/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return !!data.success;
  },

  async approveQueueItem(
    id: string,
    overrides?: Partial<Track>,
    publishToTelegram?: boolean,
    track?: Track
  ): Promise<{ track: Track; telegram?: any; message: string }> {
    const res = await fetch(`/api/queue/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overrides, publishToTelegram, track }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در تأیید آیتم');
    return data;
  },

  // 4. Reciters
  async getReciters(): Promise<Reciter[]> {
    const res = await fetch('/api/reciters');
    const data = await res.json();
    return data.reciters || [];
  },

  async addReciter(reciter: Partial<Reciter>): Promise<Reciter> {
    const res = await fetch('/api/reciters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reciter),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در ایجاد مداح');
    return data.reciter;
  },

  async updateReciter(id: string, updates: Partial<Reciter>): Promise<Reciter> {
    const res = await fetch(`/api/reciters/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در ویرایش مداح');
    return data.reciter;
  },

  async deleteReciter(id: string): Promise<boolean> {
    const res = await fetch(`/api/reciters/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return !!data.success;
  },

  // 5. Categories
  async getCategories(): Promise<Category[]> {
    const res = await fetch('/api/categories');
    const data = await res.json();
    return data.categories || [];
  },

  async addCategory(cat: Partial<Category>): Promise<Category> {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cat),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در ایجاد دسته‌بندی');
    return data.category;
  },

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const res = await fetch(`/api/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در ویرایش دسته‌بندی');
    return data.category;
  },

  async deleteCategory(id: string): Promise<boolean> {
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return !!data.success;
  },

  // 6. Telegram Bot
  async getBotConfig(): Promise<BotConfig> {
    const res = await fetch('/api/bot/config');
    const data = await res.json();
    return data.config;
  },

  async updateBotConfig(config: Partial<BotConfig>): Promise<BotConfig> {
    const res = await fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در ذخیره تنظیمات بات');
    return data.config;
  },

  async testBot(token?: string): Promise<{ success: boolean; bot?: any; error?: string }> {
    const res = await fetch('/api/bot/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return res.json();
  },

  async testChannel(
    token?: string,
    channel?: string
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const res = await fetch('/api/bot/test-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, channel }),
    });
    return res.json();
  },

  async publishTrackToTelegram(
    trackId: string,
    track?: Track,
    customCaption?: string
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const res = await fetch('/api/bot/publish-track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId, track, customCaption }),
    });
    return res.json();
  },

  // 7. DB Reset
  async resetDatabase(): Promise<DatabasePayload> {
    const res = await fetch('/api/db/reset', { method: 'POST' });
    const data = await res.json();
    return data.data;
  },

  // 8. YouTube Monitoring & Scraper
  async getYoutubeChannels(): Promise<YouTubeChannelSource[]> {
    const res = await fetch('/api/youtube/channels');
    const data = await res.json();
    return data.channels || [];
  },

  async addYoutubeChannel(ch: Partial<YouTubeChannelSource>): Promise<YouTubeChannelSource> {
    const res = await fetch('/api/youtube/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ch),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در افزودن کانال');
    return data.channel;
  },

  async updateYoutubeChannel(
    id: string,
    updates: Partial<YouTubeChannelSource>
  ): Promise<YouTubeChannelSource> {
    const res = await fetch(`/api/youtube/channels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در ویرایش کانال');
    return data.channel;
  },

  async deleteYoutubeChannel(id: string): Promise<boolean> {
    const res = await fetch(`/api/youtube/channels/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return !!data.success;
  },

  async previewChannel(target: string): Promise<any[]> {
    const res = await fetch('/api/youtube/preview-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: target, handle: target }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در دریافت لیست ویدیوها');
    return data.videos || [];
  },

  async inspectChannel(target: string): Promise<{
    channelName: string;
    channelHandle: string;
    channelUrl: string;
    suggestedReciterId?: string;
    suggestedReciterName?: string;
  }> {
    const res = await fetch('/api/youtube/inspect-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در استعلام مشخصات کانال');
    return data;
  },

  async getMediaInfo(url: string): Promise<any> {
    const res = await fetch('/api/media-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در دریافت اطلاعات رسانه');
    return data;
  },

  async scanSingleYoutubeChannel(id: string): Promise<any> {
    const res = await fetch(`/api/youtube/channels/${id}/scan`, { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در پایش کانال');
    return data.result;
  },

  async scanAllYoutubeChannels(): Promise<any> {
    const res = await fetch('/api/youtube/scan-all', { method: 'POST' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در پایش کلی');
    return data.summary;
  },

  async getYoutubeMonitorStatus(): Promise<any> {
    const res = await fetch('/api/youtube/monitor/status');
    const data = await res.json();
    return data.status;
  },

  async toggleYoutubeAutoMonitor(enabled: boolean, intervalMinutes?: number): Promise<any> {
    const res = await fetch('/api/youtube/monitor/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, intervalMinutes }),
    });
    const data = await res.json();
    return data.status;
  },

  async getDiscoveredVideos(): Promise<any[]> {
    const res = await fetch('/api/youtube/discovered');
    const data = await res.json();
    return data.videos || [];
  },

  async approveDiscoveredVideo(params: {
    videoId: string;
    customTitle?: string;
    reciterId?: string;
    categoryId?: string;
    bitrate?: string;
  }): Promise<any> {
    const res = await fetch('/api/youtube/approve-discovered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در تایید و تبدیل ویدیو');
    return data;
  },

  async dismissDiscoveredVideo(params: { videoId?: string; clearAll?: boolean }): Promise<any> {
    const res = await fetch('/api/youtube/dismiss-discovered', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    return data;
  },

  // 10. Auth & Users API (Phase 2)
  async login(username: string, password: string): Promise<any> {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'ورود ناموفق بود');
    return data;
  },

  async logout(): Promise<void> {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
  },

  async getMe(): Promise<any> {
    try {
      const res = await fetch('/api/admin/auth/me');
      if (!res.ok) return null;
      const data = await res.json();
      return data.success ? data.user : null;
    } catch (_) {
      return null;
    }
  },

  async getUsers(): Promise<any[]> {
    const res = await fetch('/api/admin/users');
    const data = await res.json();
    return data.users || [];
  },

  async createUser(user: { username: string; password: string; role: string; telegram_id?: string }): Promise<any> {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در ساخت کاربر');
    return data.user;
  },

  async deleteUser(userId: string): Promise<void> {
    const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در حذف کاربر');
  },
};
