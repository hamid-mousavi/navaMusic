// scripts/test-repos.ts
// تست واحد مخازن داده (Repository Unit Tests)

import {
  trackRepo,
  reciterRepo,
  categoryRepo,
  sourceRepo,
  userRepo,
  scanJobRepo,
  auditRepo,
  settingsRepo,
} from '../server/db/repos/index.js';
import { backupDatabase } from '../server/db/index.js';

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`❌ FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('==> اجرای تست‌های واحد مخازن داده SQLite...');

  // ۱. تست ReciterRepo
  console.log('\n[1] تست ReciterRepo:');
  const testReciter = {
    id: `rec-test-${Date.now()}`,
    name: 'مداح تست',
    title: 'کربلایی مداح تست',
    bio: 'توضیحات تست',
    avatar_url: '',
    tracks_count: 5,
    style: 'شور',
    accent_color: '#3b82f6',
  };
  reciterRepo.create(testReciter);
  const foundRec = reciterRepo.findById(testReciter.id);
  assert(foundRec !== null, 'یافتن مداح بر اساس شناسه');
  assert(foundRec?.name === 'مداح تست', 'صحت نام مداح');

  reciterRepo.update(testReciter.id, { name: 'مداح تست ویرایش شده' });
  const updatedRec = reciterRepo.findById(testReciter.id);
  assert(updatedRec?.name === 'مداح تست ویرایش شده', 'ویرایش نام مداح');

  reciterRepo.updateTracksCount(testReciter.id, +2);
  const countRec = reciterRepo.findById(testReciter.id);
  assert(countRec?.tracks_count === 7, 'افزایش شمارنده آثار مداح');

  reciterRepo.delete(testReciter.id);
  assert(reciterRepo.findById(testReciter.id) === null, 'حذف مداح تستی');

  // ۲. تست CategoryRepo
  console.log('\n[2] تست CategoryRepo:');
  const testCat = {
    id: `cat-test-${Date.now()}`,
    name: 'دسته تستی',
    slug: `test-slug-${Date.now()}`,
    icon_name: 'Moon',
    tracks_count: 10,
    description: 'دسته برای تست',
  };
  categoryRepo.create(testCat);
  const foundCat = categoryRepo.findBySlug(testCat.slug);
  assert(foundCat !== null, 'یافتن دسته‌بندی با slug');
  assert(foundCat?.name === 'دسته تستی', 'صحت نام دسته‌بندی');

  categoryRepo.delete(testCat.id);
  assert(categoryRepo.findById(testCat.id) === null, 'حذف دسته‌بندی تستی');

  // ۳. تست TrackRepo
  console.log('\n[3] تست TrackRepo:');
  const testTrackId = `track-test-${Date.now()}`;
  trackRepo.create({
    id: testTrackId,
    title: 'نوای آزمایشی',
    reciter_id: null,
    category_id: null,
    occasion: 'آزمایش',
    tags_json: '["آزمایش"]',
    lyrics_json: '[]',
    duration: 180,
    bitrate: '320 kbps',
    file_size: 4.2,
    content_hash: 'hash-12345',
    source_id: null,
    source_type: 'youtube_channel',
    source_external_id: 'yt-ext-123',
    source_url: 'https://youtube.com/watch?v=123',
    source_owner_name: null,
    staging_path: null,
    s3_key: 'audio/test.mp3',
    audio_url: 'https://example.com/test.mp3',
    cover_url: '',
    ai_suggestion_json: null,
    status: 'published',
    reject_reason: null,
    reviewed_by: 'admin',
    reviewed_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
    channel_message_id: null,
    play_count: 10,
    created_at: new Date().toISOString(),
  });

  const foundTrack = trackRepo.findById(testTrackId);
  assert(foundTrack !== null, 'یافتن قطعه بر اساس شناسه');
  assert(foundTrack?.title === 'نوای آزمایشی', 'صحت عنوان قطعه');

  const foundBySource = trackRepo.findBySource('youtube_channel', 'yt-ext-123');
  assert(foundBySource !== null, 'یافتن قطعه بر اساس منبع و شناسه خارجی');

  const foundByHash = trackRepo.findByContentHash('hash-12345');
  assert(foundByHash !== null, 'یافتن قطعه با هش محتوا');

  trackRepo.incrementPlayCount(testTrackId);
  assert(trackRepo.findById(testTrackId)?.play_count === 11, 'افزایش تعداد پخش قطعه');

  trackRepo.delete(testTrackId);
  assert(trackRepo.findById(testTrackId) === null, 'حذف قطعه تستی');

  // ۴. تست SourceRepo
  console.log('\n[4] تست SourceRepo:');
  const testSourceId = `src-test-${Date.now()}`;
  sourceRepo.create({
    id: testSourceId,
    type: 'youtube_channel',
    ref: '@test_channel',
    title: 'کانال آزمایشی',
    schedule: 'every_6h',
    enabled: 1,
    auto_publish: 0,
    default_reciter_id: null,
    default_category_id: null,
    filters_json: '{}',
    last_run_at: null,
    last_status: 'ready',
    created_at: new Date().toISOString(),
  });

  const foundSource = sourceRepo.findById(testSourceId);
  assert(foundSource !== null, 'یافتن منبع بر اساس شناسه');
  assert(foundSource?.schedule === 'every_6h', 'صحت بازه زمان‌بندی منبع');

  sourceRepo.delete(testSourceId);
  assert(sourceRepo.findById(testSourceId) === null, 'حذف منبع تستی');

  // ۵. تست UserRepo
  console.log('\n[5] تست UserRepo:');
  const testUserId = `user-test-${Date.now()}`;
  userRepo.create({
    id: testUserId,
    telegram_id: '99887766',
    username: 'test_admin',
    password_hash: 'hashed_pw',
    role: 'admin',
    active: 1,
    created_at: new Date().toISOString(),
  });

  const foundUser = userRepo.findByUsername('test_admin');
  assert(foundUser !== null, 'یافتن کاربر بر اساس نام کاربری');
  assert(foundUser?.telegram_id === '99887766', 'صحت شناسه تلگرام کاربر');

  userRepo.delete(testUserId);
  assert(userRepo.findById(testUserId) === null, 'حذف کاربر تستی');

  // ۶. تست SettingsRepo & AuditRepo
  console.log('\n[6] تست SettingsRepo & AuditRepo:');
  settingsRepo.set('test_key', 'test_value_123');
  assert(settingsRepo.get('test_key') === 'test_value_123', 'ذخیره و بازیابی تنظیمات');

  const logEntry = auditRepo.log({
    actor_type: 'system',
    actor_id: 'tester',
    action: 'unit_test',
    entity: 'test_suite',
    entity_id: '1',
    meta_json: '{"ok":true}',
  });
  assert(logEntry.id !== undefined, 'ثبت رویداد ممیزی (Audit Log)');

  // ۷. تست پشتیبان‌گیری
  console.log('\n[7] تست پشتیبان‌گیری پایگاه داده (VACUUM INTO):');
  const backupFile = backupDatabase();
  assert(backupFile !== null, 'ایجاد نسخه پشتیبان از SQLite');

  console.log('\n✅ تمامی تست‌های واحد مخازن داده با موفقیت پاس شدند!');
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
