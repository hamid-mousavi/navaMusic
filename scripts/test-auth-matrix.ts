// scripts/test-auth-matrix.ts
// تست ماتریس نقش‌ها و احراز هویت بر اساس معیارهای پذیرش فاز ۲

import { userRepo } from '../server/db/repos/index.js';
import { hashPassword } from '../server/services/authService.js';

const BASE_URL = 'http://localhost:3000';

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`❌ FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runAuthMatrixTests() {
  console.log('==> اجرای تست ماتریس نقش‌ها و احراز هویت (RBAC Matrix Tests)...');

  // ۱. درخواست‌های بدون نشست باید ۴۰۱ بدهند
  console.log('\n[1] تست عدم دسترسی بدون نشست (۴۰۱):');
  const resNoAuthCandidates = await fetch(`${BASE_URL}/api/admin/candidates`);
  assert(resNoAuthCandidates.status === 401, 'دسترسی به کاندیدها بدون نشست -> ۴۰۱');

  const resNoAuthSources = await fetch(`${BASE_URL}/api/admin/sources`);
  assert(resNoAuthSources.status === 401, 'دسترسی به منابع بدون نشست -> ۴۰۱');

  const resNoAuthUsers = await fetch(`${BASE_URL}/api/admin/users`);
  assert(resNoAuthUsers.status === 401, 'دسترسی به کاربران بدون نشست -> ۴۰۱');

  // ۲. تست ورود با رمز عبور اشتباه
  console.log('\n[2] تست ورود با اطلاعات نادرست:');
  const badLogin = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrong_password_test' }),
  });
  assert(badLogin.status === 401, 'رد درخواست ورود با رمز اشتباه -> ۴۰۱');

  // ۳. ورود ادمین اصلی
  console.log('\n[3] تست ورود موفق Admin:');
  const adminLoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  assert(adminLoginRes.status === 200, 'ورود موفق ادمین -> ۲۰۰');
  const adminLoginData = await adminLoginRes.json();
  assert(adminLoginData.success === true, 'دریافت موفقیت ورود');
  assert(adminLoginData.token !== undefined, 'دریافت توکن نشست ادمین');
  assert(adminLoginData.user.password_hash === undefined, 'عدم افشای فیلد رمز عبور در پاسخ (No Secret Leak)');
  const adminToken = adminLoginData.token;

  // ۴. ساخت کاربر با نقش Reviewer برای تست تفکیک دسترسی
  console.log('\n[4] ساخت و ورود کاربر با نقش Reviewer:');
  const reviewerUsername = `reviewer_${Date.now()}`;
  const reviewerUser = userRepo.create({
    id: `user-rev-${Date.now()}`,
    username: reviewerUsername,
    password_hash: hashPassword('reviewer123'),
    role: 'reviewer',
    telegram_id: null,
    active: 1,
    created_at: new Date().toISOString(),
  });

  const revLoginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: reviewerUsername, password: 'reviewer123' }),
  });
  const revLoginData = await revLoginRes.json();
  assert(revLoginData.success === true, 'ورود موفق کاربر Reviewer');
  const reviewerToken = revLoginData.token;

  // ۵. دسترسی Reviewer به بخش کاندیدها (مجاز است)
  console.log('\n[5] بررسی دسترسی Reviewer به کاندیدها:');
  const revCandidatesRes = await fetch(`${BASE_URL}/api/admin/candidates`, {
    headers: { Authorization: `Bearer ${reviewerToken}` },
  });
  assert(revCandidatesRes.status === 200, 'Reviewer به کاندیدها دسترسی دارد -> ۲۰۰');

  // ۶. جلوگیری از ساخت منبع توسط Reviewer (باید ۴۰۳ بدهد)
  console.log('\n[6] بررسی محدودیت دسترسی Reviewer به ایجاد منبع (۴۰۳):');
  const revCreateSourceRes = await fetch(`${BASE_URL}/api/admin/sources`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${reviewerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'youtube_channel',
      ref: '@test_unauth',
      title: 'منبع غیرمجاز',
    }),
  });
  assert(revCreateSourceRes.status === 403, 'Reviewer نمی‌تواند منبع جدید بسازد -> ۴۰۳ Forbidden');

  // ۷. جلوگیری از دسترسی Reviewer به لیست کاربران
  console.log('\n[7] بررسی عدم دسترسی Reviewer به فهرست کاربران (۴۰۳):');
  const revUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${reviewerToken}` },
  });
  assert(revUsersRes.status === 403, 'Reviewer به فهرست کاربران دسترسی ندارد -> ۴۰۳ Forbidden');

  // ۸. ادمین می‌تواند منبع بسازد و کاربران را مدیریت کند
  console.log('\n[8] بررسی دسترسی کامل Admin:');
  const adminCreateSourceRes = await fetch(`${BASE_URL}/api/admin/sources`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'youtube_channel',
      ref: `@auth_test_${Date.now()}`,
      title: 'منبع تست ادمین',
    }),
  });
  assert(adminCreateSourceRes.status === 200, 'Admin می‌تواند منبع ایجاد کند -> ۲۰۰');

  const adminUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(adminUsersRes.status === 200, 'Admin به فهرست کاربران دسترسی دارد -> ۲۰۰');

  // ۹. تست خروج و ابطال نشست
  console.log('\n[9] تست خروج و ابطال توکن:');
  await fetch(`${BASE_URL}/api/admin/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${reviewerToken}` },
  });
  const revMeAfterLogout = await fetch(`${BASE_URL}/api/admin/auth/me`, {
    headers: { Authorization: `Bearer ${reviewerToken}` },
  });
  assert(revMeAfterLogout.status === 401, 'پس از خروج توکن منقضی است -> ۴۰۱');

  // پاک‌سازی کاربر تستی
  userRepo.delete(reviewerUser.id);

  console.log('\n✅ تمامی تست‌های ماتریس نقش‌ها و احراز هویت با موفقیت پاس شدند!');
}

runAuthMatrixTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
