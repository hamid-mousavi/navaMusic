-- ====================================================================
-- اسکریپت ساخت جداول و دسترسی‌های دیتابیس Supabase (PostgreSQL)
-- پلتفرم جامع پخش و مدیریت مداحی و ادعیه
-- ====================================================================

-- فعال‌سازی افزونه تولید UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ۱. جدول مداحان و ذاکرین
CREATE TABLE IF NOT EXISTS public.reciters (
    id TEXT PRIMARY KEY DEFAULT 'rec_' || replace(uuid_generate_v4()::text, '-', ''),
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    style TEXT,
    accent_color TEXT DEFAULT '#10b981',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ۲. جدول دسته‌بندی‌های مذهبی
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    icon_name TEXT DEFAULT 'Sparkles',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- داده‌های اولیه دسته‌بندی‌ها
INSERT INTO public.categories (id, name, slug, description, icon_name)
VALUES
    ('cat-ziyarat', 'ادعیه و زیارات', 'ziyarat', 'زیارت عاشورا، دعای توسل، دعای کمیل، عهد و ندبه', 'BookOpen'),
    ('cat-munajat', 'مناجات و خلوت', 'munajat', 'مناجات شعبانیه، جوشن کبیر، افتتاح و مناجات خمسه عشر', 'Moon'),
    ('cat-moharram', 'محرم و عاشورا', 'moharram', 'شور، واحد، زمینه و روضه‌های ایام محرم و صفر', 'Flame'),
    ('cat-fatemiyeh', 'فاطمیه', 'fatemiyeh', 'مراثی و سوگواری ایام شهادت حضرت زهرا (س)', 'HeartHandshake'),
    ('cat-karbala', 'شوق و دلتنگی کربلا', 'karbala', 'نواهای دلتنگی حرم مطهر و پیاده‌روی اربعین', 'Compass')
ON CONFLICT (id) DO NOTHING;

-- ۳. جدول قطعات صوتی (Tracks)
CREATE TABLE IF NOT EXISTS public.tracks (
    id TEXT PRIMARY KEY DEFAULT 'track_' || replace(uuid_generate_v4()::text, '-', ''),
    title TEXT NOT NULL,
    reciter_id TEXT REFERENCES public.reciters(id) ON DELETE SET NULL,
    reciter_name TEXT NOT NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    occasion TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    file_size_mb NUMERIC(6, 2) DEFAULT 0,
    bitrate TEXT DEFAULT '128 kbps',
    audio_url TEXT NOT NULL,
    cover_url TEXT,
    s3_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- وضعیت: 'pending' (در انتظار بررسی) | 'approved' (تاییدشده عمومی) | 'rejected' (رد شده)
    source_telegram_channel TEXT,
    source_telegram_msg_id BIGINT,
    play_count BIGINT DEFAULT 0,
    lyrics JSONB DEFAULT '[]'::jsonb, -- متن و ترجمه هماهنگ به فرمت [{"time": 0, "textArabic": "...", "textPersian": "..."}]
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ۴. ایندکس‌های افزایش سرعت جستجو و استعلام در پلیر
CREATE INDEX IF NOT EXISTS idx_tracks_status ON public.tracks(status);
CREATE INDEX IF NOT EXISTS idx_tracks_category ON public.tracks(category_id);
CREATE INDEX IF NOT EXISTS idx_tracks_reciter ON public.tracks(reciter_id);
CREATE INDEX IF NOT EXISTS idx_tracks_telegram_dedup ON public.tracks(source_telegram_channel, source_telegram_msg_id);

-- ۵. فعال‌سازی قوانین امنیتی Row Level Security (RLS)
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reciters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- سیاست: کاربران عمومی فقط قطعات تایید شده (approved) را می‌بینند
CREATE POLICY "Public tracks are viewable by everyone" 
ON public.tracks FOR SELECT 
USING (status = 'approved');

CREATE POLICY "Public categories are viewable by everyone" 
ON public.categories FOR SELECT 
USING (true);

CREATE POLICY "Public reciters are viewable by everyone" 
ON public.reciters FOR SELECT 
USING (true);

-- دسترسی کامل به تمامی جداول برای کلید Service Role ربات و پنل ادمین
CREATE POLICY "Service role full access on tracks" 
ON public.tracks FOR ALL 
TO service_role 
USING (true);

CREATE POLICY "Service role full access on reciters" 
ON public.reciters FOR ALL 
TO service_role 
USING (true);
