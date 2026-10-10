// server/bot/channelPublisher.ts
// ارسال آثار به کانال تلگرام با قالب کپشن پویا و متغیرهای هوشمند

import { Track } from '../db/types.js';
import { settingsRepo } from '../db/repos/index.js';
import { telegramClient } from './telegramClient.js';
import { toPersianDigits, formatDuration } from './formatters.js';

export async function publishTrackToTelegramChannel(
  track: Track,
  customConfig?: { token?: string; targetChannel?: string; template?: string }
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  // ۱. بازیابی تنظیمات
  const savedBotConfig = settingsRepo.getJson<any>('botConfig') || {};
  const token = customConfig?.token || savedBotConfig.token || process.env.TELEGRAM_BOT_TOKEN;
  const targetChannel = customConfig?.targetChannel || savedBotConfig.targetChannel || process.env.TELEGRAM_CHANNEL_ID;
  const template =
    customConfig?.template ||
    savedBotConfig.channelCaptionTemplate ||
    '🎙 {title}\n👤 با نوای: {reciter}\n📁 دسته: {category}\n⏱ مدت زمان: {duration}\n\n🆔 {channel}';

  if (!token) {
    return { success: false, error: 'توکن ربات تلگرام تنظیم نشده است.' };
  }
  if (!targetChannel) {
    return { success: false, error: 'کانال مقصد تلگرام مشخص نشده است.' };
  }
  if (!track.audio_url) {
    return { success: false, error: 'فایل صوتی جهت ارسال در دسترس نیست (ابتدا اثر را تأیید نمایید).' };
  }

  // ۲. تولید کپشن با متغیرهای هوشمند
  const durationFormatted = formatDuration(track.duration);
  const caption = template
    .replace(/{title}/g, track.title)
    .replace(/{reciter}/g, track.reciter_name || 'نوای آسمانی')
    .replace(/{category}/g, track.category_name || 'عمومی')
    .replace(/{duration}/g, toPersianDigits(durationFormatted))
    .replace(/{channel}/g, targetChannel)
    .replace(/{link}/g, track.audio_url);

  // ۳. ارسال به کانال با کلاینت تلگرام
  try {
    telegramClient.setToken(token);
    const result = await telegramClient.sendAudio(targetChannel, track.audio_url, {
      title: track.title,
      performer: track.reciter_name || 'نوای آسمانی',
      duration: track.duration,
      caption,
    });

    return {
      success: true,
      messageId: result?.message_id,
    };
  } catch (err: any) {
    console.error('[ChannelPublisher] Error sending audio to channel:', err);
    return {
      success: false,
      error: err.message || 'خطا در ارسال به کانال تلگرام',
    };
  }
}
