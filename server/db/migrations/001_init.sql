-- 001_init.sql
-- اسکیما اولیه پایگاه داده بر اساس مستند فنی navaMusic (بخش ۵)

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

-- ۱. کاربران و دسترسی‌ها
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  telegram_id TEXT UNIQUE,
  username TEXT UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'reviewer', -- 'admin' | 'reviewer'
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- ۲. مداحان و ذاکرین
CREATE TABLE IF NOT EXISTS reciters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  tracks_count INTEGER NOT NULL DEFAULT 0,
  style TEXT DEFAULT '',
  accent_color TEXT DEFAULT '#10b981'
);

-- ۳. دسته‌بندی‌ها
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon_name TEXT DEFAULT 'Sparkles',
  tracks_count INTEGER NOT NULL DEFAULT 0,
  description TEXT DEFAULT ''
);

-- ۴. منابع پایش (یوتیوب، تلگرام، وب)
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'youtube_channel' | 'telegram_channel' | 'web_url'
  ref TEXT NOT NULL, -- شناسه، هندل یا آدرس منبع
  title TEXT NOT NULL,
  schedule TEXT NOT NULL DEFAULT 'daily', -- 'manual' | 'every_6h' | 'daily'
  enabled INTEGER NOT NULL DEFAULT 1,
  auto_publish INTEGER NOT NULL DEFAULT 0,
  default_reciter_id TEXT,
  default_category_id TEXT,
  filters_json TEXT DEFAULT '{}',
  last_run_at TEXT,
  last_status TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (default_reciter_id) REFERENCES reciters(id) ON DELETE SET NULL,
  FOREIGN KEY (default_category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- ۵. تاریخچه جاب‌های اسکن منابع
CREATE TABLE IF NOT EXISTS scan_jobs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled' | 'manual' | 'bot'
  status TEXT NOT NULL DEFAULT 'queued', -- 'queued' | 'running' | 'done' | 'failed'
  found INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TEXT,
  finished_at TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- ۶. قطعات و کاندیدها
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  reciter_id TEXT,
  category_id TEXT,
  occasion TEXT,
  tags_json TEXT DEFAULT '[]',
  lyrics_json TEXT DEFAULT '[]',
  duration INTEGER NOT NULL DEFAULT 0,
  bitrate TEXT DEFAULT '320 kbps',
  file_size REAL NOT NULL DEFAULT 0,
  content_hash TEXT,
  source_id TEXT,
  source_type TEXT,
  source_external_id TEXT,
  source_url TEXT,
  source_owner_name TEXT,
  staging_path TEXT,
  s3_key TEXT,
  audio_url TEXT,
  cover_url TEXT DEFAULT '',
  ai_suggestion_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'uploading' | 'published' | 'rejected' | 'upload_failed' | 'hidden'
  reject_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  published_at TEXT,
  channel_message_id TEXT,
  play_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (reciter_id) REFERENCES reciters(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL
);

-- ۷. لاگ رویدادها و ممیزی (Audit Log)
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  actor_type TEXT NOT NULL, -- 'web' | 'bot' | 'system' | 'worker'
  actor_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  meta_json TEXT DEFAULT '{}'
);

-- ۸. تنظیمات کلید-مقدار
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ۹. درخواست‌های حذف اثر (Takedown)
CREATE TABLE IF NOT EXISTS takedown_requests (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL,
  requester_contact TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'reviewed' | 'resolved' | 'rejected'
  created_at TEXT NOT NULL,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
);

-- اندیس‌ها برای سرعت و ضد تکرار
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_source_dedup
  ON tracks(source_type, source_external_id)
  WHERE source_type IS NOT NULL AND source_external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tracks_content_hash ON tracks(content_hash);
CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status);
CREATE INDEX IF NOT EXISTS idx_tracks_reciter ON tracks(reciter_id);
CREATE INDEX IF NOT EXISTS idx_tracks_category ON tracks(category_id);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_source ON scan_jobs(source_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity, entity_id);
