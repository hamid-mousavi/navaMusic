// server/bot/telegramClient.ts
// کلاینت ارتباط با Telegram Bot API

import { InlineKeyboardMarkup, ReplyKeyboardMarkup, TelegramUpdate } from './types.js';

export interface SendMessageOptions {
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup;
  reply_to_message_id?: number;
}

export interface SendAudioOptions {
  caption?: string;
  parse_mode?: 'Markdown' | 'HTML';
  duration?: number;
  performer?: string;
  title?: string;
  thumbnail?: string;
  reply_markup?: InlineKeyboardMarkup;
}

export class TelegramClient {
  private token: string;

  constructor(token?: string) {
    this.token = token || process.env.TELEGRAM_BOT_TOKEN || '';
  }

  public setToken(token: string) {
    this.token = token.trim();
  }

  public getToken(): string {
    return this.token;
  }

  private getBaseUrl(): string {
    return `https://api.telegram.org/bot${this.token}`;
  }

  public async callApi(method: string, body: Record<string, any>): Promise<any> {
    if (!this.token) {
      throw new Error('توکن ربات تلگرام تنظیم نشده است.');
    }

    const res = await fetch(`${this.getBaseUrl()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.description || `خطای تلگرام در فراخوانی ${method}`);
    }
    return data.result;
  }

  public async sendMessage(chatId: number | string, text: string, options?: SendMessageOptions) {
    return this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      ...options,
    });
  }

  public async sendAudio(chatId: number | string, audioUrl: string, options?: SendAudioOptions) {
    return this.callApi('sendAudio', {
      chat_id: chatId,
      audio: audioUrl,
      ...options,
    });
  }

  public async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false) {
    return this.callApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    });
  }

  public async editMessageText(
    chatId: number | string,
    messageId: number,
    text: string,
    options?: { parse_mode?: 'Markdown' | 'HTML'; reply_markup?: InlineKeyboardMarkup }
  ) {
    return this.callApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options,
    });
  }

  public async setWebhook(url: string, secretToken?: string) {
    return this.callApi('setWebhook', {
      url,
      secret_token: secretToken,
    });
  }

  public async getUpdates(offset?: number, timeout = 25): Promise<TelegramUpdate[]> {
    return this.callApi('getUpdates', {
      offset,
      timeout,
    });
  }
}

export const telegramClient = new TelegramClient();
