// server/services/migrationService.ts
// موتور مهاجرت داده‌ها و تولید اسکیمای استاندارد Supabase / PostgreSQL

import { db } from '../db/index.js';
import {
  trackRepo,
  reciterRepo,
  categoryRepo,
  sourceRepo,
  scanJobRepo,
  userRepo,
  auditRepo,
  settingsRepo,
  takedownRepo,
} from '../db/repos/index.js';

function escapeSqlString(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  return `'${String(val).replace(/'/g, "''")}'`;
}

function escapeJsonField(val: any): string {
  if (val === null || val === undefined) return "'[]'::jsonb";
  const str = typeof val === 'string' ? val : JSON.stringify(val);
  return `'${str.replace(/'/g, "''")}'::jsonb`;
}

function escapeSqlNumber(val: any): string {
  if (val === null || val === undefined || isNaN(Number(val))) return '0';
  return String(Number(val));
}

export class MigrationService {
  /**
   * تولید اسکریپت جامع و آماده اجرای PostgreSQL / Supabase
   * شامل DDL (جداول و ایندکس‌ها و RLS) و DML (داده‌های زنده SQLite)
   */
  public generateSupabaseSqlDump(): string {
    const timestamp = new Date().toISOString();
    const parts: string[] = [];

    parts.push(`-- ========================================================`);
    parts.push(`-- اسکریپت مهاجرت جامع پایگاه داده navaMusic به Supabase / PostgreSQL`);
    parts.push(`-- تاریخ تولید: ${timestamp}`);
    parts.push(`-- تولید شده به صورت خودکار از داده‌های زنده SQLite (فاز ۷)`);
    parts.push(`-- ========================================================\n`);

    parts.push(`-- فعال‌سازی افزونه‌های لازم در PostgreSQL`);
    parts.push(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    parts.push(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n`);

    // ۱. جدول کاربران
    parts.push(`-- ۱. جدول کاربران سامانه (Users)`);
    parts.push(`CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  telegram_id TEXT UNIQUE,
  username TEXT UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'reviewer',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);\n`);

    // ۲. جدول مداحان
    parts.push(`-- ۲. جدول مداحان و قاریان (Reciters)`);
    parts.push(`CREATE TABLE IF NOT EXISTS public.reciters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  tracks_count INTEGER NOT NULL DEFAULT 0,
  style TEXT DEFAULT '',
  accent_color TEXT DEFAULT '#10b981',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);\n`);

    // ۳. جدول دسته‌بندی‌ها
    parts.push(`-- ۳. جدول دسته‌بندی‌ها (Categories)`);
    parts.push(`CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon_name TEXT DEFAULT 'Sparkles',
  tracks_count INTEGER NOT NULL DEFAULT 0,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);\n`);

    // ۴. جدول منابع پایش
    parts.push(`-- ۴. جدول منابع پایش (Sources)`);
    parts.push(`CREATE TABLE IF NOT EXISTS public.sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  ref TEXT NOT NULL,
  title TEXT NOT NULL,
  schedule TEXT NOT NULL DEFAULT 'daily',
  enabled BOOLEAN NOT NULL DEFAULT true,
  auto_publish BOOLEAN NOT NULL DEFAULT false,
  default_reciter_id TEXT REFERENCES public.reciters(id) ON DELETE SET NULL,
  default_category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  filters_json JSONB DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);\n`);

    // ۵. جدول قطعات و کاندیدها
    parts.push(`-- ۵. جدول قطعات صوتی و کاندیدها (Tracks)`);
    parts.push(`CREATE TABLE IF NOT EXISTS public.tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  reciter_id TEXT REFERENCES public.reciters(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  occasion TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  lyrics JSONB DEFAULT '[]'::jsonb,
  duration INTEGER NOT NULL DEFAULT 0,
  bitrate TEXT DEFAULT '320 kbps',
  file_size_mb NUMERIC(8, 2) DEFAULT 0,
  content_hash TEXT,
  source_id TEXT REFERENCES public.sources(id) ON DELETE SET NULL,
  source_type TEXT,
  source_external_id TEXT,
  source_url TEXT,
  source_owner_name TEXT,
  staging_path TEXT,
  s3_key TEXT,
  audio_url TEXT,
  cover_url TEXT DEFAULT '',
  ai_suggestion JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  published_at TIMESTAMP WITH TIME ZONE,
  channel_message_id TEXT,
  play_count BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);\n`);

    // ۶. جدول جاب‌های اسکن
    parts.push(`-- ۶. جدول جاب‌های اسکن منابع (Scan Jobs)`);
    parts.push(`CREATE TABLE IF NOT EXISTS public.scan_jobs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL DEFAULT 'scheduled',
  status TEXT NOT NULL DEFAULT 'queued',
  found INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE
);\n`);

    // ۷. جدول لاگ‌های ممیزی
    parts.push(`-- ۷. جدول لاگ‌های ممیزی سیستم (Audit Log)`);
    parts.push(`CREATE TABLE IF NOT EXISTS public.audit_log (
  id TEXT PRIMARY KEY,
  at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  meta JSONB DEFAULT '{}'::jsonb
);\n`);

    // ۸. جدول درخواست‌های حذف (Takedowns)
    parts.push(`-- ۸. جدول درخواست‌های حذف اثر (Takedowns)`);
    parts.push(`CREATE TABLE IF NOT EXISTS public.takedown_requests (
  id TEXT PRIMARY KEY,
  track_id TEXT REFERENCES public.tracks(id) ON DELETE CASCADE,
  requester_contact TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);\n`);

    // ایندکس‌ها
    parts.push(`-- ایندکس‌ها برای کوئری‌های سریع و ضد تکرار`);
    parts.push(`CREATE INDEX IF NOT EXISTS idx_tracks_status ON public.tracks(status);`);
    parts.push(`CREATE INDEX IF NOT EXISTS idx_tracks_reciter ON public.tracks(reciter_id);`);
    parts.push(`CREATE INDEX IF NOT EXISTS idx_tracks_category ON public.tracks(category_id);`);
    parts.push(`CREATE INDEX IF NOT EXISTS idx_tracks_hash ON public.tracks(content_hash);`);
    parts.push(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_source_dedup ON public.tracks(source_type, source_external_id) WHERE source_type IS NOT NULL AND source_external_id IS NOT NULL;`);
    parts.push(`CREATE INDEX IF NOT EXISTS idx_scan_jobs_source ON public.scan_jobs(source_id);`);
    parts.push(`CREATE INDEX IF NOT EXISTS idx_audit_log_at ON public.audit_log(at DESC);\n`);

    // تنظیمات امنیت سطر (RLS)
    parts.push(`-- فعال‌سازی Row Level Security (RLS) در Supabase`);
    parts.push(`ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;`);
    parts.push(`ALTER TABLE public.reciters ENABLE ROW LEVEL SECURITY;`);
    parts.push(`ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;`);
    parts.push(`ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;`);
    parts.push(`ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;`);
    parts.push(`ALTER TABLE public.takedown_requests ENABLE ROW LEVEL SECURITY;\n`);

    parts.push(`-- سیاست‌های RLS برای دسترسی خواندن عمومی آثار منتشر شده`);
    parts.push(`DROP POLICY IF EXISTS "Public can view published tracks" ON public.tracks;`);
    parts.push(`CREATE POLICY "Public can view published tracks" ON public.tracks FOR SELECT USING (status = 'published');\n`);

    parts.push(`DROP POLICY IF EXISTS "Public can view reciters" ON public.reciters;`);
    parts.push(`CREATE POLICY "Public can view reciters" ON public.reciters FOR SELECT USING (true);\n`);

    parts.push(`DROP POLICY IF EXISTS "Public can view categories" ON public.categories;`);
    parts.push(`CREATE POLICY "Public can view categories" ON public.categories FOR SELECT USING (true);\n`);

    parts.push(`-- دسترسی کامل ادمین با نقش سرویس (Service Role)`);
    parts.push(`DROP POLICY IF EXISTS "Service role full access tracks" ON public.tracks;`);
    parts.push(`CREATE POLICY "Service role full access tracks" ON public.tracks FOR ALL TO service_role USING (true);\n`);

    // DML: ورود داده‌های واقعی زنده
    parts.push(`-- ========================================================`);
    parts.push(`-- ورود داده‌های زنده استخراج‌شده از SQLite`);
    parts.push(`-- ========================================================\n`);

    // ۱. درج کاربران
    const users = userRepo.findAll();
    if (users.length > 0) {
      parts.push(`-- درج ${users.length} کاربر`);
      for (const u of users) {
        parts.push(
          `INSERT INTO public.users (id, telegram_id, username, password_hash, role, active, created_at) ` +
            `VALUES (${escapeSqlString(u.id)}, ${escapeSqlString(u.telegram_id)}, ${escapeSqlString(u.username)}, ${escapeSqlString(u.password_hash)}, ${escapeSqlString(u.role)}, ${u.active ? 'true' : 'false'}, ${escapeSqlString(u.created_at)}) ` +
            `ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, password_hash = EXCLUDED.password_hash, active = EXCLUDED.active;`
        );
      }
      parts.push('');
    }

    // ۲. درج مداحان
    const reciters = reciterRepo.findAll();
    if (reciters.length > 0) {
      parts.push(`-- درج ${reciters.length} مداح و قاری`);
      for (const r of reciters) {
        parts.push(
          `INSERT INTO public.reciters (id, name, title, bio, avatar_url, tracks_count, style, accent_color) ` +
            `VALUES (${escapeSqlString(r.id)}, ${escapeSqlString(r.name)}, ${escapeSqlString(r.title)}, ${escapeSqlString(r.bio)}, ${escapeSqlString(r.avatar_url)}, ${escapeSqlNumber(r.tracks_count)}, ${escapeSqlString(r.style)}, ${escapeSqlString(r.accent_color)}) ` +
            `ON CONFLICT (id) DO UPDATE SET tracks_count = EXCLUDED.tracks_count, avatar_url = EXCLUDED.avatar_url;`
        );
      }
      parts.push('');
    }

    // ۳. درج دسته‌بندی‌ها
    const categories = categoryRepo.findAll();
    if (categories.length > 0) {
      parts.push(`-- درج ${categories.length} دسته‌بندی`);
      for (const c of categories) {
        parts.push(
          `INSERT INTO public.categories (id, name, slug, icon_name, tracks_count, description) ` +
            `VALUES (${escapeSqlString(c.id)}, ${escapeSqlString(c.name)}, ${escapeSqlString(c.slug)}, ${escapeSqlString(c.icon_name)}, ${escapeSqlNumber(c.tracks_count)}, ${escapeSqlString(c.description)}) ` +
            `ON CONFLICT (id) DO UPDATE SET tracks_count = EXCLUDED.tracks_count;`
        );
      }
      parts.push('');
    }

    // ۴. درج منابع
    const sources = sourceRepo.findAll();
    if (sources.length > 0) {
      parts.push(`-- درج ${sources.length} منبع پایش`);
      for (const s of sources) {
        parts.push(
          `INSERT INTO public.sources (id, type, ref, title, schedule, enabled, auto_publish, default_reciter_id, default_category_id, filters_json, last_run_at, last_status, created_at) ` +
            `VALUES (${escapeSqlString(s.id)}, ${escapeSqlString(s.type)}, ${escapeSqlString(s.ref)}, ${escapeSqlString(s.title)}, ${escapeSqlString(s.schedule)}, ${s.enabled ? 'true' : 'false'}, ${s.auto_publish ? 'true' : 'false'}, ${escapeSqlString(s.default_reciter_id)}, ${escapeSqlString(s.default_category_id)}, ${escapeJsonField(s.filters_json)}, ${escapeSqlString(s.last_run_at)}, ${escapeSqlString(s.last_status)}, ${escapeSqlString(s.created_at)}) ` +
            `ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled, last_run_at = EXCLUDED.last_run_at;`
        );
      }
      parts.push('');
    }

    // ۵. درج قطعات
    const allTracksStmt = db.prepare('SELECT * FROM tracks ORDER BY created_at ASC');
    const tracks = allTracksStmt.all() as any[];
    if (tracks.length > 0) {
      parts.push(`-- درج ${tracks.length} قطعه و کاندید صوتی`);
      for (const t of tracks) {
        parts.push(
          `INSERT INTO public.tracks (id, title, reciter_id, category_id, occasion, tags, lyrics, duration, bitrate, file_size_mb, content_hash, source_id, source_type, source_external_id, source_url, source_owner_name, staging_path, s3_key, audio_url, cover_url, ai_suggestion, status, reject_reason, reviewed_by, reviewed_at, published_at, channel_message_id, play_count, created_at) ` +
            `VALUES (${escapeSqlString(t.id)}, ${escapeSqlString(t.title)}, ${escapeSqlString(t.reciter_id)}, ${escapeSqlString(t.category_id)}, ${escapeSqlString(t.occasion)}, ${escapeJsonField(t.tags_json)}, ${escapeJsonField(t.lyrics_json)}, ${escapeSqlNumber(t.duration)}, ${escapeSqlString(t.bitrate)}, ${escapeSqlNumber(t.file_size)}, ${escapeSqlString(t.content_hash)}, ${escapeSqlString(t.source_id)}, ${escapeSqlString(t.source_type)}, ${escapeSqlString(t.source_external_id)}, ${escapeSqlString(t.source_url)}, ${escapeSqlString(t.source_owner_name)}, ${escapeSqlString(t.staging_path)}, ${escapeSqlString(t.s3_key)}, ${escapeSqlString(t.audio_url)}, ${escapeSqlString(t.cover_url)}, ${escapeJsonField(t.ai_suggestion_json)}, ${escapeSqlString(t.status)}, ${escapeSqlString(t.reject_reason)}, ${escapeSqlString(t.reviewed_by)}, ${escapeSqlString(t.reviewed_at)}, ${escapeSqlString(t.published_at)}, ${escapeSqlString(t.channel_message_id)}, ${escapeSqlNumber(t.play_count)}, ${escapeSqlString(t.created_at)}) ` +
            `ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, audio_url = EXCLUDED.audio_url, s3_key = EXCLUDED.s3_key, play_count = EXCLUDED.play_count;`
        );
      }
      parts.push('');
    }

    // ۶. درج درخواست‌های حذف (Takedowns)
    const takedowns = takedownRepo.findAll(100);
    if (takedowns.length > 0) {
      parts.push(`-- درج ${takedowns.length} درخواست حذف اثر`);
      for (const td of takedowns) {
        parts.push(
          `INSERT INTO public.takedown_requests (id, track_id, requester_contact, reason, status, created_at) ` +
            `VALUES (${escapeSqlString(td.id)}, ${escapeSqlString(td.track_id)}, ${escapeSqlString(td.requester_contact)}, ${escapeSqlString(td.reason)}, ${escapeSqlString(td.status)}, ${escapeSqlString(td.created_at)}) ` +
            `ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;`
        );
      }
      parts.push('');
    }

    parts.push(`-- پایان اسکریپت مهاجرت`);
    parts.push(`-- با اجرای موفق این اسکریپت در Supabase SQL Editor، دیتابیس Postgres شما به طور کامل آماده بهره‌برداری خواهد بود.`);

    return parts.join('\n');
  }

  /**
   * بررسی زنده وضعیت اتصال به Supabase Rest API
   */
  public async testSupabaseConnection(config?: {
    projectUrl?: string;
    apiKey?: string;
  }): Promise<{
    reachable: boolean;
    latencyMs?: number;
    error?: string;
    statusText?: string;
  }> {
    const url = config?.projectUrl || process.env.SUPABASE_URL || '';
    const key = config?.apiKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!url) {
      return {
        reachable: false,
        error: 'آدرس پروژه Supabase (SUPABASE_URL) تنظیم نشده است.',
      };
    }

    const cleanUrl = url.replace(/\/$/, '');
    const startTime = Date.now();

    try {
      // درخواست سبک به روت اسکیما یا سلامت Rest v1
      const res = await fetch(`${cleanUrl}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: key,
          Authorization: key ? `Bearer ${key}` : '',
        },
      });

      const latencyMs = Date.now() - startTime;
      if (res.ok || res.status === 401 || res.status === 403 || res.status === 200) {
        return {
          reachable: true,
          latencyMs,
          statusText: `پاسخ از سرور با کد ${res.status} در ${latencyMs}ms`,
        };
      }

      return {
        reachable: false,
        latencyMs,
        error: `پاسخ غیرمنتظره: کد وضعیت ${res.status}`,
      };
    } catch (err: any) {
      return {
        reachable: false,
        error: `خطای اتصال به سرور Supabase: ${err.message}`,
      };
    }
  }

  /**
   * همگام‌سازی زنده با Supabase REST API
   */
  public async syncToSupabase(config?: {
    projectUrl?: string;
    apiKey?: string;
  }): Promise<{
    success: boolean;
    syncedCounts: {
      reciters: number;
      categories: number;
      tracks: number;
      sources: number;
    };
    errors: string[];
  }> {
    const url = config?.projectUrl || process.env.SUPABASE_URL || '';
    const key = config?.apiKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!url || !key) {
      throw new Error('آدرس پروژه (SUPABASE_URL) و کلید سرویس (SUPABASE_SERVICE_ROLE_KEY) الزامی هستند.');
    }

    const cleanUrl = url.replace(/\/$/, '');
    const headers = {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'resolution=merge-duplicates',
    };

    const errors: string[] = [];
    let syncedReciters = 0;
    let syncedCategories = 0;
    let syncedTracks = 0;
    let syncedSources = 0;

    // ۱. ارسال مداحان
    const reciters = reciterRepo.findAll();
    for (const r of reciters) {
      try {
        const res = await fetch(`${cleanUrl}/rest/v1/reciters`, {
          method: 'POST',
          headers,
          body: JSON.stringify(r),
        });
        if (res.ok) syncedReciters++;
        else errors.push(`خطا در ارسال مداح ${r.name}: ${res.statusText}`);
      } catch (e: any) {
        errors.push(`خطای شبکه برای مداح ${r.name}: ${e.message}`);
      }
    }

    // ۲. ارسال دسته‌بندی‌ها
    const categories = categoryRepo.findAll();
    for (const c of categories) {
      try {
        const res = await fetch(`${cleanUrl}/rest/v1/categories`, {
          method: 'POST',
          headers,
          body: JSON.stringify(c),
        });
        if (res.ok) syncedCategories++;
        else errors.push(`خطا در ارسال دسته ${c.name}: ${res.statusText}`);
      } catch (e: any) {
        errors.push(`خطای شبکه برای دسته ${c.name}: ${e.message}`);
      }
    }

    // ۳. ارسال قطعات
    const published = trackRepo.listPublished({ limit: 500, offset: 0 });
    for (const t of published.tracks) {
      try {
        const res = await fetch(`${cleanUrl}/rest/v1/tracks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            id: t.id,
            title: t.title,
            reciter_id: t.reciter_id,
            category_id: t.category_id,
            occasion: t.occasion,
            duration: t.duration,
            file_size_mb: t.file_size,
            bitrate: t.bitrate,
            audio_url: t.audio_url,
            cover_url: t.cover_url,
            s3_key: t.s3_key,
            status: t.status,
            play_count: t.play_count,
            created_at: t.created_at,
          }),
        });
        if (res.ok) syncedTracks++;
        else errors.push(`خطا در ارسال قطعه ${t.title}: ${res.statusText}`);
      } catch (e: any) {
        errors.push(`خطای شبکه برای قطعه ${t.title}: ${e.message}`);
      }
    }

    return {
      success: errors.length === 0,
      syncedCounts: {
        reciters: syncedReciters,
        categories: syncedCategories,
        tracks: syncedTracks,
        sources: syncedSources,
      },
      errors,
    };
  }
}

export const migrationService = new MigrationService();
