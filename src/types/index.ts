export interface LyricLine {
  id: string;
  time: number; // in seconds
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
  duration: number; // in seconds
  audioUrl: string;
  coverUrl: string;
  fileSizeMb: number;
  bitrate: string; // e.g. "128 kbps" or "320 kbps"
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

export interface YouTubeChannelSource {
  id: string;
  channelName: string;
  channelHandle: string; // e.g. "@Fotros_ir" or "UC..."
  channelUrl: string;
  isMonitored: boolean;
  lastCheckedAt: string;
  totalExtracted: number;
  defaultReciterId: string;
  defaultCategoryId: string;
  autoApprove: boolean;
}

export interface WebScrapeTask {
  id: string;
  url: string;
  title: string;
  sourceType: 'youtube' | 'web_url';
  status: 'pending' | 'downloading' | 'converting' | 'uploading_s3' | 'completed' | 'error';
  progress: number; // 0 - 100
  reciterName?: string;
  fileSizeMb?: number;
  error?: string;
}

export interface Reciter {
  id: string;
  name: string;
  title: string; // e.g. "حاج محمود کریمی"
  bio: string;
  avatarUrl: string;
  tracksCount: number;
  style: string; // e.g. "شور و واحد حسینی", "ادعیه و مناجات"
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

export interface CloudStorageConfig {
  endpoint: string;
  bucketName: string;
  region: string;
  accessKey: string;
  secretKey: string;
  customCdnDomain: string;
  isConfigured: boolean;
}

export interface SupabaseConfig {
  projectUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  isConfigured: boolean;
}

export interface ScraperLog {
  id: string;
  timestamp: string;
  channel: string;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
}
