// server/bot/handlers/callbackHandlers.ts
// پردازش کلیک روی دکمه‌های شیشه‌ای (Inline Callbacks) و اعتبارسنجی نقش ادمین

import { TelegramCallbackQuery } from '../types.js';
import { telegramClient } from '../telegramClient.js';
import { trackActionKeyboard } from '../keyboards.js';
import { trackRepo, userRepo, settingsRepo } from '../../db/repos/index.js';
import { candidateService } from '../../services/candidateService.js';
import { publishTrackToTelegramChannel } from '../channelPublisher.js';

export async function handleCallbackQuery(cq: TelegramCallbackQuery) {
  const data = cq.data || '';
  const fromId = String(cq.from.id);
  const chatId = cq.message ? cq.message.chat.id : cq.from.id;
  const messageId = cq.message ? cq.message.message_id : undefined;

  // ۱. درخواست دریافت فایل صوتی توسط کاربر
  if (data.startsWith('track:play:')) {
    const trackId = data.replace('track:play:', '');
    const track = trackRepo.findById(trackId);

    if (!track || !track.audio_url) {
      await telegramClient.answerCallbackQuery(cq.id, 'فایل صوتی یافت نشد یا در دسترس نیست.', true);
      return;
    }

    await telegramClient.answerCallbackQuery(cq.id, 'در حال ارسال فایل صوتی...');

    const durationMin = Math.floor(track.duration / 60);
    const durationSec = track.duration % 60;
    const caption = `🎙 **${track.title}**\n👤 با نوای: ${track.reciter_name || 'نامشخص'}\n📁 دسته: ${track.category_name || 'عمومی'}\n⏱ مدت: ${durationMin}:${durationSec.toString().padStart(2, '0')}`;

    try {
      await telegramClient.sendAudio(chatId, track.audio_url, {
        title: track.title,
        performer: track.reciter_name || 'نوای آسمانی',
        duration: track.duration,
        caption,
        parse_mode: 'Markdown',
      });
    } catch (sendErr: any) {
      await telegramClient.sendMessage(
        chatId,
        `خطا در ارسال مستقیم فایل صوتی. می‌توانید از لینک زیر استفاده کنید:\n${track.audio_url}`
      );
    }
    return;
  }

  // ۲. عملیات مدیریتی ادمین (تأیید، رد، ارسال به کانال)
  if (data.startsWith('admin:')) {
    // اعتبارسنجی احراز هویت ادمین بر اساس telegram_id در جدول users
    const user = userRepo.findByTelegramId(fromId);
    if (!user || user.active !== 1) {
      await telegramClient.answerCallbackQuery(
        cq.id,
        '⛔️ دسترسی غیرمجاز: شناسه تلگرام شما به عنوان مدیر در سامانه ثبت نشده است.',
        true
      );
      return;
    }

    const parts = data.split(':');
    const action = parts[1];
    const trackId = parts[2];

    if (action === 'approve') {
      try {
        await telegramClient.answerCallbackQuery(cq.id, 'در حال تأیید و آپلود...');
        const approved = await candidateService.approve(trackId, { actor: user.username || 'admin' });

        if (messageId) {
          await telegramClient.editMessageText(
            chatId,
            messageId,
            `✅ **اثر با موفقیت تأیید و منتشر گردید.**\n\n🎙 عنوان: ${approved.title}\n👤 تأییدکننده: @${cq.from.username || user.username}\n⏱ تاریخ: ${new Date().toLocaleTimeString('fa-IR')}`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (err: any) {
        await telegramClient.answerCallbackQuery(cq.id, `خطا در تأیید: ${err.message}`, true);
      }
      return;
    }

    if (action === 'reject') {
      try {
        await candidateService.reject(trackId, `رد شده توسط @${cq.from.username || user.username} در تلگرام`, user.username || 'admin');
        await telegramClient.answerCallbackQuery(cq.id, 'کاندید با موفقیت رد شد.');

        if (messageId) {
          await telegramClient.editMessageText(
            chatId,
            messageId,
            `❌ **این اثر توسط مدیر رد شد و از استیجینگ پاک گردید.**`,
            { parse_mode: 'Markdown' }
          );
        }
      } catch (err: any) {
        await telegramClient.answerCallbackQuery(cq.id, `خطا در رد اثر: ${err.message}`, true);
      }
      return;
    }

    if (action === 'publish') {
      try {
        await telegramClient.answerCallbackQuery(cq.id, 'در حال انتشار در کانال...');
        const track = trackRepo.findById(trackId);
        if (!track) {
          throw new Error('اثر یافت نشد.');
        }

        const published = await publishTrackToTelegramChannel(track);
        if (published.success) {
          await telegramClient.answerCallbackQuery(cq.id, 'با موفقیت در کانال منتشر شد!', true);
        } else {
          await telegramClient.answerCallbackQuery(cq.id, `خطا در انتشار: ${published.error}`, true);
        }
      } catch (err: any) {
        await telegramClient.answerCallbackQuery(cq.id, `خطا: ${err.message}`, true);
      }
      return;
    }
  }

  // ۳. نمایش آثار یک مداح خاص
  if (data.startsWith('reciter:')) {
    const reciterId = data.replace('reciter:', '');
    const result = trackRepo.listPublished({ reciterId, limit: 5 });
    await telegramClient.answerCallbackQuery(cq.id);

    if (result.tracks.length === 0) {
      await telegramClient.sendMessage(chatId, 'اثری برای این مداح یافت نشد.');
      return;
    }

    for (const t of result.tracks) {
      await telegramClient.sendMessage(chatId, `🎙 **${t.title}**`, {
        parse_mode: 'Markdown',
        reply_markup: trackActionKeyboard(t.id),
      });
    }
    return;
  }

  // ۴. نمایش آثار یک دسته خاص
  if (data.startsWith('category:')) {
    const categoryId = data.replace('category:', '');
    const result = trackRepo.listPublished({ categoryId, limit: 5 });
    await telegramClient.answerCallbackQuery(cq.id);

    if (result.tracks.length === 0) {
      await telegramClient.sendMessage(chatId, 'اثری در این دسته یافت نشد.');
      return;
    }

    for (const t of result.tracks) {
      await telegramClient.sendMessage(chatId, `📁 **${t.title}**`, {
        parse_mode: 'Markdown',
        reply_markup: trackActionKeyboard(t.id),
      });
    }
    return;
  }

  await telegramClient.answerCallbackQuery(cq.id);
}
