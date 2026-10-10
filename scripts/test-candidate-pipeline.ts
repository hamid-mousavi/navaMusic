// scripts/test-candidate-pipeline.ts
// تست‌های خودکار خط لوله استیجینگ و صف کاندیدها (Phase 3 Staging Pipeline Tests)

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { candidateService } from '../server/services/candidateService.js';
import { storageService } from '../server/services/storageService.js';
import { trackRepo } from '../server/db/repos/index.js';

const execFileAsync = promisify(execFile);
const BASE_URL = 'http://localhost:3000';

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`❌ FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runCandidatePipelineTests() {
  console.log('==> اجرای تست‌های خط لوله استیجینگ و بررسی کاندیدها (Phase 3 Pipeline)...');

  // ۱. ساخت یک فایل صوتی تستی با ffmpeg
  const sampleAudioPath = path.join(process.cwd(), 'data', 'test_sample.mp3');
  console.log('\n[1] ساخت فایل صوتی تستی با ffmpeg:');
  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'anullsrc=r=44100:cl=stereo',
    '-t',
    '2',
    '-acodec',
    'libmp3lame',
    '-b:a',
    '320k',
    sampleAudioPath,
  ]);
  assert(fs.existsSync(sampleAudioPath), 'فایل صوتی تستی ۲ ثانیه‌ای ساخته شد');

  // ۲. تست ورود به استیجینگ (Ingest Pipeline)
  console.log('\n[2] تست Ingest: ذخیره در Staging و ثبت در صف کاندیدها:');
  const candidate = await candidateService.ingest({
    localFilePath: sampleAudioPath,
    title: 'نوای آزمایشی استیجینگ',
    sourceType: 'manual_upload',
    sourceExternalId: `test-ext-${Date.now()}`,
    actor: 'test_suite',
  });

  assert(candidate !== null, 'کاندید با موفقیت ایجاد شد');
  assert(candidate.status === 'pending', 'وضعیت اولیه اثر pending است');
  assert(candidate.duration >= 1, `مدت زمان فایل محاسبه شد: ${candidate.duration} ثانیه`);
  assert(candidate.content_hash !== null, 'هش محتوا (SHA-256) محاسبه شد');
  assert(candidate.staging_path !== null, 'مسیر staging ثبت شد');
  assert(fs.existsSync(candidate.staging_path!), 'فایل استیجینگ روی دیسک سرور موجود است');

  // ۳. تست ضد تکرار (Deduplication)
  console.log('\n[3] تست ضد تکرار بر اساس هش محتوا:');
  const duplicateCandidate = await candidateService.ingest({
    localFilePath: sampleAudioPath,
    title: 'تکرار نوای آزمایشی',
    sourceType: 'manual_upload',
  });
  assert(duplicateCandidate.id === candidate.id, 'فایل تکراری شناسایی شد و رکورد تکراری ایجاد نگردید');

  // ۴. تست استریم پیش‌نمایش صوتی با Range Header (HTTP 206)
  console.log('\n[4] تست استریم پیش‌نمایش از Staging (HTTP 206 Range):');
  const previewRes = await fetch(`${BASE_URL}/api/admin/candidates/${candidate.id}/preview`, {
    headers: { Range: 'bytes=0-1024' },
  });
  assert(
    previewRes.status === 206 || previewRes.status === 200,
    `پیش‌نمایش صوتی استریم شد (Status: ${previewRes.status})`
  );

  // ۵. تست فرآیند آپلود یا مدیریت خطای قطع S3 (انتقال به upload_failed در صورت عدم کانفیگ کلیدها)
  console.log('\n[5] تست فرآیند آپلود و تغییر وضعیت به upload_failed در نبود کلید آروان:');
  try {
    await candidateService.approve(candidate.id, { actor: 'tester' });
  } catch (err: any) {
    // چون در محیط تست کلیدهای ابر آروان ست نیستند، باید به upload_failed برود و فایل استیجینگ حفظ شود
    const failedCandidate = trackRepo.findById(candidate.id);
    assert(
      failedCandidate?.status === 'upload_failed',
      'در صورت خطای S3 وضعیت به upload_failed تغییر می‌کند'
    );
    assert(
      fs.existsSync(failedCandidate?.staging_path!),
      'فایل استیجینگ جهت تلاش مجدد (Retry) روی دیسک حفظ شد'
    );
  }

  // ۶. تست رد کاندید و حذف فایل از دیسک
  console.log('\n[6] تست رد کاندید (Reject) و پاکسازی فایل از Staging:');
  const stagingFileToVerify = candidate.staging_path!;
  const rejectedTrack = await candidateService.reject(candidate.id, 'تست رد کاندید', 'tester');
  assert(rejectedTrack.status === 'rejected', 'وضعیت اثر به rejected تغییر یافت');
  assert(
    !fs.existsSync(stagingFileToVerify),
    'فایل استیجینگ پس از رد شدن از دیسک پاک شد'
  );

  // ۷. تست سرویس پاکسازی فایل‌های منقضی استیجینگ
  console.log('\n[7] تست متد پاکسازی فایل‌های منقضی استیجینگ:');
  const cleaned = storageService.cleanupExpiredStaging(30);
  assert(typeof cleaned === 'number', 'متد پاکسازی با موفقیت اجرا شد');

  // پاک‌سازی فایل تستی اولیه و رکورد دیتابیس
  if (fs.existsSync(sampleAudioPath)) {
    fs.unlinkSync(sampleAudioPath);
  }
  trackRepo.delete(candidate.id);

  console.log('\n✅ تمامی تست‌های خط لوله استیجینگ و صف کاندیدها (فاز ۳) با موفقیت پاس شدند!');
}

runCandidatePipelineTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
