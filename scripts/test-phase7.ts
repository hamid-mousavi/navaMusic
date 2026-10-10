// scripts/test-phase7.ts
// تست‌های خودکار فاز ۷ (مهاجرت به Supabase/Postgres، پشتیبان‌گیری اتمیک، پایش سلامت سیستم و ممیزی)

import fs from 'fs';
import path from 'path';
import { migrationService } from '../server/services/migrationService.js';
import { backupService } from '../server/services/backupService.js';
import { systemHealthService } from '../server/services/systemHealthService.js';

const BASE_URL = 'http://localhost:3000';

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`❌ FAILED: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase7Tests() {
  console.log('==> اجرای تست‌های جامع فاز ۷ (Phase 7 Acceptance Tests)...');

  // ۱. ورود به سیستم به عنوان ادمین
  console.log('\n[1] احراز هویت ادمین جهت تست دسترسی به ابزارهای فاز ۷:');
  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  assert(loginRes.status === 200, 'ورود ادمین موفقیت‌آمیز بود');
  const loginData = await loginRes.json();
  const adminToken = loginData.token;
  assert(!!adminToken, 'دریافت توکن معتبر ادمین');

  // ۲. بررسی حفاظت مسیرها در برابر کاربران احراز هویت نشده
  console.log('\n[2] بررسی امنیت و کنترل دسترسی (RBAC):');
  const unauthRes = await fetch(`${BASE_URL}/api/admin/system/health`);
  assert(unauthRes.status === 401, 'درخواست بدون توکن به /api/admin/system/health -> ۴۰۱');

  const unauthBackupRes = await fetch(`${BASE_URL}/api/admin/backups`, { method: 'POST' });
  assert(unauthBackupRes.status === 401, 'درخواست بدون توکن به ایجاد پشتیبان -> ۴۰۱');

  // ۳. تست موتور مهاجرت به Supabase / PostgreSQL
  console.log('\n[3] تست موتور مهاجرت به Supabase و PostgreSQL (Migration Engine):');
  const sqlDump = migrationService.generateSupabaseSqlDump();
  assert(typeof sqlDump === 'string' && sqlDump.length > 500, 'تولید رشته معتبر SQL مهاجرت');
  assert(sqlDump.includes('CREATE TABLE IF NOT EXISTS public.tracks'), 'حاوی ساخت جدول tracks');
  assert(sqlDump.includes('CREATE TABLE IF NOT EXISTS public.reciters'), 'حاوی ساخت جدول reciters');
  assert(sqlDump.includes('CREATE TABLE IF NOT EXISTS public.categories'), 'حاوی ساخت جدول categories');
  assert(sqlDump.includes('CREATE TABLE IF NOT EXISTS public.sources'), 'حاوی ساخت جدول sources');
  assert(sqlDump.includes('ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;'), 'حاوی فعال‌سازی RLS');
  assert(sqlDump.includes('CREATE POLICY "Public can view published tracks"'), 'حاوی سیاست‌های امنیتی RLS');
  assert(sqlDump.includes('INSERT INTO public.'), 'حاوی دستورات درج زنده داده‌های فعلی (DML)');

  // تست اندپوینت مهاجرت ادمین
  const migrationRes = await fetch(`${BASE_URL}/api/admin/migration/supabase-sql`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(migrationRes.status === 200, 'دریافت اسکریپت SQL از طریق API -> ۲۰۰');
  const migrationData = await migrationRes.json();
  assert(migrationData.success === true, 'تایید تولید اسکریپت در API');
  assert(migrationData.sql.length > 500, 'طول اسکریپت معتبر است');

  // تست دانلود اسکریپت با Content-Disposition
  const downloadSqlRes = await fetch(`${BASE_URL}/api/admin/migration/supabase-sql?download=true`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(downloadSqlRes.status === 200, 'درخواست دانلود فایل اسکریپت -> ۲۰۰');
  assert(
    (downloadSqlRes.headers.get('content-disposition') || '').includes('attachment; filename='),
    'سربرگ Content-Disposition برای دانلود پیوست تنظیم شده است'
  );

  // ۴. تست سیستم پشتیبان‌گیری اتمیک (Backup & Restore)
  console.log('\n[4] تست پشتیبان‌گیری اتمیک و مدیریت بک‌آپ:');
  const createBackupRes = await fetch(`${BASE_URL}/api/admin/backups`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(createBackupRes.status === 200, 'ایجاد نسخه پشتیبان اتمیک از طریق API -> ۲۰۰');
  const backupData = await createBackupRes.json();
  assert(backupData.success === true, 'تاییدیه ساخت نسخه پشتیبان');
  assert(backupData.sqliteBackup && backupData.sqliteBackup.filename.endsWith('.db'), 'تولید فایل پشتیبان باینری SQLite (.db)');
  assert(backupData.jsonBackup && backupData.jsonBackup.filename.endsWith('.json'), 'تولید فایل پشتیبان ساخت‌یافته JSON (.json)');

  // بررسی وجود فیزیکی فایل‌ها روی دیسک
  assert(fs.existsSync(backupData.sqliteBackup.path), 'فایل فیزیکی باینری .db روی دیسک ذخیره شد');
  assert(fs.existsSync(backupData.jsonBackup.path), 'فایل فیزیکی .json روی دیسک ذخیره شد');

  // تست فهرست‌گیری از بک‌آپ‌ها
  const listBackupRes = await fetch(`${BASE_URL}/api/admin/backups`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(listBackupRes.status === 200, 'دریافت فهرست بک‌آپ‌ها -> ۲۰۰');
  const listData = await listBackupRes.json();
  assert(Array.isArray(listData.backups) && listData.backups.length >= 2, 'حداقل دو فایل پشتیبان در فهرست موجود است');

  // تست دانلود فایل بک‌آپ
  const dlBackupRes = await fetch(`${BASE_URL}/api/admin/backups/${backupData.sqliteBackup.filename}/download`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(dlBackupRes.status === 200, 'دانلود موفق فایل پشتیبان باینری -> ۲۰۰');

  // تست آزمون سلامت و یکپارچگی پایگاه داده
  const integrityRes = await fetch(`${BASE_URL}/api/admin/backups/integrity-check`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(integrityRes.status === 200, 'اجرای آزمون سلامت پایگاه داده -> ۲۰۰');
  const integrityData = await integrityRes.json();
  assert(integrityData.ok === true, 'سلامت و یکپارچگی SQLite تایید شد (PRAGMA integrity_check = ok)');

  // ۵. تست رصد و مانیتورینگ سلامت جامع سامانه (Observability & Health)
  console.log('\n[5] تست رصد سلامت و منابع سیستم:');
  const healthRes = await fetch(`${BASE_URL}/api/admin/system/health`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(healthRes.status === 200, 'دریافت وضعیت جامع سلامت سیستم -> ۲۰۰');
  const health = await healthRes.json();
  assert(health.status === 'healthy', 'وضعیت کلی سیستم healthy است');
  assert(health.system && health.system.uptimeSeconds >= 0, 'زمان پایداری پروسه گزارش شد');
  assert(health.system.processMemory && health.system.processMemory.heapUsedMb, 'مصرف حافظه رم گزارش شد');
  assert(health.database && health.database.integrityOk === true, 'یکپارچگی دیتابیس در گزارش سلامت تایید شد');
  assert(health.database.stats && health.database.stats.publishedCount !== undefined, 'آمار قطعات منتشر شده در سلامت موجود است');
  assert(health.staging && health.staging.path, 'مسیر و حجم پوشه استیجینگ گزارش شد');
  assert(health.arvan && health.arvan.bucket, 'اطلاعات باکت ابر آروان در سلامت سیستم منعکس شد');

  // تست پاکسازی سراسری سیستم
  const cleanupRes = await fetch(`${BASE_URL}/api/admin/system/cleanup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ stagingTtlDays: 7, auditRetentionDays: 60 }),
  });
  assert(cleanupRes.status === 200, 'اجرای عملیات پاکسازی سیستم -> ۲۰۰');
  const cleanupData = await cleanupRes.json();
  assert(cleanupData.success === true, 'موفقیت‌آمیز بودن پاکسازی سیستم');
  assert(cleanupData.databaseOptimized === true, 'اجرای موفق بهینه‌سازی PRAGMA optimize');

  // ۶. تست لاگ‌های ممیزی و فیلتر
  console.log('\n[6] تست لاگ‌های ممیزی (Audit Logging & Filtering):');
  const auditRes = await fetch(`${BASE_URL}/api/admin/audit?actor_type=web&limit=20`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(auditRes.status === 200, 'فیلتر لاگ‌های ممیزی وب -> ۲۰۰');
  const auditData = await auditRes.json();
  assert(Array.isArray(auditData.logs), 'دریافت آرایه لاگ‌های ممیزی');
  const hasBackupAudit = auditData.logs.some((l: any) => l.action === 'database_backup_created');
  assert(hasBackupAudit, 'عملیات ساخت بک‌آپ در لاگ ممیزی ثبت شد');

  // پاک‌سازی فایل‌های پشتیبان ساخته شده در این تست
  backupService.deleteBackup(backupData.sqliteBackup.filename, 'test_cleanup');
  backupService.deleteBackup(backupData.jsonBackup.filename, 'test_cleanup');

  console.log('\n✅ تمامی تست‌های فاز ۷ با موفقیت پاس شدند!');
}

runPhase7Tests().catch((e) => {
  console.error(e);
  process.exit(1);
});
