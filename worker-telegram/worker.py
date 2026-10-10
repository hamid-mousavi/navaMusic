#!/usr/bin/env python3
# worker-telegram/worker.py
# ورکر کلاینت تلگرام (Telethon) - ارتباط ۱۰۰٪ بر بستر API داخلی سرور بر اساس تصمیم D2

import os
import sys
import time
import logging
import asyncio
from typing import Optional, Dict, Any, List
import requests
from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.tl.types import MessageMediaDocument, DocumentAttributeAudio

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger("TelegramWorker")

API_BASE_URL = os.getenv("API_URL", "http://localhost:3000").rstrip("/")
INTERNAL_API_TOKEN = os.getenv("INTERNAL_API_TOKEN", "")

API_ID = int(os.getenv("TELEGRAM_API_ID", "0")) if os.getenv("TELEGRAM_API_ID") else 0
API_HASH = os.getenv("TELEGRAM_API_HASH", "")
SESSION_NAME = os.getenv("TELEGRAM_SESSION_NAME", "worker_session")

HEADERS = {
    "Authorization": f"Bearer {INTERNAL_API_TOKEN}"
}


def fetch_due_sources() -> List[Dict[str, Any]]:
    """دریافت لیست کانال‌های نیازمند اسکن از سرور مرکزی"""
    try:
        url = f"{API_BASE_URL}/api/internal/sources?type=telegram_channel&due=1"
        res = requests.get(url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            data = res.json()
            return data.get("sources", [])
        else:
            logger.error(f"Failed to fetch sources: {res.status_code} {res.text}")
            return []
    except Exception as e:
        logger.error(f"Network error fetching sources: {e}")
        return []


def upload_audio_to_server(
    file_path: str,
    title: str,
    source_external_id: str,
    source_url: str,
    source_owner_name: str,
    reciter_id: Optional[str] = None,
    category_id: Optional[str] = None,
    auto_publish: bool = False
) -> bool:
    """ارسال فایل صوتی دانلود شده به همراه متادیتا به وب‌سرویس Ingest سرور مرکزی"""
    try:
        url = f"{API_BASE_URL}/api/internal/ingest"
        with open(file_path, "rb") as f:
            files = {"audio": (os.path.basename(file_path), f, "audio/mpeg")}
            data = {
                "title": title,
                "sourceType": "telegram_channel",
                "sourceExternalId": source_external_id,
                "sourceUrl": source_url,
                "sourceOwnerName": source_owner_name,
                "autoPublish": "true" if auto_publish else "false"
            }
            if reciter_id:
                data["reciterId"] = reciter_id
            if category_id:
                data["categoryId"] = category_id

            res = requests.post(url, headers=HEADERS, data=data, files=files, timeout=120)
            if res.status_code == 200:
                logger.info(f"Successfully ingested: {title}")
                return True
            else:
                logger.error(f"Server rejected ingest: {res.status_code} {res.text}")
                return False
    except Exception as e:
        logger.error(f"Error uploading to server: {e}")
        return False


def report_job_completion(source_id: str, found_count: int, new_count: int, error: Optional[str] = None):
    """گزارش اتمام جاب به سرور مرکزی"""
    try:
        url = f"{API_BASE_URL}/api/internal/jobs/report"
        payload = {
            "sourceId": source_id,
            "status": "failed" if error else "done",
            "found": found_count,
            "newCount": new_count,
            "error": error
        }
        requests.post(url, headers=HEADERS, json=payload, timeout=10)
    except Exception as e:
        logger.error(f"Error reporting job: {e}")


async def scrape_channel(client: TelegramClient, source: Dict[str, Any]):
    """اسکن پیام‌های اخیر یک کانال تلگرام و ارسال صوت‌های جدید"""
    channel_ref = source["ref"]
    source_id = source["id"]
    logger.info(f"Starting scan for channel: {channel_ref}")

    found_count = 0
    new_count = 0
    error_msg = None

    try:
        entity = await client.get_entity(channel_ref)
        messages = await client.get_messages(entity, limit=20)

        for msg in messages:
            if not msg.media or not isinstance(msg.media, MessageMediaDocument):
                continue

            # بررسی اینکه آیا سند ارسال شده صوتی است یا خیر
            is_audio = False
            title = ""
            for attr in msg.media.document.attributes:
                if isinstance(attr, DocumentAttributeAudio):
                    is_audio = True
                    title = attr.title or ""
                    break

            if not is_audio:
                continue

            found_count += 1
            if not title:
                title = (msg.message or f"نوای تلگرام - پیام {msg.id}").split("\n")[0][:60]

            msg_external_id = f"{channel_ref}:{msg.id}"
            source_url = f"https://t.me/{channel_ref.lstrip('@')}/{msg.id}"

            # دانلود موقت در دیسک ورکر
            temp_file = f"/tmp/tg_{msg.id}.mp3"
            logger.info(f"Downloading message {msg.id}: {title}")
            await client.download_media(msg, file=temp_file)

            if os.path.exists(temp_file):
                ok = upload_audio_to_server(
                    file_path=temp_file,
                    title=title,
                    source_external_id=msg_external_id,
                    source_url=source_url,
                    source_owner_name=source.get("title", channel_ref),
                    reciter_id=source.get("default_reciter_id"),
                    category_id=source.get("default_category_id"),
                    auto_publish=source.get("auto_publish", False)
                )
                if ok:
                    new_count += 1

                # پاک‌سازی فایل موقت در ورکر
                try:
                    os.remove(temp_file)
                except Exception:
                    pass

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error scraping channel {channel_ref}: {e}")

    report_job_completion(source_id, found_count, new_count, error_msg)


async def main():
    if not INTERNAL_API_TOKEN:
        logger.error("INTERNAL_API_TOKEN is not set. Worker cannot authenticate with API.")
        sys.exit(1)

    if not API_ID or not API_HASH:
        logger.warning("TELEGRAM_API_ID or TELEGRAM_API_HASH not configured.")
        logger.info("Worker will poll API in dry-run/mock mode.")

    logger.info("Telegram Worker started. Polling internal API...")

    while True:
        sources = fetch_due_sources()
        if sources:
            logger.info(f"Found {len(sources)} due telegram sources.")
            if API_ID and API_HASH:
                async with TelegramClient(SESSION_NAME, API_ID, API_HASH) as client:
                    for source in sources:
                        await scrape_channel(client, source)
            else:
                logger.info("Skipping actual Telethon connection (API credentials needed).")
        time.sleep(60)


if __name__ == "__main__":
    asyncio.run(main())
