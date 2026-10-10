// scripts/test-phase6.ts
// تست‌های خودکار فاز ۶ (ثبت درخواست حذف اثر، ارسال اثر عمومی و PWA)

import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { takedownRepo, trackRepo } from '../server/db/repos/index.js';

const execFileAsync = promisify(execFile);
const BASE_URL = 'http://localhost:3000';

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`❌ FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase6Tests() {
  console.log('==> اجرای تست‌های جامع فاز ۶ (Phase 6 Acceptance Tests)...');

  // ۱. ساخت قطعه واقعی جهت تست کلید خارجی takedown_requests
  const sampleTrack = trackRepo.create({
    id: `track-dmca-${Date.now()}`,
    title: 'نوای آزمایشی برای گزارش',
    duration: 100,
    status: 'published',
    created_at: new Date().toISOString(),
  } as any);

  // تست ثبت درخواست حذف اثر (DMCA / Takedown Request)
  console.log('\n[1] تست درخواست حذف اثر (DMCA / Takedown):');
  const takedownRes = await fetch(`${BASE_URL}/api/public/takedown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackId: sampleTrack.id,
      requesterName: 'وارث اثر',
      requesterEmail: 'owner@madahi.ir',
      reason: 'عدم رضایت در انتشار عمومی قطعه',
    }),
  });

  assert(takedownRes.status === 200, 'ثبت موفق درخواست حذف اثر -> ۲۰۰');
  const takedownData = await takedownRes.json();
  assert(takedownData.success === true, 'تاییدیه موفقیت درخواست');
  assert(takedownData.requestId !== undefined, 'دریافت شناسه درخواست حذف');

  const createdRequest = takedownRepo.findById(takedownData.requestId);
  assert(createdRequest !== null, 'درخواست در جدول takedown_requests ذخیره شد');
  assert(createdRequest?.status === 'pending', 'وضعیت اولیه درخواست pending است');

  // ۲. تست ورود به پنل ادمین و حل/مختومه‌سازی درخواست
  console.log('\n[2] تست رسیدگی ادمین به درخواست حذف:');
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  const loginData = await loginRes.json();
  const adminToken = loginData.token;

  const adminListRes = await fetch(`${BASE_URL}/api/admin/takedowns`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminListRes.status === 200, 'دسترسی ادمین به فهرست درخواست‌های حذف');

  const resolveRes = await fetch(`${BASE_URL}/api/admin/takedowns/${takedownData.requestId}/resolve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(resolveRes.status === 200, 'تأیید و مختومه‌سازی درخواست حذف توسط ادمین');

  const updatedReq = takedownRepo.findById(takedownData.requestId);
  assert(updatedReq?.status === 'resolved', 'وضعیت درخواست به resolved تغییر کرد');

  // ۳. تست ارسال اثر پیشنهادی توسط مخاطب عمومی (/api/public/submit)
  console.log('\n[3] تست ارسال اثر پیشنهادی توسط مخاطبان عمومی:');
  const sampleAudio = path.join(process.cwd(), 'data', 'public_sample.mp3');
  await execFileAsync('ffmpeg', [
    '-y',
    '-f',
    'lavfi',
    '-i',
    'anullsrc=r=44100:cl=stereo',
    '-t',
    '1',
    '-acodec',
    'libmp3lame',
    sampleAudio,
  ]);

  const fileBuffer = fs.readFileSync(sampleAudio);
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const postData = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\nنوای ارسالی مخاطب\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="reciterName"\r\n\r\nمداح افتخاری\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="audio.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const submitRes = await fetch(`${BASE_URL}/api/public/submit`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: postData,
  });

  assert(submitRes.status === 200, 'ارسال موفق اثر توسط کاربر عمومی -> ۲۰۰');
  const submitData = await submitRes.json();
  assert(submitData.success === true, 'تایید دریافت اثر');
  assert(submitData.candidateId !== undefined, 'تولید شناسه کاندید برای اثر ارسالی');

  const createdCandidate = trackRepo.findById(submitData.candidateId);
  assert(createdCandidate !== null, 'کاندید ارسالی در جدول tracks ثبت شد');
  assert(createdCandidate?.status === 'pending', 'وضعیت اثر ارسالی pending است');
  assert(createdCandidate?.source_type === 'user_submission', 'منبع اثر user_submission است');

  // پاک‌سازی فایل نمونه و اثر تستی
  if (fs.existsSync(sampleAudio)) fs.unlinkSync(sampleAudio);
  if (createdCandidate) trackRepo.delete(createdCandidate.id);
  trackRepo.delete(sampleTrack.id);

  // ۴. تست استانداردهای PWA (Manifest & Service Worker)
  console.log('\n[4] تست استانداردهای PWA:');
  const manifestRes = await fetch(`${BASE_URL}/manifest.json`);
  assert(manifestRes.status === 200, 'دریافت فایل manifest.json -> ۲۰۰');
  const manifestJson = await manifestRes.json();
  assert(manifestJson.start_url === '/', 'صحت start_url در manifest');
  assert(manifestJson.theme_color === '#0b0f19', 'صحت theme_color در manifest');

  const swRes = await fetch(`${BASE_URL}/sw.js`);
  assert(swRes.status === 200, 'دریافت فایل سرویس ورکر sw.js -> ۲۰۰');

  console.log('\n✅ تمامی تست‌های فاز ۶ با موفقیت پاس شدند!');
}

runPhase6Tests().catch((e) => {
  console.error(e);
  process.exit(1);
});
