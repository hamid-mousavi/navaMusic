#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
پایشگر خودکار کانال‌های یوتیوب و سورس‌های وب (YouTube & Web Auto-Watcher)
تبدیل خودکار ویدیوها به MP3، استخراج کاور، آپلود به باکت S3 ابر آروان و ثبت در Supabase
پیش‌نیازها: pip install yt-dlp boto3 supabase python-dotenv mutagen
نرم‌افزار سیستمی: ffmpeg (sudo apt install -y ffmpeg)
"""

import os
import io
import re
import sys
import time
import json
import logging
from datetime import datetime
from dotenv import load_dotenv

import boto3
from botocore.client import Config
from supabase import create_client, Client
import yt_dlp

# بارگذاری متغیرهای محیطی
load_dotenv()

logging.basicConfig(
    format='[%(asctime)s] %(levelname)s: %(message)s',
    level=logging.INFO,
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("YouTubeWatcher")

# ۱. تنظیمات ابر آروان (ArvanCloud S3)
raw_endpoint = (os.getenv("ARVAN_S3_ENDPOINT") or os.getenv("ARVAN_ENDPOINT") or "https://s3.ir-thr-at1.arvanstorage.ir").strip().strip('"\'`')
if not raw_endpoint.startswith("http://") and not raw_endpoint.startswith("https://"):
    raw_endpoint = "https://" + raw_endpoint
S3_ENDPOINT = raw_endpoint.rstrip('/')

S3_BUCKET = (os.getenv("ARVAN_S3_BUCKET") or os.getenv("ARVAN_BUCKET_NAME") or "madahi-media-vault").strip().strip('"\'`')
S3_REGION = (os.getenv("ARVAN_S3_REGION") or os.getenv("ARVAN_REGION") or "ir-thr-at1").strip().strip('"\'`')
S3_ACCESS_KEY = os.getenv("ARVAN_ACCESS_KEY", "").strip().strip('"\'`')
S3_SECRET_KEY = os.getenv("ARVAN_SECRET_KEY", "").strip().strip('"\'`')
raw_cdn = os.getenv("ARVAN_CDN_DOMAIN", "").strip().strip('"\'`')
if raw_cdn and not raw_cdn.startswith("http://") and not raw_cdn.startswith("https://"):
    raw_cdn = "https://" + raw_cdn
CDN_DOMAIN = raw_cdn.rstrip('/')

# ۲. تنظیمات Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# اعتبارسنجی اولیه
if not S3_ACCESS_KEY or not S3_SECRET_KEY:
    logger.error("خطا: کلیدهای استوریج ابر آروان در .env تنظیم نشده است.")
    sys.exit(1)

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    logger.error("خطا: مشخصات اتصال به Supabase در .env تنظیم نشده است.")
    sys.exit(1)

# کلاینت‌های ابری
s3_client = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    region_name=S3_REGION,
    config=Config(s3={"addressing_style": "virtual"})
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# کانال‌های پیش‌فرض یوتیوب برای پایش خودکار
DEFAULT_YOUTUBE_CHANNELS = [
    {
        "name": "پایگاه فطرس (حاج محمود کریمی)",
        "url": "https://www.youtube.com/@Fotros_ir/videos",
        "reciter_name": "حاج محمود کریمی",
        "category_id": "cat-moharram"
    },
    {
        "name": "کانال رسمی دکتر حاج میثم مطیعی",
        "url": "https://www.youtube.com/@MeysamMotiee/videos",
        "reciter_name": "دکتر حاج میثم مطیعی",
        "category_id": "cat-ziyarat"
    },
    {
        "name": "هیئت فدائیان حضرت زهرا (کربلایی حسین طاهری)",
        "url": "https://www.youtube.com/@HosseinTaheri/videos",
        "reciter_name": "کربلایی حسین طاهری",
        "category_id": "cat-moharram"
    },
    {
        "name": "عتبه مقدس حسینی (ادعیه و زیارات)",
        "url": "https://www.youtube.com/@ImamHussainMedia/videos",
        "reciter_name": "استاد محسن فرهمند",
        "category_id": "cat-ziyarat"
    }
]

def is_video_already_processed(video_id: str) -> bool:
    """بررسی اینکه آیا این ویدیو قبلاً دانلود و ثبت شده است یا خیر"""
    try:
        res = supabase.table("tracks").select("id").eq("s3_key", f"incoming/youtube/{video_id}.mp3").execute()
        return len(res.data) > 0
    except Exception as e:
        logger.warning(f"خطا در بررسی تکراری بودن ویدیو: {e}")
        return False

def download_and_upload_youtube_audio(video_url: str, channel_info: dict) -> bool:
    """دانلود صدا از یوتیوب، تبدیل به MP3 و ارسال مستقیم به ابر آروان"""
    output_temp_dir = "/tmp/madahi_downloads"
    os.makedirs(output_temp_dir, exist_ok=True)

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f'{output_temp_dir}/%(id)s.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '320',
        }],
        'writethumbnail': True,
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            logger.info(f"[*] در حال دریافت متادیتا: {video_url}")
            info = ydl.extract_info(video_url, download=True)
            video_id = info.get('id', '')
            title = info.get('title', 'بدون عنوان')
            duration = info.get('duration', 0)
            thumbnail_url = info.get('thumbnail', '')
            uploader = info.get('uploader', channel_info.get('name', ''))

            mp3_path = f"{output_temp_dir}/{video_id}.mp3"
            if not os.path.exists(mp3_path):
                logger.error(f"فایل MP3 یافت نشد: {mp3_path}")
                return False

            file_size_bytes = os.path.getsize(mp3_path)
            file_size_mb = round(file_size_bytes / (1024 * 1024), 2)
            s3_key = f"incoming/youtube/{video_id}.mp3"

            logger.info(f"[+] در حال آپلود به ابر آروان: {title} ({file_size_mb} MB)...")
            
            # آپلود فایل صوتی به ابر آروان با هدرهای بهینه
            with open(mp3_path, 'rb') as f:
                s3_client.put_object(
                    Bucket=S3_BUCKET,
                    Key=s3_key,
                    Body=f,
                    ContentType="audio/mpeg",
                    CacheControl="public, max-age=31536000",
                    ACL="public-read"
                )

            audio_public_url = f"{CDN_DOMAIN or S3_ENDPOINT + '/' + S3_BUCKET}/{s3_key}"
            logger.info(f"[✓] صوت با موفقیت در باکت آروان ذخیره شد: {audio_public_url}")

            # ثبت رکورد در پایگاه داده Supabase
            record = {
                "title": title[:100],
                "reciter_name": channel_info.get("reciter_name", uploader),
                "category_id": channel_info.get("category_id", "cat-all"),
                "occasion": "کانال یوتیوب " + channel_info.get("name", ""),
                "duration": duration,
                "file_size_mb": file_size_mb,
                "bitrate": "320 kbps",
                "audio_url": audio_public_url,
                "cover_url": thumbnail_url,
                "s3_key": s3_key,
                "status": "pending",  # در انتظار تایید ادمین در پنل
                "source_telegram_channel": f"YouTube: {uploader}",
                "play_count": 0,
                "lyrics": [],
                "tags": [channel_info.get("reciter_name", "یوتیوب"), "یوتیوب", "صوت باکیفیت"]
            }

            res = supabase.table("tracks").insert(record).execute()
            logger.info(f"[✓] رکورد در دیتابیس Supabase ایجاد شد (در انتظار تایید در پنل مدیریت).")

            # پاکسازی فایل‌های موقت
            try:
                os.remove(mp3_path)
            except Exception:
                pass

            return True

    except Exception as e:
        logger.error(f"خطا در پردازش ویدیوی یوتیوب {video_url}: {e}")
        return False

def check_channel_for_new_videos(channel_info: dict, max_videos: int = 5):
    """بررسی آخرین ویدیوهای کانال یوتیوب و دانلود ویدیوهای جدید"""
    channel_url = channel_info["url"]
    logger.info(f"--- در حال بررسی کانال یوتیوب: {channel_info['name']} ---")

    ydl_opts = {
        'extract_flat': True,
        'playlistend': max_videos,
        'quiet': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            playlist_info = ydl.extract_info(channel_url, download=False)
            if not playlist_info or 'entries' not in playlist_info:
                logger.warning(f"ویدئویی در کانال {channel_url} یافت نشد.")
                return

            entries = playlist_info['entries']
            for entry in entries:
                if not entry: continue
                video_id = entry.get('id', '')
                video_title = entry.get('title', '')
                video_url = f"https://www.youtube.com/watch?v=video_id"

                if not video_id:
                    continue

                if is_video_already_processed(video_id):
                    logger.info(f"ویدیو «{video_title}» قبلاً دریافت شده است (رد شد).")
                    continue

                logger.info(f"🔔 ویدیوی جدید در کانال کشف شد: {video_title} ({video_id})")
                download_and_upload_youtube_audio(video_url, channel_info)

    except Exception as e:
        logger.error(f"خطا در بررسی کانال {channel_url}: {e}")

def run_watcher_loop(interval_minutes: int = 30):
    """حلقه پایش خودکار با فاصله زمانی مشخص (مثلاً هر ۳۰ دقیقه)"""
    logger.info("======================================================")
    logger.info("سامانه پایشگر خودکار کانال‌های یوتیوب آغاز به کار کرد.")
    logger.info(f"فاصله زمانی بررسی: هر {interval_minutes} دقیقه")
    logger.info("======================================================")

    while True:
        try:
            for ch in DEFAULT_YOUTUBE_CHANNELS:
                check_channel_for_new_videos(ch, max_videos=3)
                time.sleep(3)  # تاخیر مودبانه بین درخواست‌ها

            logger.info(f"بررسی کامل شد. به خواب رفتن تا {interval_minutes} دقیقه آینده...")
            time.sleep(interval_minutes * 60)

        except KeyboardInterrupt:
            logger.info("پایشگر با درخواست کاربر متوقف شد.")
            break
        except Exception as e:
            logger.error(f"خطا در حلقه اصلی پایشگر: {e}")
            time.sleep(60)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].startswith("http"):
        # اگر کاربر یک لینک مستقیم یوتیوب به اسکریپت داد، فقط همان را دانلود و آپلود کن
        single_url = sys.argv[1]
        logger.info(f"دانلود تکی برای لینک: {single_url}")
        download_and_upload_youtube_audio(single_url, {"name": "دانلود مستقیم", "reciter_name": "مداح نامشخص"})
    else:
        # اجرای حالت پایشگر مداوم
        run_watcher_loop(interval_minutes=30)
