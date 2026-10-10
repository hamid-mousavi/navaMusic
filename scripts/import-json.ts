// scripts/import-json.ts
// اسکریپت مهاجرت داده‌ها از db.json به دیتابیس SQLite بر اساس مستند فاز ۱

import fs from 'fs';
import path from 'path';
import {
  reciterRepo,
  categoryRepo,
  trackRepo,
  sourceRepo,
  settingsRepo,
  auditRepo,
} from '../server/db/repos/index.js';
import { db } from '../server/db/index.js';

const JSON_PATH = path.join(process.cwd(), 'data', 'db.json');

async function importData() {
  console.log('==> شروع فرآیند مهاجرت داده‌ها به SQLite...');

  let rawData: any = null;

  if (fs.existsSync(JSON_PATH)) {
    try {
      const content = fs.readFileSync(JSON_PATH, 'utf8');
      rawData = JSON.parse(content);
      console.log('✓ فایل data/db.json با موفقیت خوانده شد.');
    } catch (err) {
      console.warn('! خطا در پارس db.json، از داده‌های اولیه استفاده می‌شود:', err);
    }
  }

  if (!rawData) {
    console.log('! فایل db.json موجود نیست، مهاجرت متوقف شد.');
    return;
  }

  // ۱. انتقال دسته‌بندی‌ها
  let categoriesCount = 0;
  if (Array.isArray(rawData.categories)) {
    for (const cat of rawData.categories) {
      if (!cat.id) continue;
      const existing = categoryRepo.findById(cat.id);
      if (!existing) {
        categoryRepo.create({
          id: cat.id,
          name: cat.name,
          slug: cat.slug || cat.id,
          icon_name: cat.iconName || 'Sparkles',
          tracks_count: cat.tracksCount || 0,
          description: cat.description || '',
        });
        categoriesCount++;
      }
    }
  }
  console.log(`✓ تعداد ${categoriesCount} دسته‌بندی جدید ثبت شد.`);

  // ۲. انتقال مداحان
  let recitersCount = 0;
  if (Array.isArray(rawData.reciters)) {
    for (const rec of rawData.reciters) {
      if (!rec.id) continue;
      const existing = reciterRepo.findById(rec.id);
      if (!existing) {
        reciterRepo.create({
          id: rec.id,
          name: rec.name,
          title: rec.title || rec.name,
          bio: rec.bio || '',
          avatar_url: rec.avatarUrl || '',
          tracks_count: rec.tracksCount || 0,
          style: rec.style || '',
          accent_color: rec.accentColor || '#10b981',
        });
        recitersCount++;
      }
    }
  }
  console.log(`✓ تعداد ${recitersCount} مداح جدید ثبت شد.`);

  // ۳. انتقال قطعات منتشرشده
  let tracksCount = 0;
  if (Array.isArray(rawData.tracks)) {
    for (const t of rawData.tracks) {
      if (!t.id) continue;
      const existing = trackRepo.findById(t.id);
      if (!existing) {
        trackRepo.create({
          id: t.id,
          title: t.title,
          reciter_id: t.reciterId || null,
          category_id: t.categoryId || null,
          occasion: t.occasion || null,
          tags_json: JSON.stringify(t.tags || []),
          lyrics_json: JSON.stringify(t.lyrics || []),
          duration: t.duration || 0,
          bitrate: t.bitrate || '320 kbps',
          file_size: t.fileSizeMb || 0,
          content_hash: null,
          source_id: null,
          source_type: t.sourceType || 'manual_upload',
          source_external_id: t.id,
          source_url: t.sourceUrl || null,
          source_owner_name: null,
          staging_path: null,
          s3_key: t.s3Key || null,
          audio_url: t.audioUrl || null,
          cover_url: t.coverUrl || '',
          ai_suggestion_json: null,
          status: 'published',
          reject_reason: null,
          reviewed_by: 'system_import',
          reviewed_at: new Date().toISOString(),
          published_at: t.createdAt || new Date().toISOString(),
          channel_message_id: null,
          play_count: t.playCount || 0,
          created_at: t.createdAt || new Date().toISOString(),
        });
        tracksCount++;
      }
    }
  }
  console.log(`✓ تعداد ${tracksCount} قطعه منتشرشده ثبت شد.`);

  // ۴. انتقال صف در انتظار (Pending Queue)
  let pendingCount = 0;
  if (Array.isArray(rawData.pendingQueue)) {
    for (const q of rawData.pendingQueue) {
      if (!q.id) continue;
      const existing = trackRepo.findById(q.id);
      if (!existing) {
        trackRepo.create({
          id: q.id,
          title: q.title,
          reciter_id: q.reciterId || null,
          category_id: q.categoryId || null,
          occasion: q.occasion || null,
          tags_json: JSON.stringify(q.tags || []),
          lyrics_json: JSON.stringify(q.lyrics || []),
          duration: q.duration || 0,
          bitrate: q.bitrate || '320 kbps',
          file_size: q.fileSizeMb || 0,
          content_hash: null,
          source_id: null,
          source_type: q.sourceType || 'youtube',
          source_external_id: q.id,
          source_url: q.sourceUrl || null,
          source_owner_name: null,
          staging_path: null,
          s3_key: q.s3Key || null,
          audio_url: q.audioUrl || null,
          cover_url: q.coverUrl || '',
          ai_suggestion_json: null,
          status: 'pending',
          reject_reason: null,
          reviewed_by: null,
          reviewed_at: null,
          published_at: null,
          channel_message_id: null,
          play_count: 0,
          created_at: q.createdAt || new Date().toISOString(),
        });
        pendingCount++;
      }
    }
  }
  console.log(`✓ تعداد ${pendingCount} کاندید در صف بررسی ثبت شد.`);

  // ۵. انتقال کانال‌های یوتیوب به sources
  let ytSourcesCount = 0;
  if (Array.isArray(rawData.youtubeChannels)) {
    for (const ch of rawData.youtubeChannels) {
      if (!ch.id) continue;
      const existing = sourceRepo.findById(ch.id);
      if (!existing) {
        sourceRepo.create({
          id: ch.id,
          type: 'youtube_channel',
          ref: ch.channelHandle || ch.channelUrl || ch.id,
          title: ch.channelName,
          schedule: 'daily',
          enabled: ch.isMonitored ? 1 : 0,
          auto_publish: ch.autoApprove ? 1 : 0,
          default_reciter_id: ch.defaultReciterId || null,
          default_category_id: ch.defaultCategoryId || null,
          filters_json: '{}',
          last_run_at: null,
          last_status: 'ready',
          created_at: new Date().toISOString(),
        });
        ytSourcesCount++;
      }
    }
  }
  console.log(`✓ تعداد ${ytSourcesCount} کانال یوتیوب به منابع اضافه شد.`);

  // ۶. انتقال منابع تلگرام به sources
  let tgSourcesCount = 0;
  if (Array.isArray(rawData.telegramSources)) {
    for (const tg of rawData.telegramSources) {
      if (!tg.id) continue;
      const existing = sourceRepo.findById(tg.id);
      if (!existing) {
        sourceRepo.create({
          id: tg.id,
          type: 'telegram_channel',
          ref: tg.channelUsername || tg.id,
          title: tg.channelTitle || tg.channelUsername,
          schedule: 'daily',
          enabled: tg.isMonitored ? 1 : 0,
          auto_publish: tg.autoApprove ? 1 : 0,
          default_reciter_id: null,
          default_category_id: tg.categoryDefault || null,
          filters_json: '{}',
          last_run_at: null,
          last_status: 'ready',
          created_at: new Date().toISOString(),
        });
        tgSourcesCount++;
      }
    }
  }
  console.log(`✓ تعداد ${tgSourcesCount} کانال تلگرام به منابع اضافه شد.`);

  // ۷. انتقال تنظیمات ربات و عمومی
  if (rawData.botConfig) {
    settingsRepo.set('bot_config_json', JSON.stringify(rawData.botConfig));
    if (rawData.botConfig.targetChannel) {
      settingsRepo.set('target_channel', rawData.botConfig.targetChannel);
    }
    if (rawData.botConfig.channelCaptionTemplate) {
      settingsRepo.set('channel_caption_template', rawData.botConfig.channelCaptionTemplate);
    }
  }

  // ثبت لاگ ممیزی مهاجرت
  auditRepo.log({
    actor_type: 'system',
    actor_id: 'importer',
    action: 'migration_completed',
    entity: 'database',
    entity_id: 'app.db',
    meta_json: JSON.stringify({
      categories: categoriesCount,
      reciters: recitersCount,
      tracks: tracksCount,
      pending: pendingCount,
      sources: ytSourcesCount + tgSourcesCount,
    }),
  });

  // به‌روزرسانی شمارنده قطعات مداحان و دسته‌ها
  db.exec(`
    UPDATE reciters SET tracks_count = (
      SELECT COUNT(*) FROM tracks WHERE tracks.reciter_id = reciters.id AND tracks.status = 'published'
    );
    UPDATE categories SET tracks_count = (
      SELECT COUNT(*) FROM tracks WHERE tracks.category_id = categories.id AND tracks.status = 'published'
    );
  `);

  console.log('==> فرآیند مهاجرت داده‌ها با موفقیت کامل شد!');
}

importData().catch((err) => {
  console.error('خطا در اجرای مهاجرت:', err);
  process.exit(1);
});
