// server/bot/botService.ts
// هسته مدیریت ربات دوطرفه تلگرام، پردازش وب‌هوک و اعلان‌های ادمین

import { TelegramUpdate } from './types.js';
import { telegramClient } from './telegramClient.js';
import { handleCommand } from './handlers/commandHandlers.js';
import { handleCallbackQuery } from './handlers/callbackHandlers.js';
import { adminCandidateKeyboard } from './keyboards.js';
import { userRepo, settingsRepo } from '../db/repos/index.js';
import { Track } from '../db/types.js';
import { toPersianDigits, formatDuration } from './formatters.js';

export class BotService {
  private pollingActive = false;
  private lastUpdateId = 0;

  constructor() {
    this.initToken();
  }

  private initToken() {
    const savedConfig = settingsRepo.getJson<any>('botConfig');
    const token = savedConfig?.token || process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      telegramClient.setToken(token);
    }
  }

  /**
   * پردازش یک آپدیت ورودی از طریق وب‌هوک یا پولینگ
   */
  public async processUpdate(update: TelegramUpdate): Promise<void> {
    try {
      this.initToken();

      if (update.message) {
        await handleCommand(update.message);
      } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
      }
    } catch (err) {
      console.error('[BotService] Error processing Telegram update:', err);
    }
  }

  /**
   * ارسال اعلان آنی ورود کاندید جدید به ادمین‌های ثبت‌شده در تلگرام
   */
  public async notifyAdminsNewCandidate(track: Track): Promise<void> {
    try {
      this.initToken();
      if (!telegramClient.getToken()) return;

      // دریافت ادمین‌ها و بررسی‌کنندگان دارای شناسه تلگرام
      const admins = userRepo.findAll().filter((u) => u.telegram_id && u.active === 1);
      if (admins.length === 0) return;

      let aiText = '';
      if (track.ai_suggestion_json) {
        try {
          const ai = JSON.parse(track.ai_suggestion_json);
          aiText = `\n💡 **پیشنهاد هوش مصنوعی Gemini:**\n• مداح: ${ai.suggested_reciter || '—'}\n• دسته: ${ai.suggested_category || '—'}\n• مناسبت: ${ai.occasion || '—'}`;
        } catch (_) {}
      }

      const durationStr = toPersianDigits(formatDuration(track.duration));
      const messageText = `
🔔 **کاندید جدید در صف بررسی قرار گرفت!**

🎙 **عنوان:** ${track.title}
👤 **مداح:** ${track.reciter_name || 'نامشخص'}
⏱ **مدت زمان:** ${durationStr}
📁 **حجم فایل:** ${track.file_size} مگابایت
🌐 **منبع:** ${track.source_type} (${track.source_owner_name || 'ورودی سیستم'})${aiText}

جهت تأیید، رد یا انتشار مستقیم از دکمه‌های زیر استفاده کنید:
      `.trim();

      for (const admin of admins) {
        try {
          await telegramClient.sendMessage(admin.telegram_id!, messageText, {
            parse_mode: 'Markdown',
            reply_markup: adminCandidateKeyboard(track.id),
          });
        } catch (err: any) {
          console.warn(`[BotService] Could not notify admin ${admin.username} (${admin.telegram_id}):`, err.message);
        }
      }
    } catch (err) {
      console.error('[BotService] Error notifying admins:', err);
    }
  }

  /**
   * شروع حلقه دریافت پیام‌ها در حالت Long Polling (جهت توسعه محلی)
   */
  public startPolling(): void {
    if (this.pollingActive) return;
    this.initToken();
    if (!telegramClient.getToken()) {
      console.log('[BotService] Telegram bot token not configured. Polling not started.');
      return;
    }

    this.pollingActive = true;
    console.log('[BotService] Long polling started for Telegram bot.');
    this.pollLoop();
  }

  public stopPolling(): void {
    this.pollingActive = false;
    console.log('[BotService] Long polling stopped.');
  }

  private async pollLoop(): Promise<void> {
    while (this.pollingActive) {
      try {
        const updates = await telegramClient.getUpdates(
          this.lastUpdateId > 0 ? this.lastUpdateId + 1 : undefined,
          25
        );
        for (const update of updates) {
          this.lastUpdateId = update.update_id;
          await this.processUpdate(update);
        }
      } catch (err: any) {
        // تاخیر کوتاه در صورت خطا جهت جلوگیری از اسپم درخواست
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
  }
}

export const botService = new BotService();
