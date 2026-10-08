import { BotConfig, Track } from './db.js';

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export const testTelegramToken = async (
  token: string
): Promise<{ success: boolean; bot?: TelegramBotInfo; error?: string }> => {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return { success: false, error: 'توکن ربات تلگرام وارد نشده است.' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const data = (await res.json()) as any;

    if (!data.ok) {
      return {
        success: false,
        error: data.description || 'توکن نامعتبر است یا ربات در تلگرام یافت نشد.',
      };
    }

    return {
      success: true,
      bot: data.result as TelegramBotInfo,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `عدم امکان برقراری ارتباط با سرورهای تلگرام: ${err.message || String(err)}`,
    };
  }
};

export const sendChannelTestMessage = async (
  token: string,
  channelId: string
): Promise<{ success: boolean; messageId?: number; error?: string }> => {
  const cleanToken = token.trim();
  const cleanChannel = channelId.trim();

  if (!cleanToken) return { success: false, error: 'توکن ربات وارد نشده است.' };
  if (!cleanChannel) return { success: false, error: 'شناسه کانال (@channel یا عدد) وارد نشده است.' };

  try {
    const testText = `🕊 **پیام آزمایشی سامانه مداحی و ادعیه**\n\nاین پیام جهت تست اتصال خودکار ربات به کانال ارسال شده است.\nتاریخ تست: ${new Date().toLocaleDateString('fa-IR')} ساعت ${new Date().toLocaleTimeString('fa-IR')}\n\n✅ اتصال موفقیت‌آمیز است.`;

    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cleanChannel,
        text: testText,
        parse_mode: 'Markdown',
      }),
    });

    const data = (await res.json()) as any;
    if (!data.ok) {
      return {
        success: false,
        error: data.description || 'ارسال به کانال ناموفق بود (بررسی کنید که ربات ادمین کانال با دسترسی ارسال پیام باشد).',
      };
    }

    return {
      success: true,
      messageId: data.result?.message_id,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `خطا در ارتباط با تلگرام: ${err.message || String(err)}`,
    };
  }
};

export const publishTrackToTelegramChannel = async (
  track: Track,
  botConfig: BotConfig,
  customCaption?: string
): Promise<{ success: boolean; messageId?: number; error?: string }> => {
  if (!botConfig.token) {
    return { success: false, error: 'توکن ربات تلگرام تنظیم نشده است.' };
  }
  if (!botConfig.targetChannel) {
    return { success: false, error: 'شناسه کانال مقصد تلگرام مشخص نشده است.' };
  }

  const durationMin = Math.floor(track.duration / 60);
  const durationSec = track.duration % 60;
  const durationStr = `${durationMin}:${durationSec < 10 ? '0' : ''}${durationSec}`;

  let caption =
    customCaption ||
    botConfig.channelCaptionTemplate ||
    '🎙 {title}\n👤 با نوای: {reciter}\n📁 دسته: {category}\n⏱ مدت زمان: {duration}\n\n🆔 {channel}';

  caption = caption
    .replace('{title}', track.title)
    .replace('{reciter}', track.reciterName || 'نامشخص')
    .replace('{category}', track.categoryName || 'عمومی')
    .replace('{duration}', durationStr)
    .replace('{channel}', botConfig.targetChannel);

  // Append tags if present
  if (track.tags && track.tags.length > 0) {
    const hashtags = track.tags
      .map((t) => `#${t.replace(/\s+/g, '_')}`)
      .slice(0, 5)
      .join(' ');
    caption += `\n\n${hashtags}`;
  }

  try {
    // 1. Try sending as Audio via Telegram sendAudio
    const audioRes = await fetch(
      `https://api.telegram.org/bot${botConfig.token.trim()}/sendAudio`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: botConfig.targetChannel.trim(),
          audio: track.audioUrl,
          caption: caption.slice(0, 1024),
          title: track.title,
          performer: track.reciterName,
          duration: track.duration,
          thumbnail: track.coverUrl || undefined,
        }),
      }
    );

    const audioData = (await audioRes.json()) as any;
    if (audioData.ok) {
      return {
        success: true,
        messageId: audioData.result?.message_id,
      };
    }

    // 2. Fallback: If sendAudio with external URL fails (e.g. strict URL restrictions),
    // send rich message with audio link
    const msgText = `${caption}\n\n🔗 **لینک دانلود و پخش مستقیم:**\n${track.audioUrl}`;
    const msgRes = await fetch(
      `https://api.telegram.org/bot${botConfig.token.trim()}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: botConfig.targetChannel.trim(),
          text: msgText,
          disable_web_page_preview: false,
        }),
      }
    );

    const msgData = (await msgRes.json()) as any;
    if (msgData.ok) {
      return {
        success: true,
        messageId: msgData.result?.message_id,
      };
    }

    return {
      success: false,
      error: msgData.description || audioData.description || 'خطا در ارسال به کانال تلگرام.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: `خطای شبکه در ارسال به تلگرام: ${err.message || String(err)}`,
    };
  }
};
