// server/bot/handlers/commandHandlers.ts
// پردازش دستورات متنی کاربران در ربات تلگرام

import { TelegramMessage } from '../types.js';
import { telegramClient } from '../telegramClient.js';
import { mainMenuReplyKeyboard, trackActionKeyboard, recitersKeyboard, categoriesKeyboard } from '../keyboards.js';
import { trackRepo, reciterRepo, categoryRepo, userRepo } from '../../db/repos/index.js';

export async function handleCommand(msg: TelegramMessage) {
  const chatId = msg.chat.id;
  const fromId = msg.from ? String(msg.from.id) : '';
  const text = (msg.text || '').trim();

  // بررسی نقش کاربر از روی telegram_id
  const adminUser = fromId ? userRepo.findByTelegramId(fromId) : null;
  const isAdmin = adminUser && adminUser.active === 1;

  if (text === '/start' || text.startsWith('/start ')) {
    const welcomeText = `
سلام و درود به سامانه جامع «نوای آسمانی» خوش آمدید 🌺

با استفاده از این ربات می‌توانید به گنجینه مداحی‌ها، مراثی و ادعیه دسترسی داشته باشید، آثار را جستجو کنید و فایل‌های صوتی با کیفیت اصلی را مستقیماً دریافت نمایید.
${isAdmin ? `\n👑 **حالت مدیریت فعال است:** شما با نقش **${adminUser?.role}** شناسایی شدید و اعلان‌های کاندیدهای جدید را دریافت خواهید کرد.` : ''}

جهت جستجو، کافیست نام قطعه یا مداح مورد نظر خود را در چت ارسال کنید.
    `.trim();

    await telegramClient.sendMessage(chatId, welcomeText, {
      parse_mode: 'Markdown',
      reply_markup: mainMenuReplyKeyboard(),
    });
    return;
  }

  if (text === '/help' || text === 'راهنما') {
    const helpText = `
📖 **راهنمای استفاده از ربات:**

• 🔍 **جستجو:** کافیست بخشی از نام اثر یا مداح را بنویسید (مثلاً: «محمود کریمی» یا «زیارت عاشورا»).
• 📁 **/categories:** نمایش دسته‌بندی‌ها و مناسبت‌ها
• 👤 **/reciters:** فهرست مداحان و ادعیه‌خوان‌ها
• ✨ **/latest:** دریافت آخرین نواهای منتشر شده
    `.trim();

    await telegramClient.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
    return;
  }

  if (text === '/latest' || text === '✨ تازه‌ترین نواها') {
    const result = trackRepo.listPublished({ limit: 5 });
    if (result.tracks.length === 0) {
      await telegramClient.sendMessage(chatId, 'در حال حاضر اثری در سامانه ثبت نشده است.');
      return;
    }

    await telegramClient.sendMessage(chatId, '🎵 **تازه‌ترین نواهای منتشر شده:**', { parse_mode: 'Markdown' });

    for (const t of result.tracks) {
      const durationMin = Math.floor(t.duration / 60);
      const durationSec = t.duration % 60;
      const caption = `🎙 **${t.title}**\n👤 با نوای: ${t.reciter_name || 'نامشخص'}\n📁 دسته: ${t.category_name || 'عمومی'}\n⏱ مدت: ${durationMin}:${durationSec.toString().padStart(2, '0')}`;

      await telegramClient.sendMessage(chatId, caption, {
        parse_mode: 'Markdown',
        reply_markup: trackActionKeyboard(t.id),
      });
    }
    return;
  }

  if (text === '/reciters' || text === '👤 مداحان و ذاکران') {
    const reciters = reciterRepo.findAll();
    await telegramClient.sendMessage(
      chatId,
      '👤 **فهرست مداحان و ادعیه‌خوان‌های سامانه:**\nجهت مشاهده آثار، مداح مورد نظر را انتخاب کنید:',
      {
        parse_mode: 'Markdown',
        reply_markup: recitersKeyboard(reciters),
      }
    );
    return;
  }

  if (text === '/categories' || text === '📁 دسته‌بندی‌ها و مناسبت‌ها') {
    const categories = categoryRepo.findAll();
    await telegramClient.sendMessage(
      chatId,
      '📁 **فهرست دسته‌بندی‌ها و مناسبت‌ها:**\nجهت مشاهده آثار، دسته مورد نظر را انتخاب کنید:',
      {
        parse_mode: 'Markdown',
        reply_markup: categoriesKeyboard(categories),
      }
    );
    return;
  }

  // جستجو بر اساس متن
  const searchQuery = text.startsWith('/search ') ? text.replace('/search ', '').trim() : text;

  if (searchQuery.length >= 2) {
    const result = trackRepo.listPublished({ query: searchQuery, limit: 5 });
    if (result.tracks.length === 0) {
      await telegramClient.sendMessage(
        chatId,
        `نتیجه‌ای برای جستجوی «${searchQuery}» یافت نشد. لطفاً عبارت دیگری را جستجو نمایید.`
      );
      return;
    }

    await telegramClient.sendMessage(
      chatId,
      `🔍 **نتایج جستجو برای «${searchQuery}» (${result.total} مورد یافت شد):**`,
      { parse_mode: 'Markdown' }
    );

    for (const t of result.tracks) {
      const durationMin = Math.floor(t.duration / 60);
      const durationSec = t.duration % 60;
      const caption = `🎙 **${t.title}**\n👤 با نوای: ${t.reciter_name || 'نامشخص'}\n📁 دسته: ${t.category_name || 'عمومی'}\n⏱ مدت: ${durationMin}:${durationSec.toString().padStart(2, '0')}`;

      await telegramClient.sendMessage(chatId, caption, {
        parse_mode: 'Markdown',
        reply_markup: trackActionKeyboard(t.id),
      });
    }
  }
}
