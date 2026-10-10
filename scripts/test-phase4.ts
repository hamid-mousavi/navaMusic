// scripts/test-phase4.ts
// تست‌های خودکار فاز ۴ (حفاظت ضد SSRF، وب‌سرویس داخلی، زمان‌بند و منابع)

import fs from 'fs';
import path from 'path';
import { isPrivateIp, validateSafeUrl } from '../server/adapters/ssrf.js';
import { sourceService } from '../server/services/sourceService.js';
import { scanJobRepo, sourceRepo, trackRepo } from '../server/db/repos/index.js';
import { scheduler } from '../server/scheduler/index.js';

const BASE_URL = 'http://localhost:3000';
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || 'nava_internal_worker_secret_2026';

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`❌ FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase4Tests() {
  console.log('==> اجرای تست‌های جامع فاز ۴ (Phase 4 Acceptance Tests)...');

  // ۱. تست حفاظت ضد SSRF
  console.log('\n[1] تست حفاظت ضد SSRF:');
  assert(isPrivateIp('127.0.0.1'), 'تشخیص 127.0.0.1 به عنوان IP خصوصی');
  assert(isPrivateIp('10.0.0.5'), 'تشخیص 10.0.0.5 به عنوان IP خصوصی');
  assert(isPrivateIp('192.168.1.1'), 'تشخیص 192.168.1.1 به عنوان IP خصوصی');
  assert(isPrivateIp('172.16.0.1'), 'تشخیص 172.16.0.1 به عنوان IP خصوصی');
  assert(isPrivateIp('169.254.169.254'), 'تشخیص آدرس متادیتای ابری به عنوان IP خصوصی');
  assert(!isPrivateIp('8.8.8.8'), 'تشخیص 8.8.8.8 به عنوان IP عمومی');

  let ssrfBlocked = false;
  try {
    await validateSafeUrl('http://127.0.0.1:8080/test');
  } catch (err: any) {
    ssrfBlocked = true;
  }
  assert(ssrfBlocked, 'مسدودسازی درخواست به 127.0.0.1 توسط validateSafeUrl');

  let localhostBlocked = false;
  try {
    await validateSafeUrl('http://localhost:3000/api');
  } catch (err: any) {
    localhostBlocked = true;
  }
  assert(localhostBlocked, 'مسدودسازی درخواست به localhost توسط validateSafeUrl');

  // ۲. تست امنیت وب‌سرویس داخلی (/api/internal/*)
  console.log('\n[2] تست امنیت وب‌سرویس داخلی ورکرها:');
  const resNoToken = await fetch(`${BASE_URL}/api/internal/sources`);
  assert(resNoToken.status === 401, 'درخواست بدون هدر توکن داخلی -> ۴۰۱');

  const resBadToken = await fetch(`${BASE_URL}/api/internal/sources`, {
    headers: { Authorization: 'Bearer bad_token_xyz' },
  });
  assert(resBadToken.status === 401, 'درخواست با توکن نامعتبر -> ۴۰۱');

  // موقتاً توکن تستی را ست می‌کنیم
  process.env.INTERNAL_API_TOKEN = INTERNAL_TOKEN;

  // ۳. تست سرویس مدیریت منابع (SourceService)
  console.log('\n[3] تست CRUD و زمان‌بندی منابع:');
  const testSource = sourceService.createSource({
    type: 'web_url',
    ref: 'https://example.com/audio.mp3',
    title: 'منبع تستی وب',
    schedule: 'every_6h',
    auto_publish: false,
    actor: 'test_phase4',
  });
  assert(testSource.id !== undefined, 'ساخت منبع با موفقیت انجام شد');

  const retrieved = sourceService.getSource(testSource.id);
  assert(retrieved?.title === 'منبع تستی وب', 'بازیابی اطلاعات منبع');

  const dueSources = sourceService.getDueSources();
  assert(Array.isArray(dueSources), 'استخراج منابع سررسید شده');

  // ۴. تست ثبت و گزارش جاب توسط وب‌سرویس داخلی
  console.log('\n[4] تست گزارش جاب ورکر (/api/internal/jobs/report):');
  const reportRes = await fetch(`${BASE_URL}/api/internal/jobs/report`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${INTERNAL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sourceId: testSource.id,
      status: 'done',
      found: 5,
      newCount: 2,
    }),
  });
  assert(reportRes.status === 200, 'ثبت گزارش اتمام جاب توسط ورکر -> ۲۰۰');
  const reportData = await reportRes.json();
  assert(reportData.job.new_count === 2, 'صحت تعداد رکوردهای جدید ثبت شده در جاب');

  // ۵. پاک‌سازی منبع تستی
  sourceService.deleteSource(testSource.id);
  assert(sourceService.getSource(testSource.id) === null, 'حذف منبع تستی');

  console.log('\n✅ تمامی تست‌های فاز ۴ با موفقیت پاس شدند!');
}

runPhase4Tests().catch((e) => {
  console.error(e);
  process.exit(1);
});
