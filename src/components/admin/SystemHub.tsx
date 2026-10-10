// src/components/admin/SystemHub.tsx
// مرکز مدیریت یکپارچه پایش سلامت، نسخه‌های پشتیبان و مهاجرت به Supabase (فاز ۷)

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Server,
  Cloud,
  HardDrive,
  Copy,
  Check,
  Shield,
  Layers,
  Cpu,
  Clock,
  Sparkles,
} from 'lucide-react';
import { api } from '../../services/api';
import { AuthUser } from '../../types';

interface SystemHubProps {
  currentUser?: AuthUser | null;
}

export const SystemHub: React.FC<SystemHubProps> = ({ currentUser }) => {
  const [subTab, setSubTab] = useState<'health' | 'backups' | 'migration' | 'audit'>('health');
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // ۱. داده‌های سلامت سیستم
  const [healthData, setHealthData] = useState<any>(null);

  // ۲. داده‌های بک‌آپ
  const [backups, setBackups] = useState<any[]>([]);
  const [integrityResult, setIntegrityResult] = useState<any>(null);

  // ۳. داده‌های مهاجرت Supabase
  const [supabaseSql, setSupabaseSql] = useState<string>('');
  const [copiedSql, setCopiedSql] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [connectionTestResult, setConnectionTestResult] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);

  // ۴. داده‌های لاگ ممیزی
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditActorFilter, setAuditActorFilter] = useState<string>('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('');

  const isAdmin = currentUser?.role === 'admin';

  // لود اولیه اطلاعات بر اساس ساب‌تب
  const loadHealth = async () => {
    try {
      setIsLoading(true);
      const data = await api.getSystemHealth();
      setHealthData(data);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `خطا در دریافت وضعیت سلامت: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const loadBackups = async () => {
    try {
      setIsLoading(true);
      const list = await api.getBackups();
      setBackups(list);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `خطا در دریافت لیست پشتیبان‌ها: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const loadMigrationSql = async () => {
    try {
      setIsLoading(true);
      const sql = await api.getSupabaseSql();
      setSupabaseSql(sql);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `خطا در تولید اسکریپت SQL: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setIsLoading(true);
      const logs = await api.getAuditLogs({
        actor_type: auditActorFilter || undefined,
        action: auditActionFilter || undefined,
        limit: 100,
      });
      setAuditLogs(logs);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: `خطا در دریافت لاگ‌های ممیزی: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'health') loadHealth();
    else if (subTab === 'backups') loadBackups();
    else if (subTab === 'migration') loadMigrationSql();
    else if (subTab === 'audit') loadAuditLogs();
  }, [subTab, auditActorFilter, auditActionFilter]);

  // عملیات ایجاد پشتیبان
  const handleCreateBackup = async () => {
    try {
      setIsLoading(true);
      const res = await api.createBackup();
      if (res.success) {
        setActionMessage({ type: 'success', text: 'نسخه پشتیبان اتمیک دیتابیس با موفقیت ایجاد شد.' });
        loadBackups();
      } else {
        setActionMessage({ type: 'error', text: res.error || 'خطا در ایجاد پشتیبان' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // بررسی یکپارچگی دیتابیس
  const handleCheckIntegrity = async () => {
    try {
      setIsLoading(true);
      const res = await api.checkDatabaseIntegrity();
      setIntegrityResult(res);
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'آزمون یکپارچگی پایگاه داده (PRAGMA integrity_check) کاملاً تایید شد.' });
      } else {
        setActionMessage({ type: 'error', text: 'خطا در یکپارچگی داده‌ها شناسایی گردید.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // حذف پشتیبان
  const handleDeleteBackup = async (filename: string) => {
    if (!window.confirm(`آیا از حذف نسخه پشتیبان «${filename}» مطمئن هستید؟`)) return;
    try {
      const res = await api.deleteBackup(filename);
      if (res.success) {
        setActionMessage({ type: 'success', text: 'نسخه پشتیبان حذف شد.' });
        loadBackups();
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  // پاکسازی سیستم
  const handleRunCleanup = async () => {
    if (!window.confirm('آیا از اجرای عملیات بهینه‌سازی و پاکسازی استیجینگ منقضی و لاگ‌های قدیمی مطمئن هستید؟')) return;
    try {
      setIsLoading(true);
      const res = await api.runSystemCleanup();
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `پاکسازی انجام شد: ${res.cleanedStagingFiles} فایل استیجینگ و ${res.cleanedAuditLogs} لاگ قدیمی پاکسازی گردید.`,
        });
        loadHealth();
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // کپی اسکریپت SQL
  const handleCopySql = () => {
    if (!supabaseSql) return;
    navigator.clipboard.writeText(supabaseSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // تست ارتباط با Supabase
  const handleTestConnection = async () => {
    try {
      setIsLoading(true);
      const res = await api.testSupabaseConnection({
        projectUrl: supabaseUrl || undefined,
        apiKey: supabaseKey || undefined,
      });
      setConnectionTestResult(res);
    } catch (err: any) {
      setConnectionTestResult({ reachable: false, error: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  // همگام‌سازی زنده به Supabase
  const handleSyncSupabase = async () => {
    if (!window.confirm('آیا از ارسال و ادغام رکوردهای دیتابیس در پروژه Supabase مطمئن هستید؟')) return;
    try {
      setIsLoading(true);
      const res = await api.syncSupabase({
        projectUrl: supabaseUrl || undefined,
        apiKey: supabaseKey || undefined,
      });
      setSyncResult(res);
      if (res.success) {
        setActionMessage({ type: 'success', text: 'همگام‌سازی با Supabase با موفقیت به پایان رسید.' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* هدر ماژول */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-100">
              مرکز پایش سلامت، پشتیبان‌گیری و مهاجرت ابری (فاز ۷)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 pr-11">
            مشاهده رخدادهای زنده سیستم، ایجاد پشتیبان‌های اتمیک SQLite، تولید اسکریپت آماده مهاجرت به Supabase و ممیزی رویدادها.
          </p>
        </div>

        {/* ساب‌تب‌ها */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs shrink-0 overflow-x-auto">
          <button
            onClick={() => setSubTab('health')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              subTab === 'health' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>پایش سلامت سیستم</span>
          </button>
          <button
            onClick={() => setSubTab('backups')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              subTab === 'backups' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>پشتیبان‌گیری و بازیابی</span>
          </button>
          <button
            onClick={() => setSubTab('migration')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
              subTab === 'migration' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>مهاجرت به Supabase</span>
          </button>
          {isAdmin && (
            <button
              onClick={() => setSubTab('audit')}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                subTab === 'audit' ? 'bg-emerald-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>لاگ‌های ممیزی</span>
            </button>
          )}
        </div>
      </div>

      {/* پیام بازخورد */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
              : actionMessage.type === 'error'
              ? 'bg-rose-950/70 border-rose-500/40 text-rose-300'
              : 'bg-sky-950/70 border-sky-500/40 text-sky-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* بخش ۱: پایش سلامت سیستم */}
      {subTab === 'health' && (
        <div className="space-y-6">
          {/* کارت‌های خلاصه وضعیت */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-1">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>زمان پایداری (Uptime)</span>
              </span>
              <div className="text-sm font-bold text-slate-200">
                {healthData?.system?.uptimeFormatted || 'در حال دریافت...'}
              </div>
            </div>

            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-1">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                <span>مصرف رم (Heap / RSS)</span>
              </span>
              <div className="text-sm font-bold font-mono text-emerald-400">
                {healthData?.system?.processMemory
                  ? `${healthData.system.processMemory.heapUsedMb} MB / ${healthData.system.processMemory.rssMb} MB`
                  : '...'}
              </div>
            </div>

            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-1">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                <span>حجم دیتابیس SQLite</span>
              </span>
              <div className="text-sm font-bold font-mono text-amber-400">
                {healthData?.database?.dbSizeFormatted || '...'}
              </div>
            </div>

            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 space-y-1">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>پوشه استیجینگ محلی</span>
              </span>
              <div className="text-sm font-bold font-mono text-indigo-400">
                {healthData?.staging ? `${healthData.staging.filesCount} فایل (${healthData.staging.sizeMb} MB)` : '...'}
              </div>
            </div>
          </div>

          {/* جزئیات وضعیت دیتابیس و اتصالات ابری */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* وضعیت پایگاه داده */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-bold text-slate-100">وضعیت پایگاه داده مستقل (SQLite WAL)</h4>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold">
                  {healthData?.database?.integrityOk ? 'سالم و یکپارچه' : 'نیازمند بررسی'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 block mb-1">قطعات منتشر شده:</span>
                  <span className="text-base font-bold font-mono text-emerald-400">
                    {healthData?.database?.stats?.publishedCount ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 block mb-1">در صف بررسی (Pending):</span>
                  <span className="text-base font-bold font-mono text-amber-400">
                    {healthData?.database?.stats?.pendingCount ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 block mb-1">تعداد مداحان:</span>
                  <span className="text-base font-bold font-mono text-slate-200">
                    {healthData?.database?.stats?.recitersCount ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80">
                  <span className="text-slate-400 block mb-1">منابع فعال:</span>
                  <span className="text-base font-bold font-mono text-slate-200">
                    {healthData?.database?.stats?.sourcesCount ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* وضعیت اتصالات ابری و ربات */}
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-sky-400" />
                  <h4 className="text-sm font-bold text-slate-100">فضای ابری ابر آروان (S3) و ربات</h4>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                    healthData?.arvan?.isConfigured
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                  }`}
                >
                  {healthData?.arvan?.isConfigured ? 'کلیدهای S3 متصل' : 'حالت لوکال / شبیه‌ساز'}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400">باکت ذخیره‌سازی آروان:</span>
                  <span className="font-mono text-slate-200">{healthData?.arvan?.bucket || 'madahi-media-vault'}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400">دامنه CDN آروان:</span>
                  <span className="font-mono text-slate-200">{healthData?.arvan?.cdnDomain || 'تنظیم نشده (پیش‌فرض S3)'}</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400">ربات تلگرام:</span>
                  <span className={`font-semibold ${healthData?.telegram?.isBotConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {healthData?.telegram?.isBotConfigured ? `فعال (${healthData.telegram.targetChannel})` : 'توکن ثبت نشده'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* دکمه‌های کنترل و پاکسازی */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={loadHealth}
                disabled={isLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>بروزرسانی شاخص‌ها</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleRunCleanup}
                  disabled={isLoading}
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>اجرای پاکسازی استیجینگ و لاگ‌های قدیمی</span>
                </button>
              )}
            </div>

            <span className="text-[11px] text-slate-500">
              زمان‌بند سیستم به صورت خودکار هر ۲۴ ساعت پاکسازی استیجینگ و بهینه‌سازی دیتابیس را انجام می‌دهد.
            </span>
          </div>
        </div>
      )}

      {/* بخش ۲: پشتیبان‌گیری و بازیابی */}
      {subTab === 'backups' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>مدیریت نسخه‌های پشتیبان دیتابیس (Atomic SQLite Backups)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  پشتیبان‌گیری اتمیک با دستور ایمن <code className="text-emerald-400 font-mono">VACUUM INTO</code> بدون قفل‌شدگی در حالت WAL.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleCreateBackup}
                    disabled={isLoading}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ایجاد پشتیبان جدید</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCheckIntegrity}
                  disabled={isLoading}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>آزمون یکپارچگی (Integrity Check)</span>
                </button>
              </div>
            </div>

            {/* نتیجه آزمون سلامت */}
            {integrityResult && (
              <div
                className={`p-3.5 rounded-xl text-xs space-y-1 border ${
                  integrityResult.ok
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  {integrityResult.ok ? '✅ نتیجه آزمون یکپارچگی: کاملاً سالم' : '❌ خطای یکپارچگی'}
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  PRAGMA integrity_check: {integrityResult.integrityCheck} | quick_check: {integrityResult.quickCheck} | foreign_keys: {integrityResult.foreignKeyCheck}
                </div>
              </div>
            )}

            {/* جدول بک‌آپ‌ها */}
            {backups.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                هنوز نسخه پشتیبانی ساخته نشده است. با زدن دکمه بالا اولین نسخه پشتیبان را ایجاد کنید.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3">نام فایل</th>
                      <th className="py-2.5 px-3">فرمت</th>
                      <th className="py-2.5 px-3">حجم</th>
                      <th className="py-2.5 px-3">تاریخ ایجاد</th>
                      <th className="py-2.5 px-3 text-left">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {backups.map((b) => (
                      <tr key={b.filename} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-slate-200">{b.filename}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              b.type === 'sqlite'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            }`}
                          >
                            {b.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{b.sizeFormatted}</td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {new Date(b.createdAt).toLocaleString('fa-IR')}
                        </td>
                        <td className="py-2.5 px-3 text-left">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`/api/admin/backups/${encodeURIComponent(b.filename)}/download`}
                              download={b.filename}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              <span>دانلود</span>
                            </a>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteBackup(b.filename)}
                                className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                                title="حذف"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* بخش ۳: مهاجرت به Supabase */}
      {subTab === 'migration' && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-sky-400" />
                  <span>اسکریپت و ابزار مهاجرت پایگاه داده به Supabase / PostgreSQL</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  تولید شده به صورت خودکار از تمامی ساختارها، ایندکس‌ها، قوانین RLS و رکوردهای موجود SQLite در سامانه.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySql}
                  disabled={!supabaseSql}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'کپی شد!' : 'کپی اسکریپت SQL'}</span>
                </button>

                <a
                  href="/api/admin/migration/supabase-sql?download=true"
                  className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود فایل .sql</span>
                </a>
              </div>
            </div>

            {/* کادر اسکریپت SQL */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">
                پیش‌نمایش اسکریپت SQL تولید شده:
              </label>
              <textarea
                dir="ltr"
                rows={12}
                readOnly
                value={supabaseSql || 'در حال تولید اسکریپت...'}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 focus:outline-none select-all"
              />
            </div>

            {/* فرم تست و همگام‌سازی مستقیم با Supabase REST API */}
            {isAdmin && (
              <div className="pt-4 border-t border-slate-800 space-y-4">
                <h5 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>همگام‌سازی مستقیم داده‌ها با پروژه Supabase شما (Live Sync):</span>
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">آدرس پروژه (SUPABASE_URL):</label>
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="https://your-project.supabase.co"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">کلید سرویس (SUPABASE_SERVICE_ROLE_KEY):</label>
                    <input
                      type="password"
                      dir="ltr"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isLoading}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    تست اتصال به سرور Supabase
                  </button>

                  <button
                    type="button"
                    onClick={handleSyncSupabase}
                    disabled={isLoading || !supabaseUrl}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    همگام‌سازی و درج داده‌ها
                  </button>
                </div>

                {connectionTestResult && (
                  <div
                    className={`p-3 rounded-xl text-xs ${
                      connectionTestResult.reachable
                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {connectionTestResult.reachable
                      ? `✅ اتصال موفقیت‌آمیز بود (${connectionTestResult.latencyMs}ms)`
                      : `❌ خطا در برقراری ارتباط: ${connectionTestResult.error}`}
                  </div>
                )}

                {syncResult && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                    <span className="font-bold text-slate-200 block">نتیجه همگام‌سازی:</span>
                    <div className="grid grid-cols-3 gap-2 font-mono text-slate-300">
                      <span>مداحان: {syncResult.syncedCounts?.reciters}</span>
                      <span>دسته‌ها: {syncResult.syncedCounts?.categories}</span>
                      <span>قطعات: {syncResult.syncedCounts?.tracks}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* بخش ۴: لاگ‌های ممیزی */}
      {subTab === 'audit' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>لاگ رویدادها و ممیزی سیستم (Audit Logs)</span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  رهگیری تمامی فعالیت‌های مدیران، ربات تلگرام و تسک‌های پس‌زمینه.
                </p>
              </div>

              {/* فیلترها */}
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={auditActorFilter}
                  onChange={(e) => setAuditActorFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none"
                >
                  <option value="">همه کنشگران</option>
                  <option value="web">وب (Web)</option>
                  <option value="bot">ربات (Bot)</option>
                  <option value="worker">ورکر (Worker)</option>
                  <option value="system">سیستم (System)</option>
                </select>

                <input
                  type="text"
                  placeholder="جستجوی عملیات..."
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 focus:outline-none w-36"
                />

                <button
                  onClick={loadAuditLogs}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* جدول لاگ‌ها */}
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
                هیچ رویدادی مطابق با فیلتر یافت نشد.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 sticky top-0 bg-slate-900">
                      <th className="py-2 px-3">زمان</th>
                      <th className="py-2 px-3">کنشگر</th>
                      <th className="py-2 px-3">عملیات</th>
                      <th className="py-2 px-3">موجودیت</th>
                      <th className="py-2 px-3">جزئیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 text-slate-400 font-sans text-[11px]">
                          {new Date(log.at).toLocaleString('fa-IR')}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.actor_type === 'web'
                                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                                : log.actor_type === 'bot'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                : log.actor_type === 'worker'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {log.actor_type} {log.actor_id ? `(${log.actor_id})` : ''}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-emerald-400 font-semibold">{log.action}</td>
                        <td className="py-2 px-3 text-slate-300">{log.entity}</td>
                        <td className="py-2 px-3 text-[11px] text-slate-400 truncate max-w-xs" title={log.meta_json}>
                          {log.meta_json}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
