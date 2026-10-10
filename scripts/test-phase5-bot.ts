// scripts/test-phase5-bot.ts
// تست‌های خودکار ربات دوطرفه تلگرام، اعتبارسنجی نقش‌ها، وب‌هوک و کپشن‌ها (Phase 5)

import { userRepo, trackRepo, categoryRepo, reciterRepo } from '../server/db/repos/index.js';
import { botService } from '../server/bot/botService.js';
import { handleCommand } from '../server/bot/handlers/commandHandlers.js';
import { handleCallbackQuery } from '../server/bot/handlers/callbackHandlers.js';
import { publishTrackToTelegramChannel } from '../server/bot/channelPublisher.js';
import { telegramClient } from '../server/bot/telegramClient.js';
import { candidateService } from '../server/services/candidateService.js';
import { Track } from '../server/db/types.js';

const BASE_URL = 'http://localhost:3000';

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`❌ FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase5BotTests() {
  console.log('==> اجرای تست‌های جامع ربات دوطرفه تلگرام (Phase 5 Bot Tests)...');

  // موک کردن متدهای شبکه telegramClient جهت اجرای تست بدون نیاز به توکن فعال تلگرام
  const sentMessages: any[] = [];
  const answeredCallbacks: any[] = [];
  const editedMessages: any[] = [];

  telegramClient.sendMessage = async (chatId, text, options) => {
    sentMessages.push({ chatId, text, options });
    return { message_id: 12345 };
  };

  telegramClient.answerCallbackQuery = async (id, text, showAlert) => {
    answeredCallbacks.push({ id, text, showAlert });
    return true;
  };

  telegramClient.editMessageText = async (chatId, messageId, text, options) => {
    editedMessages.push({ chatId, messageId, text, options });
    return true;
  };

  telegramClient.sendAudio = async (chatId, audio, options) => {
    sentMessages.push({ chatId, audio, options });
    return { message_id: 54321 };
  };

  // ۱. تست پردازش دستورات عمومی کاربران (/start, /latest, /help, search)
  console.log('\n[1] تست پردازش دستورات کاربران (/start, /latest, /search):');
  await handleCommand({
    message_id: 1,
    chat: { id: 1001, type: 'private' },
    date: Date.now(),
    text: '/start',
  });
  assert(sentMessages.length > 0, 'پیام خوش‌آمدگویی /start ارسال گردید');
  assert(sentMessages[0].text.includes('نوای آسمانی'), 'متن خوش‌آمدگویی صحیح است');

  sentMessages.length = 0;
  await handleCommand({
    message_id: 2,
    chat: { id: 1001, type: 'private' },
    date: Date.now(),
    text: '/latest',
  });
  assert(sentMessages.length > 0, 'دریافت تازه‌ترین نواها از دیتابیس با /latest');

  sentMessages.length = 0;
  await handleCommand({
    message_id: 3,
    chat: { id: 1001, type: 'private' },
    date: Date.now(),
    text: 'کریمی',
  });
  assert(sentMessages.length > 0, 'جستجوی متن و نمایش نتایج تطبیق یافته');

  // ۲. تست عدم دسترسی کاربر عادی به دکمه‌های شیشه‌ای مدیریت (RBAC در تلگرام)
  console.log('\n[2] تست تفکیک دسترسی و جلوگیری از اقدام غیرمجاز کاربر عادی:');
  const regularUserTelegramId = 999999;

  await handleCallbackQuery({
    id: 'cb-1',
    from: { id: regularUserTelegramId, is_bot: false, first_name: 'کاربر عادی' },
    data: 'admin:approve:track-fake-123',
  });

  const lastAnswer = answeredCallbacks[answeredCallbacks.length - 1];
  assert(
    lastAnswer && lastAnswer.showAlert === true && lastAnswer.text.includes('دسترسی غیرمجاز'),
    'کاربر عادی بدون telegram_id ادمین اجازه تأیید اثر را ندارد (۴۰۳ / هشدار دسترسی)'
  );

  // ۳. تست دسترسی ادمین واقعی تلگرام و تأیید/رد کاندید
  console.log('\n[3] تست اقدام ادمین احراز هویت شده تلگرام:');
  const adminTgId = '88776655';
  const adminUser = userRepo.create({
    id: `user-bot-admin-${Date.now()}`,
    username: 'telegram_super_admin',
    password_hash: 'hash',
    role: 'admin',
    telegram_id: adminTgId,
    active: 1,
    created_at: new Date().toISOString(),
  });

  // ساخت یک کاندید آزمایشی در SQLite
  const candidateTrack = trackRepo.create({
    id: `track-cb-test-${Date.now()}`,
    title: 'نوای تست کلیک ادمین',
    reciter_id: null,
    category_id: null,
    occasion: null,
    tags_json: '[]',
    lyrics_json: '[]',
    duration: 120,
    bitrate: '320 kbps',
    file_size: 5,
    content_hash: `hash-${Date.now()}`,
    source_id: null,
    source_type: 'manual_upload',
    source_external_id: 'test',
    source_url: null,
    source_owner_name: null,
    staging_path: null,
    s3_key: null,
    audio_url: 'https://example.com/audio.mp3',
    cover_url: '',
    ai_suggestion_json: null,
    status: 'pending',
    reject_reason: null,
    reviewed_by: null,
    reviewed_at: null,
    published_at: null,
    channel_message_id: null,
    play_count: 0,
    created_at: new Date().toISOString(),
  });

  // کلیک ادمین برای رد کاندید
  await handleCallbackQuery({
    id: 'cb-2',
    from: { id: Number(adminTgId), is_bot: false, first_name: 'مدیر اصلی' },
    message: { message_id: 50, chat: { id: Number(adminTgId), type: 'private' }, date: Date.now() },
    data: `admin:reject:${candidateTrack.id}`,
  });

  const updatedTrack = trackRepo.findById(candidateTrack.id);
  assert(updatedTrack?.status === 'rejected', 'اثر با کلیک دکمه تلگرام به وضعیت rejected تغییر یافت');

  // ۴. تست وب‌هوک تلگرام (/api/bot/webhook)
  console.log('\n[4] تست مسیر وب‌هوک رسمی (/api/bot/webhook):');
  const webhookRes = await fetch(`${BASE_URL}/api/bot/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      update_id: 123456,
      message: {
        message_id: 99,
        chat: { id: 1001, type: 'private' },
        date: Date.now(),
        text: '/start',
      },
    }),
  });
  assert(webhookRes.status === 200, 'پاسخ موفق وب‌هوک تلگرام -> ۲۰۰ OK');
  const webhookData = await webhookRes.json();
  assert(webhookData.ok === true, 'دریافت تاییدیه ok: true از وب‌هوک');

  // ۵. پاک‌سازی دیتابیس
  userRepo.delete(adminUser.id);
  trackRepo.delete(candidateTrack.id);

  console.log('\n✅ تمامی تست‌های فاز ۵ با موفقیت پاس شدند!');
}

runPhase5BotTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
