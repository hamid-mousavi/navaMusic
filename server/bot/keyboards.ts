// server/bot/keyboards.ts
// کیبوردهای تعاملی و شیشه‌ای ربات تلگرام

import { InlineKeyboardMarkup, ReplyKeyboardMarkup } from './types.js';
import { Reciter, Category } from '../db/types.js';

export function mainMenuReplyKeyboard(): ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: '✨ تازه‌ترین نواها' }, { text: '🔍 جستجوی آثار' }],
      [{ text: '👤 مداحان و ذاکران' }, { text: '📁 دسته‌بندی‌ها و مناسبت‌ها' }],
    ],
    resize_keyboard: true,
  };
}

export function adminCandidateKeyboard(trackId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ تأیید و انتشار در سامانه', callback_data: `admin:approve:${trackId}` },
        { text: '❌ رد کاندید', callback_data: `admin:reject:${trackId}` },
      ],
      [
        { text: '📢 انتشار مستقیم در کانال تلگرام', callback_data: `admin:publish:${trackId}` },
      ],
    ],
  };
}

export function trackActionKeyboard(trackId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📥 دریافت فایل صوتی کامل', callback_data: `track:play:${trackId}` },
      ],
    ],
  };
}

export function recitersKeyboard(reciters: Reciter[]): InlineKeyboardMarkup {
  const buttons = reciters.slice(0, 10).map((r) => [
    { text: `🎙 ${r.name} (${r.tracks_count} اثر)`, callback_data: `reciter:${r.id}` },
  ]);
  return { inline_keyboard: buttons };
}

export function categoriesKeyboard(categories: Category[]): InlineKeyboardMarkup {
  const buttons = categories.slice(0, 10).map((c) => [
    { text: `📁 ${c.name} (${c.tracks_count} اثر)`, callback_data: `category:${c.id}` },
  ]);
  return { inline_keyboard: buttons };
}
