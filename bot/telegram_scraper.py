#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ربات تلگرام هوشمند گردآوری مداحی، ادعیه و زیارات
ارسال مستقیم به باکت S3 ابر آروان و ذخیره در دیتابیس Supabase
"""

import os
import io
import re
import sys
import asyncio
import logging
from datetime import datetime
from dotenv import load_dotenv

import boto3
from botocore.client import Config
from telethon import TelegramClient, events
from telethon.tl.types import DocumentAttributeAudio, DocumentAttributeFilename
from supabase import create_client, Client
import mutagen
from mutagen.id3 import ID3, APIC

# بارگذاری متغیرهای محیطی از فایل .env
load_dotenv()

# تنظیمات لاگینگ
logging.basicConfig(
    format='[%(asctime)s] %(levelname)s: %(message)s',
    level=logging.INFO,
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("MadahiScraper")

# ۱. متغیرهای تلگرام
API_ID = int(os.getenv("TELEGRAM_API_ID", "0"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "")
PHONE = os.getenv("TELEGRAM_PHONE", "")
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
ADMIN_CHAT_ID = os.getenv("ADMIN_TELEGRAM_CHAT_ID", "")
APP_ADMIN_URL = os.getenv("APP_ADMIN_URL", "https://your-app.vercel.app")
PROXY_URL = os.getenv("TELEGRAM_PROXY", "")

# ۲. متغیرهای ابر آروان (ArvanCloud S3)
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

# ۳. متغیرهای دیتابیس Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# اعتبارسنجی اولیه تنظیمات
if not API_ID or not API_HASH:
    logger.error("خطا: TELEGRAM_API_ID یا TELEGRAM_API_HASH در فایل .env تنظیم نشده است.")
    sys.exit(1)

if not S3_ACCESS_KEY or not S3_SECRET_KEY:
    logger.error("خطا: کلیدهای استوریج ابر آروان در .env تنظیم نشده است.")
    sys.exit(1)

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    logger.error("خطا: مشخصات پایگاه داده Supabase در .env تنظیم نشده است.")
    sys.exit(1)

# کلاینت استوریج S3 ابر آروان
s3_client = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    region_name=S3_REGION,
    config=Config(s3={"addressing_style": "virtual"})
)

# کلاینت پایگاه داده Supabase
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# لیست مداحان شناخته‌شده جهت تشخیص هوشمند از متن پیام
KNOWN_RECITERS = [
    {"name": "محمود کریمی", "title": "حاج محمود کریمی", "patterns": ["محمود کریمی", "کریمی", "رایه العباس", "فطرس"]},
    {"name": "میثم مطیعی", "title": "دکتر حاج میثم مطیعی", "patterns": ["میثم مطیعی", "مطیعی"]},
    {"name": "سید مجید بنی‌فاطمه", "title": "سید مجید بنی‌فاطمه", "patterns": ["بنی فاطمه", "بنی‌فاطمه", "ریحانه الحسین"]},
    {"name": "حسین طاهری", "title": "کربلایی حسین طاهری", "patterns": ["حسین طاهری", "طاهری", "فدائیان حضرت زهرا"]},
    {"name": "مهدی رسولی", "title": "حاج مهدی رسولی", "patterns": ["مهدی رسولی", "رسولی", "ثارالله زنجان"]},
    {"name": "محسن فرهمند", "title": "استاد محسن فرهمند", "patterns": ["فرهمند", "فرهمند آزاد"]},
    {"name": "مهدی سماواتی", "title": "حاج مهدی سماواتی", "patterns": ["سماواتی"]},
    {"name": "منصور ارضی", "title": "حاج منصور ارضی", "patterns": ["منصور ارضی", "ارضی"]},
    {"name": "محمدحسین پویانفر", "title": "کربلایی محمدحسین پویانفر", "patterns": ["پویانفر", "ریحانة النبی"]},
    {"name": "سید رضا نریمانی", "title": "کربلایی سید رضا نریمانی", "patterns": ["نریمانی", "فدائیان حسین"]},
]

def detect_reciter(text: str, audio_performer: str = "") -> dict:
    """تشخیص خودکار نام مداح از تگ صوتی یا متن پیام"""
    combined = f"{audio_performer} {text}"
    for rec in KNOWN_RECITERS:
        for p in rec["patterns"]:
            if re.search(p, combined, re.IGNORECASE):
                return rec
    return {
        "name": audio_performer.strip() if audio_performer else "مداح نامشخص",
        "title": audio_performer.strip() if audio_performer else "مداح نامشخص",
        "patterns": []
    }

def detect_category(text: str, title: str) -> str:
    """تشخیص دسته‌بندی موضوعی بر اساس متن"""
    full_text = f"{text} {title}".lower()
    if any(k in full_text for k in ["زیارت", "عاشورا", "توسل", "کمیل", "عهد", "ندبه", "وارث", "جامعه"]):
        return "cat-ziyarat"
    if any(k in full_text for k in ["مناجات", "خمسه عشر", "شعبانیه", "جوشن", "ابوحمزه", "افتتاح", "سحر"]):
        return "cat-munajat"
    if any(k in full_text for k in ["محرم", "عاشورا", "تاسوعا", "کربلا", "گودال", "قتلگاه", "شور", "واحد", "روضه"]):
        return "cat-moharram"
    if any(k in full_text for k in ["فاطمیه", "زهرا", "کوچه", "مدینه", "پهلوی شکسته", "مادر"]):
        return "cat-fatemiyeh"
    if any(k in full_text for k in ["اربعین", "پیاده روی", "ستون", "موکب", "نجف تا کربلا"]):
        return "cat-karbala"
    return "cat-all"

def detect_occasion(text: str) -> str:
    """تشخیص مناسبت از متن پیام"""
    for line in text.splitlines():
        line = line.strip()
        if any(w in line for w in ["شب", "روز", "ولادت", "شهادت", "ایام", "مناسبت", "محرم", "صفر", "رمضان"]):
            return line[:50]
    return "عمومی و هفتگی"

def is_audio_message(message) -> bool:
    """بررسی اینکه پیام دارای فایل صوتی مداحی است یا خیر"""
    if message.audio:
        return True
    if message.document:
        mime = getattr(message.document, "mime_type", "")
        if mime.startswith("audio/") or mime in ["application/ogg", "application/octet-stream"]:
            # بررسی پسوند فایل
            for attr in message.document.attributes:
                if isinstance(attr, DocumentAttributeAudio):
                    return True
                if isinstance(attr, DocumentAttributeFilename):
                    if attr.file_name.lower().endswith(('.mp3', '.m4a', '.wav', '.ogg')):
                        return True
    return False

def check_if_already_scraped(channel: str, msg_id: int) -> bool:
    """جلوگیری از ثبت تکراری قطعات از کانال"""
    try:
        res = supabase.table("tracks").select("id").eq("source_telegram_channel", channel).eq("source_telegram_msg_id", msg_id).execute()
        return len(res.data) > 0
    except Exception as e:
        logger.warning(f"خطا در بررسی تکراری بودن در دیتابیس: {e}")
        return False

# تنظیمات تلگرام کلاینت
proxy_dict = None
if PROXY_URL:
    import urllib.parse
    parsed = urllib.parse.urlparse(PROXY_URL)
    proxy_dict = {
        'proxy_type': parsed.scheme,
        'addr': parsed.hostname,
        'port': parsed.port,
        'username': parsed.username,
        'password': parsed.password
    }

client = TelegramClient("madahi_session", API_ID, API_HASH, proxy=proxy_dict)

async def notify_admin(track_title: str, reciter_name: str, channel: str, s3_url: str):
    """ارسال اعلان اختصاصی به مدیر سامانه در تلگرام با لینک تایید"""
    if not ADMIN_CHAT_ID:
        return
    try:
        text = (
            f"🔔 **دریافت مداحی جدید از تلگرام**\n\n"
            f"▫️ **عنوان:** {track_title}\n"
            f"▫️ **مداح:** {reciter_name}\n"
            f"▫️ **کانال منبع:** {channel}\n"
            f"▫️ **وضعیت:** در انتظار تایید در پنل ادمین\n\n"
            f"🌐 [ورود به پنل مدیریت و تایید انتشار]({APP_ADMIN_URL})"
        )
        await client.send_message(int(ADMIN_CHAT_ID), text, link_preview=False)
    except Exception as e:
        logger.warning(f"عدم امکان ارسال اعلان تلگرام به ادمین: {e}")

@client.on(events.NewMessage)
async def incoming_message_handler(event):
    """شنود پیام‌های جدید تمام کانال‌ها و گروه‌ها"""
    message = event.message
    
    # اگر پیام صوتی نیست، رد شو
    if not is_audio_message(message):
        return

    chat = await event.get_chat()
    chat_title = getattr(chat, 'title', 'کانال ناشناس')
    chat_username = f"@{chat.username}" if getattr(chat, 'username', None) else str(chat.id)

    # بررسی تکراری بودن پیام
    if check_if_already_scraped(chat_username, message.id):
        logger.info(f"پیام {message.id} از کانال {chat_username} قبلاً ثبت شده است.")
        return

    logger.info(f"[*] در حال پردازش فایل صوتی جدید از [{chat_title}] ({chat_username}) پیام #{message.id}...")

    # استخراج نام و متادیتای صوتی اولیه
    title = ""
    performer = ""
    duration = 0

    if message.document and message.document.attributes:
        for attr in message.document.attributes:
            if isinstance(attr, DocumentAttributeAudio):
                duration = attr.duration or 0
                title = attr.title or ""
                performer = attr.performer or ""

    caption = message.text or ""
    
    # تشخیص هوشمند مداح و دسته‌بندی
    reciter_info = detect_reciter(caption, performer)
    category_id = detect_category(caption, title)
    occasion = detect_occasion(caption)

    if not title:
        # استخراج نام از خط اول کپشن
        if caption.strip():
            first_line = caption.strip().splitlines()[0]
            title = re.sub(r'[@#\n]', '', first_line)[:70].strip()
        else:
            title = f"نوای مذهبی {reciter_info['name']}"

    file_size_mb = round(message.file.size / (1024 * 1024), 2)
    ext = ".mp3"
    if message.file.name and "." in message.file.name:
        ext = os.path.splitext(message.file.name)[1]

    s3_key = f"incoming/{datetime.now().strftime('%Y%m')}/bot_{message.id}_{reciter_info['name'].replace(' ', '_')}{ext}"

    logger.info(f"[+] در حال دانلود قطعه «{title}» ({file_size_mb} MB) به بافر موقت...")
    
    # دانلود مستقیم در بافر حافظه بدون نوشتن روی هارد دیسک
    audio_buffer = io.BytesIO()
    await message.download_media(file=audio_buffer)
    audio_buffer.seek(0)
    audio_bytes = audio_buffer.read()

    # تلاش برای استخراج کاور آرت تعبیه‌شده در فایل MP3
    cover_url = ""
    try:
        audio_stream = io.BytesIO(audio_bytes)
        tags = mutagen.File(audio_stream)
        if tags and hasattr(tags, 'tags') and tags.tags:
            for tag in tags.tags.values():
                if isinstance(tag, APIC):
                    cover_key = f"covers/bot_{message.id}_cover.jpg"
                    s3_client.put_object(
                        Bucket=S3_BUCKET,
                        Key=cover_key,
                        Body=tag.data,
                        ContentType=tag.mime or "image/jpeg",
                        CacheControl="public, max-age=31536000",
                        ACL="public-read"
                    )
                    cover_url = f"{CDN_DOMAIN or S3_ENDPOINT + '/' + S3_BUCKET}/{cover_key}"
                    logger.info(f"[+] کاور آلبوم استخراج و در S3 آپلود شد: {cover_key}")
                    break
    except Exception as tag_err:
        logger.debug(f"عدم امکان خواندن کاور: {tag_err}")

    # آپلود مستقیم به باکت S3 ابر آروان
    logger.info(f"[+] در حال آپلود استریم به باکت {S3_BUCKET} در ابر آروان...")
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=s3_key,
        Body=audio_bytes,
        ContentType="audio/mpeg",
        CacheControl="public, max-age=31536000",
        ACL="public-read"
    )

    audio_public_url = f"{CDN_DOMAIN or S3_ENDPOINT + '/' + S3_BUCKET}/{s3_key}"
    logger.info(f"[✓] فایل صوتی با موفقیت در ابر آروان ذخیره شد: {audio_public_url}")

    # ثبت رکورد در پایگاه داده Supabase
    record = {
        "title": title,
        "reciter_name": reciter_info["name"],
        "category_id": category_id,
        "occasion": occasion,
        "duration": duration,
        "file_size_mb": file_size_mb,
        "bitrate": "128 kbps",
        "audio_url": audio_public_url,
        "cover_url": cover_url,
        "s3_key": s3_key,
        "status": "pending",  # در انتظار تایید در پنل مدیریت
        "source_telegram_channel": chat_username,
        "source_telegram_msg_id": message.id,
        "play_count": 0,
        "lyrics": [],
        "tags": [reciter_info["name"], occasion]
    }

    try:
        res = supabase.table("tracks").insert(record).execute()
        logger.info(f"[✓] قطعه در جدول tracks سوپابیس با وضعیت pending ثبت شد.")
    except Exception as db_err:
        logger.error(f"خطا در درج در دیتابیس Supabase: {db_err}")

    # ارسال اعلان به ادمین در تلگرام
    await notify_admin(title, reciter_info["name"], chat_username, audio_public_url)

async def main():
    logger.info("در حال اتصال به تلگرام...")
    if PHONE:
        await client.start(phone=PHONE)
    else:
        await client.start()

    me = await client.get_me()
    logger.info(f"✓ ورود موفق به تلگرام با حساب: {me.first_name} (@{me.username or me.id})")
    logger.info(f"✓ متصل به باکت S3 ابر آروان: {S3_BUCKET}")
    logger.info(f"✓ متصل به پایگاه داده Supabase: {SUPABASE_URL}")
    logger.info("ربات در حال شنود مداحی‌های جدید از کانال‌ها و گروه‌هاست...")

    await client.run_until_disconnected()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("ربات با درخواست کاربر متوقف شد.")
    except Exception as e:
        logger.critical(f"خطای بحرانی در اجرای ربات: {e}", exc_info=True)
