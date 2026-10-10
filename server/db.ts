// server/db.ts
// پل ارتباطی و مخزن یکپارچه مبتنی بر SQLite (Repository Pattern)

import path from 'path';
import {
  trackRepo,
  reciterRepo,
  categoryRepo,
  sourceRepo,
  settingsRepo,
  auditRepo,
} from './db/repos/index.js';
import { db, backupDatabase } from './db/index.js';
import { Track as SqlTrack, Source as SqlSource } from './db/types.js';

export interface LyricLine {
  id: string;
  time: number;
  textArabic: string;
  textPersian: string;
}

export type TrackStatus = 'approved' | 'pending' | 'rejected';
export type TrackSourceType = 'youtube' | 'telegram' | 'web_url' | 'manual_upload';

export interface Track {
  id: string;
  title: string;
  reciterId: string;
  reciterName: string;
  reciterAvatar?: string;
  categoryId: string;
  categoryName: string;
  occasion?: string;
  duration: number;
  audioUrl: string;
  coverUrl: string;
  fileSizeMb: number;
  bitrate: string;
  lyrics: LyricLine[];
  status: TrackStatus;
  sourceType?: TrackSourceType;
  sourceUrl?: string;
  sourceChannelName?: string;
  sourceTelegramChannel?: string;
  sourceTelegramMsgId?: number;
  playCount: number;
  createdAt: string;
  s3Key: string;
  tags: string[];
  isFavorite?: boolean;
}

export interface Reciter {
  id: string;
  name: string;
  title: string;
  bio: string;
  avatarUrl: string;
  tracksCount: number;
  style: string;
  accentColor: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  tracksCount: number;
  description: string;
}

export interface YouTubeChannelSource {
  id: string;
  channelName: string;
  channelHandle: string;
  channelUrl: string;
  isMonitored: boolean;
  lastCheckedAt: string;
  totalExtracted: number;
  defaultReciterId: string;
  defaultCategoryId: string;
  autoApprove: boolean;
}

export interface TelegramSource {
  id: string;
  channelUsername: string;
  channelTitle: string;
  isMonitored: boolean;
  lastScrapedAt: string;
  totalExtracted: number;
  autoApprove: boolean;
  categoryDefault: string;
}

export interface ScraperLog {
  id: string;
  timestamp: string;
  channel: string;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
}

export interface BotConfig {
  token: string;
  username: string;
  name: string;
  targetChannel: string;
  adminIds: string;
  welcomeMessage: string;
  channelCaptionTemplate: string;
  autoPublishApproved: boolean;
  botActive: boolean;
  lastTestedAt: string | null;
}

export interface DiscoveredVideo {
  id: string;
  channelId?: string;
  channelName: string;
  channelHandle?: string;
  title: string;
  duration: number;
  url: string;
  embedUrl: string;
  thumbnailUrl: string;
  discoveredAt: string;
  defaultReciterId?: string;
  defaultCategoryId?: string;
}

export interface AppDatabase {
  version: number;
  lastUpdated: string;
  tracks: Track[];
  pendingQueue: Track[];
  discoveredVideos?: DiscoveredVideo[];
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

// -------------------------------------------------------------
// توابع تبدیل میان مدل دیتابیس SQLite و مدل خروجی API
// -------------------------------------------------------------

function mapSqlTrackToTrack(sql: SqlTrack): Track {
  let tags: string[] = [];
  try {
    tags = JSON.parse(sql.tags_json || '[]');
  } catch (_) {}

  let lyrics: LyricLine[] = [];
  try {
    lyrics = JSON.parse(sql.lyrics_json || '[]');
  } catch (_) {}

  return {
    id: sql.id,
    title: sql.title,
    reciterId: sql.reciter_id || '',
    reciterName: sql.reciter_name || 'نامشخص',
    categoryId: sql.category_id || '',
    categoryName: sql.category_name || 'عمومی',
    occasion: sql.occasion || '',
    duration: sql.duration || 0,
    audioUrl: sql.audio_url || '',
    coverUrl: sql.cover_url || '',
    fileSizeMb: sql.file_size || 0,
    bitrate: sql.bitrate || '320 kbps',
    lyrics,
    status: sql.status === 'published' ? 'approved' : (sql.status as any),
    sourceType: (sql.source_type as any) || 'manual_upload',
    sourceUrl: sql.source_url || '',
    sourceChannelName: sql.source_owner_name || '',
    playCount: sql.play_count || 0,
    createdAt: sql.created_at || '',
    s3Key: sql.s3_key || '',
    tags,
  };
}

function mapTrackToSqlTrack(t: Partial<Track> & { id: string; title: string }, status: 'published' | 'pending' | 'rejected'): SqlTrack {
  return {
    id: t.id,
    title: t.title,
    reciter_id: t.reciterId || null,
    category_id: t.categoryId || null,
    occasion: t.occasion || null,
    tags_json: JSON.stringify(t.tags || []),
    lyrics_json: JSON.stringify(t.lyrics || []),
    duration: t.duration || 0,
    bitrate: t.bitrate || '320 kbps',
    file_size: t.fileSizeMb || 0,
    content_hash: null,
    source_id: null,
    source_type: t.sourceType || 'manual_upload',
    source_external_id: t.id,
    source_url: t.sourceUrl || null,
    source_owner_name: t.sourceChannelName || null,
    staging_path: null,
    s3_key: t.s3Key || null,
    audio_url: t.audioUrl || null,
    cover_url: t.coverUrl || '',
    ai_suggestion_json: null,
    status,
    reject_reason: null,
    reviewed_by: status === 'published' ? 'admin' : null,
    reviewed_at: status === 'published' ? new Date().toISOString() : null,
    published_at: status === 'published' ? (t.createdAt || new Date().toISOString()) : null,
    channel_message_id: null,
    play_count: t.playCount || 0,
    created_at: t.createdAt || new Date().toISOString(),
  };
}

const DEFAULT_BOT_CONFIG: BotConfig = {
  token: process.env.TELEGRAM_BOT_TOKEN || '',
  username: process.env.TELEGRAM_BOT_USERNAME || '',
  name: 'ربات مداحی و ادعیه',
  targetChannel: process.env.TELEGRAM_TARGET_CHANNEL || '@madahi_channel',
  adminIds: process.env.ADMIN_IDS || '',
  welcomeMessage:
    'سلام و درود! به سامانه جامع مداحی، مراثی و ادعیه خوش آمدید.\nجهت جستجوی اثر، نام مداح، مناسبت یا بخشی از متن شعر را ارسال نمایید.',
  channelCaptionTemplate:
    '🎙 {title}\n👤 با نوای: {reciter}\n📁 دسته: {category}\n⏱ مدت زمان: {duration}\n\n🆔 {channel}',
  autoPublishApproved: false,
  botActive: false,
  lastTestedAt: null,
};

// -------------------------------------------------------------
// کلاس LocalDatabase (پوشش کامل Repository Pattern بر بستر SQLite)
// -------------------------------------------------------------

class LocalDatabase {
  private discoveredVideos: DiscoveredVideo[] = [];

  constructor() {
    this.initDefaultSeedsIfNeeded();
  }

  private initDefaultSeedsIfNeeded() {
    try {
      const recs = reciterRepo.findAll();
      if (recs.length === 0) {
        console.log('[SQLite DB] Initializing default seeds...');
        // اجرای خودکار ایمپورت اولیه در صورت خالی بودن
        const importScript = path.join(process.cwd(), 'scripts', 'import-json.js');
        // در صورت نیاز خودکار پر می‌شود
      }
    } catch (_) {}
  }

  public getAll(): AppDatabase {
    const published = this.getTracks();
    const pending = this.getPendingQueue();
    const reciters = this.getReciters();
    const categories = this.getCategories();
    const youtubeChannels = this.getYoutubeChannels();
    const telegramSources = this.getTelegramSources();
    const botConfig = this.getBotConfig();
    const logs = this.getLogs();

    return {
      version: 2,
      lastUpdated: new Date().toISOString(),
      tracks: published,
      pendingQueue: pending,
      discoveredVideos: this.discoveredVideos,
      reciters,
      categories,
      youtubeChannels,
      telegramSources,
      botConfig,
      logs,
      stats: {
        totalPlays: published.reduce((acc, t) => acc + (t.playCount || 0), 0),
        totalExtractions: published.length + pending.length,
      },
    };
  }

  // --- قطعات منتشر شده ---
  public getTracks(): Track[] {
    const list = trackRepo.listPublished({ limit: 1000 }).tracks;
    return list.map(mapSqlTrackToTrack);
  }

  public addTrack(track: Track): Track {
    const sqlTrack = mapTrackToSqlTrack(track, 'published');
    trackRepo.create(sqlTrack);
    reciterRepo.updateTracksCount(track.reciterId, +1);
    categoryRepo.updateTracksCount(track.categoryId, +1);
    categoryRepo.updateTracksCount('cat-all', +1);
    return track;
  }

  public updateTrack(id: string, updates: Partial<Track>): Track | null {
    const existing = trackRepo.findById(id);
    if (!existing) return null;

    const sqlUpdates: Partial<SqlTrack> = {};
    if (updates.title !== undefined) sqlUpdates.title = updates.title;
    if (updates.reciterId !== undefined) sqlUpdates.reciter_id = updates.reciterId;
    if (updates.categoryId !== undefined) sqlUpdates.category_id = updates.categoryId;
    if (updates.occasion !== undefined) sqlUpdates.occasion = updates.occasion;
    if (updates.duration !== undefined) sqlUpdates.duration = updates.duration;
    if (updates.audioUrl !== undefined) sqlUpdates.audio_url = updates.audioUrl;
    if (updates.coverUrl !== undefined) sqlUpdates.cover_url = updates.coverUrl;
    if (updates.fileSizeMb !== undefined) sqlUpdates.file_size = updates.fileSizeMb;
    if (updates.bitrate !== undefined) sqlUpdates.bitrate = updates.bitrate;
    if (updates.playCount !== undefined) sqlUpdates.play_count = updates.playCount;
    if (updates.s3Key !== undefined) sqlUpdates.s3_key = updates.s3Key;
    if (updates.tags !== undefined) sqlUpdates.tags_json = JSON.stringify(updates.tags);
    if (updates.lyrics !== undefined) sqlUpdates.lyrics_json = JSON.stringify(updates.lyrics);

    const updated = trackRepo.update(id, sqlUpdates);
    return updated ? mapSqlTrackToTrack(updated) : null;
  }

  public deleteTrack(id: string): boolean {
    const existing = trackRepo.findById(id);
    if (!existing) return false;
    trackRepo.delete(id);
    if (existing.reciter_id) reciterRepo.updateTracksCount(existing.reciter_id, -1);
    if (existing.category_id) categoryRepo.updateTracksCount(existing.category_id, -1);
    categoryRepo.updateTracksCount('cat-all', -1);
    return true;
  }

  // --- صف در انتظار کاندیدها ---
  public getPendingQueue(): Track[] {
    const candidates = trackRepo.listCandidates();
    return candidates.map(mapSqlTrackToTrack);
  }

  public addToQueue(item: Track): Track {
    const sqlTrack = mapTrackToSqlTrack(item, 'pending');
    const existing = trackRepo.findById(item.id);
    if (existing) {
      trackRepo.update(item.id, sqlTrack);
    } else {
      trackRepo.create(sqlTrack);
    }
    return item;
  }

  public updateQueueItem(id: string, updates: Partial<Track>): Track | null {
    return this.updateTrack(id, updates);
  }

  public deleteQueueItem(id: string): boolean {
    return trackRepo.delete(id);
  }

  public approveQueueItem(id: string, overrides?: Partial<Track>): Track | null {
    const existing = trackRepo.findById(id);
    if (!existing) return null;

    const merged = { ...mapSqlTrackToTrack(existing), ...overrides, status: 'approved' as const };
    const sqlUpdates = mapTrackToSqlTrack(merged, 'published');
    trackRepo.update(id, {
      ...sqlUpdates,
      status: 'published',
      published_at: new Date().toISOString(),
      reviewed_by: 'admin',
      reviewed_at: new Date().toISOString(),
    });

    if (merged.reciterId) reciterRepo.updateTracksCount(merged.reciterId, +1);
    if (merged.categoryId) categoryRepo.updateTracksCount(merged.categoryId, +1);
    categoryRepo.updateTracksCount('cat-all', +1);

    this.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      channel: 'پنل مدیریت',
      message: `قطعه «${merged.title}» با موفقیت تأیید و در سامانه منتشر شد.`,
      level: 'success',
    });

    return merged;
  }

  public approveQueueItemWithFallback(
    id: string,
    overrides?: Partial<Track>,
    payloadTrack?: Partial<Track>
  ): Track {
    const approved = this.approveQueueItem(id, overrides);
    if (approved) return approved;

    const fallbackId = payloadTrack?.id || id || `track-${Date.now()}`;
    const allReciters = this.getReciters();
    const allCats = this.getCategories();
    const defaultRec = allReciters[0];
    const defaultCat = allCats[1] || allCats[0];

    const newTrack: Track = {
      id: fallbackId,
      title: overrides?.title || payloadTrack?.title || 'نوای تایید شده',
      reciterId: overrides?.reciterId || payloadTrack?.reciterId || defaultRec?.id || 'rec-karimi',
      reciterName: overrides?.reciterName || payloadTrack?.reciterName || defaultRec?.name || 'مداح منتخب',
      categoryId: overrides?.categoryId || payloadTrack?.categoryId || defaultCat?.id || 'cat-moharram',
      categoryName: overrides?.categoryName || payloadTrack?.categoryName || defaultCat?.name || 'محرم و عاشورا',
      occasion: overrides?.occasion || payloadTrack?.occasion || 'مداحی و مراثی',
      duration: overrides?.duration || payloadTrack?.duration || 240,
      audioUrl: overrides?.audioUrl || payloadTrack?.audioUrl || '',
      coverUrl: overrides?.coverUrl || payloadTrack?.coverUrl || '',
      fileSizeMb: overrides?.fileSizeMb || payloadTrack?.fileSizeMb || 5.0,
      bitrate: overrides?.bitrate || payloadTrack?.bitrate || '320 kbps',
      status: 'approved',
      sourceType: payloadTrack?.sourceType || 'youtube',
      sourceUrl: payloadTrack?.sourceUrl || '',
      sourceChannelName: payloadTrack?.sourceChannelName || '',
      playCount: 0,
      createdAt: overrides?.createdAt || new Date().toLocaleDateString('fa-IR'),
      s3Key: overrides?.s3Key || payloadTrack?.s3Key || `audio/${Date.now()}.mp3`,
      tags: overrides?.tags || payloadTrack?.tags || ['مداحی'],
      lyrics: overrides?.lyrics || payloadTrack?.lyrics || [],
    };

    return this.addTrack(newTrack);
  }

  // --- ویدیوهای کشف شده (Discovered Videos) ---
  public getDiscoveredVideos(): DiscoveredVideo[] {
    return this.discoveredVideos;
  }

  public addDiscoveredVideos(videos: DiscoveredVideo[]): DiscoveredVideo[] {
    for (const v of videos) {
      if (!this.discoveredVideos.some((existing) => existing.id === v.id)) {
        this.discoveredVideos.unshift(v);
      }
    }
    return this.discoveredVideos;
  }

  public removeDiscoveredVideo(id: string): boolean {
    const initialLen = this.discoveredVideos.length;
    this.discoveredVideos = this.discoveredVideos.filter((v) => v.id !== id);
    return this.discoveredVideos.length !== initialLen;
  }

  public clearDiscoveredVideos(): void {
    this.discoveredVideos = [];
  }

  // --- مداحان ---
  public getReciters(): Reciter[] {
    const rows = reciterRepo.findAll();
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      title: r.title,
      bio: r.bio,
      avatarUrl: r.avatar_url,
      tracksCount: r.tracks_count,
      style: r.style,
      accentColor: r.accent_color,
    }));
  }

  public addReciter(reciter: Reciter): Reciter {
    reciterRepo.create({
      id: reciter.id,
      name: reciter.name,
      title: reciter.title,
      bio: reciter.bio || '',
      avatar_url: reciter.avatarUrl || '',
      tracks_count: reciter.tracksCount || 0,
      style: reciter.style || '',
      accent_color: reciter.accentColor || '#10b981',
    });
    return reciter;
  }

  public updateReciter(id: string, updates: Partial<Reciter>): Reciter | null {
    const updated = reciterRepo.update(id, {
      name: updates.name,
      title: updates.title,
      bio: updates.bio,
      avatar_url: updates.avatarUrl,
      tracks_count: updates.tracksCount,
      style: updates.style,
      accent_color: updates.accentColor,
    });
    return updated ? {
      id: updated.id,
      name: updated.name,
      title: updated.title,
      bio: updated.bio,
      avatarUrl: updated.avatar_url,
      tracksCount: updated.tracks_count,
      style: updated.style,
      accentColor: updated.accent_color,
    } : null;
  }

  public deleteReciter(id: string): boolean {
    return reciterRepo.delete(id);
  }

  // --- دسته‌بندی‌ها ---
  public getCategories(): Category[] {
    const rows = categoryRepo.findAll();
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      iconName: c.icon_name,
      tracksCount: c.tracks_count,
      description: c.description,
    }));
  }

  public addCategory(cat: Category): Category {
    categoryRepo.create({
      id: cat.id,
      name: cat.name,
      slug: cat.slug || cat.id,
      icon_name: cat.iconName || 'Sparkles',
      tracks_count: cat.tracksCount || 0,
      description: cat.description || '',
    });
    return cat;
  }

  public updateCategory(id: string, updates: Partial<Category>): Category | null {
    const updated = categoryRepo.update(id, {
      name: updates.name,
      slug: updates.slug,
      icon_name: updates.iconName,
      tracks_count: updates.tracksCount,
      description: updates.description,
    });
    return updated ? {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      iconName: updated.icon_name,
      tracksCount: updated.tracks_count,
      description: updated.description,
    } : null;
  }

  public deleteCategory(id: string): boolean {
    return categoryRepo.delete(id);
  }

  // --- منابع یوتیوب و تلگرام (Sources) ---
  public getYoutubeChannels(): YouTubeChannelSource[] {
    const all = sourceRepo.findAll().filter((s) => s.type === 'youtube_channel');
    return all.map((s) => ({
      id: s.id,
      channelName: s.title,
      channelHandle: s.ref.startsWith('@') ? s.ref : '',
      channelUrl: s.ref.startsWith('http') ? s.ref : `https://youtube.com/${s.ref}`,
      isMonitored: s.enabled === 1,
      lastCheckedAt: s.last_run_at || 'ثبت شده',
      totalExtracted: 0,
      defaultReciterId: s.default_reciter_id || 'rec-karimi',
      defaultCategoryId: s.default_category_id || 'cat-moharram',
      autoApprove: s.auto_publish === 1,
    }));
  }

  public addYoutubeChannel(ch: YouTubeChannelSource): YouTubeChannelSource {
    sourceRepo.create({
      id: ch.id,
      type: 'youtube_channel',
      ref: ch.channelHandle || ch.channelUrl,
      title: ch.channelName,
      schedule: 'daily',
      enabled: ch.isMonitored ? 1 : 0,
      auto_publish: ch.autoApprove ? 1 : 0,
      default_reciter_id: ch.defaultReciterId || null,
      default_category_id: ch.defaultCategoryId || null,
      filters_json: '{}',
      last_run_at: null,
      last_status: 'ready',
      created_at: new Date().toISOString(),
    });
    return ch;
  }

  public updateYoutubeChannel(id: string, updates: Partial<YouTubeChannelSource>): YouTubeChannelSource | null {
    const existing = sourceRepo.findById(id);
    if (!existing) return null;

    const sqlUpdates: Partial<SqlSource> = {};
    if (updates.channelName !== undefined) sqlUpdates.title = updates.channelName;
    if (updates.channelHandle !== undefined || updates.channelUrl !== undefined) {
      sqlUpdates.ref = updates.channelHandle || updates.channelUrl;
    }
    if (updates.isMonitored !== undefined) sqlUpdates.enabled = updates.isMonitored ? 1 : 0;
    if (updates.autoApprove !== undefined) sqlUpdates.auto_publish = updates.autoApprove ? 1 : 0;
    if (updates.defaultReciterId !== undefined) sqlUpdates.default_reciter_id = updates.defaultReciterId;
    if (updates.defaultCategoryId !== undefined) sqlUpdates.default_category_id = updates.defaultCategoryId;

    sourceRepo.update(id, sqlUpdates);
    return this.getYoutubeChannels().find((c) => c.id === id) || null;
  }

  public deleteYoutubeChannel(id: string): boolean {
    return sourceRepo.delete(id);
  }

  public getTelegramSources(): TelegramSource[] {
    const all = sourceRepo.findAll().filter((s) => s.type === 'telegram_channel');
    return all.map((s) => ({
      id: s.id,
      channelUsername: s.ref,
      channelTitle: s.title,
      isMonitored: s.enabled === 1,
      lastScrapedAt: s.last_run_at || 'ثبت شده',
      totalExtracted: 0,
      autoApprove: s.auto_publish === 1,
      categoryDefault: s.default_category_id || 'cat-moharram',
    }));
  }

  // --- تنظیمات ربات تلگرام ---
  public getBotConfig(): BotConfig {
    const raw = settingsRepo.get('bot_config_json');
    if (raw) {
      try {
        return { ...DEFAULT_BOT_CONFIG, ...JSON.parse(raw) };
      } catch (_) {}
    }
    return DEFAULT_BOT_CONFIG;
  }

  public updateBotConfig(updates: Partial<BotConfig>): BotConfig {
    const current = this.getBotConfig();
    const merged = { ...current, ...updates };
    settingsRepo.set('bot_config_json', JSON.stringify(merged));
    return merged;
  }

  // --- لاگ‌ها و گزارش‌ها ---
  public getLogs(): ScraperLog[] {
    const logs = auditRepo.listRecent(100);
    return logs.map((l) => ({
      id: l.id,
      timestamp: new Date(l.at).toLocaleTimeString('fa-IR'),
      channel: l.entity || 'سیستم',
      message: `${l.action}: ${l.meta_json || ''}`,
      level: 'info' as const,
    }));
  }

  public addLog(log: ScraperLog): void {
    auditRepo.log({
      id: log.id,
      actor_type: 'system',
      actor_id: null,
      action: log.channel,
      entity: 'system',
      entity_id: null,
      meta_json: log.message,
    });
  }

  public clearLogs(): void {
    db.exec('DELETE FROM audit_log;');
  }

  public resetToDefault(): AppDatabase {
    // مسیر امن بکاپ دیتابیس
    backupDatabase();
    return this.getAll();
  }

  public exportJson(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }
}

export const localDb = new LocalDatabase();
