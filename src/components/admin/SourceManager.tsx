// src/components/admin/SourceManager.tsx
// مدیریت یکپارچه منابع پایش (یوتیوب، تلگرام، وب و RSS) و تاریخچه جاب‌های اسکن

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Youtube,
  Send,
  Plus,
  RefreshCw,
  Play,
  Trash2,
  Edit3,
  CheckCircle,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  Layers,
} from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';
import { Reciter, Category, AuthUser } from '../../types';

interface Source {
  id: string;
  type: 'youtube_channel' | 'telegram_channel' | 'web_url';
  ref: string;
  title: string;
  schedule: 'manual' | 'every_6h' | 'daily';
  enabled: number;
  auto_publish: number;
  default_reciter_id: string | null;
  default_category_id: string | null;
  last_run_at: string | null;
  last_status: string | null;
  created_at: string;
}

interface ScanJob {
  id: string;
  source_id: string;
  trigger: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  found: number;
  new_count: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

interface SourceManagerProps {
  currentUser: AuthUser;
  reciters: Reciter[];
  categories: Category[];
}

export const SourceManager: React.FC<SourceManagerProps> = ({ currentUser, reciters, categories }) => {
  const [sources, setSources] = useState<Source[]>([]);
  const [jobs, setJobs] = useState<ScanJob[]>([]);
  const [activeTab, setActiveTab] = useState<'sources' | 'jobs'>('sources');
  const [loading, setLoading] = useState(false);
  const [scanningSourceId, setScanningSourceId] = useState<string | null>(null);
  const [scanningAll, setScanningAll] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [type, setType] = useState<'youtube_channel' | 'telegram_channel' | 'web_url'>('youtube_channel');
  const [refInput, setRefInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [schedule, setSchedule] = useState<'manual' | 'every_6h' | 'daily'>('daily');
  const [autoPublish, setAutoPublish] = useState(false);
  const [defaultReciterId, setDefaultReciterId] = useState('');
  const [defaultCategoryId, setDefaultCategoryId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSources = async () => {
    try {
      const res = await fetch('/api/admin/sources');
      const data = await res.json();
      if (data.success) {
        setSources(data.sources || []);
      }
    } catch (_) {}
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/admin/jobs?limit=30');
      const data = await res.json();
      if (data.success) {
        setJobs(data.jobs || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchSources();
    fetchJobs();
    const interval = setInterval(() => {
      fetchJobs();
      fetchSources();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleScanSource = async (id: string) => {
    setScanningSourceId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/sources/${id}/scan`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: 'اسکن منبع با موفقیت انجام شد و کاندیدهای جدید وارد صف شدند.', type: 'success' });
        fetchSources();
        fetchJobs();
      } else {
        setMessage({ text: data.error || 'خطا در اسکن منبع', type: 'error' });
      }
    } catch (e: any) {
      setMessage({ text: e.message || 'خطای ارتباط با سرور', type: 'error' });
    } finally {
      setScanningSourceId(null);
    }
  };

  const handleScanAll = async () => {
    setScanningAll(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/scan-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: 'فرآیند اسکن تمامی منابع سررسید شده در پس‌زمینه آغاز گردید.', type: 'success' });
        setTimeout(() => {
          fetchSources();
          fetchJobs();
        }, 3000);
      }
    } catch (e: any) {
      setMessage({ text: e.message || 'خطا در اجرای اسکن همگانی', type: 'error' });
    } finally {
      setScanningAll(false);
    }
  };

  const handleDeleteSource = async (id: string, title: string) => {
    if (!window.confirm(`آیا از حذف منبع «${title}» اطمینان دارید؟`)) return;
    try {
      const res = await fetch(`/api/admin/sources/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: `منبع «${title}» حذف گردید.`, type: 'success' });
        fetchSources();
      }
    } catch (e: any) {
      setMessage({ text: e.message || 'خطا در حذف منبع', type: 'error' });
    }
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          ref: refInput,
          title: titleInput,
          schedule,
          auto_publish: autoPublish,
          default_reciter_id: defaultReciterId || null,
          default_category_id: defaultCategoryId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: `منبع جدید «${titleInput}» با موفقیت افزوده شد.`, type: 'success' });
        setShowAddModal(false);
        setRefInput('');
        setTitleInput('');
        fetchSources();
      } else {
        setMessage({ text: data.error || 'خطا در ثبت منبع', type: 'error' });
      }
    } catch (e: any) {
      setMessage({ text: e.message || 'خطای سرور', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* پیام بازخورد */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 text-xs ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Header and Actions */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400" />
            <span>مدیریت یکپارچه منابع پایش و زمان‌بندی (Sources & Ingestion)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            پایش خودکار کانال‌های یوتیوب، تلگرام و آدرس‌های فید صوتی وب با فیلترهای ضد تکرار.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUser.role === 'admin' && (
            <>
              <button
                onClick={handleScanAll}
                disabled={scanningAll}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanningAll ? 'animate-spin' : ''}`} />
                <span>اسکن همه منابع</span>
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن منبع جدید</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-tabs: Sources vs Jobs History */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('sources')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'sources'
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>منابع ثبت شده ({toPersianDigits(sources.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'jobs'
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>تاریخچه اسکن‌ها و لاگ‌ها ({toPersianDigits(jobs.length)})</span>
        </button>
      </div>

      {/* Content: Sources Table */}
      {activeTab === 'sources' && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                  <th className="p-3.5">نوع</th>
                  <th className="p-3.5">عنوان منبع</th>
                  <th className="p-3.5">هندل / آدرس مرجع</th>
                  <th className="p-3.5">زمان‌بندی</th>
                  <th className="p-3.5">انتشار خودکار</th>
                  <th className="p-3.5">آخرین وضعیت</th>
                  <th className="p-3.5 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sources.map((src) => (
                  <tr key={src.id} className="hover:bg-slate-800/20">
                    <td className="p-3.5">
                      <span className="flex items-center gap-1.5">
                        {src.type === 'youtube_channel' && <Youtube className="w-4 h-4 text-rose-400" />}
                        {src.type === 'telegram_channel' && <Send className="w-4 h-4 text-sky-400" />}
                        {src.type === 'web_url' && <Globe className="w-4 h-4 text-emerald-400" />}
                        <span className="text-slate-300">
                          {src.type === 'youtube_channel' ? 'یوتیوب' : src.type === 'telegram_channel' ? 'تلگرام' : 'وب / RSS'}
                        </span>
                      </span>
                    </td>
                    <td className="p-3.5 font-semibold text-slate-100">{src.title}</td>
                    <td className="p-3.5 font-mono text-slate-400 truncate max-w-xs">{src.ref}</td>
                    <td className="p-3.5 text-slate-300">
                      {src.schedule === 'daily' ? 'روزانه' : src.schedule === 'every_6h' ? 'هر ۶ ساعت' : 'دستی'}
                    </td>
                    <td className="p-3.5">
                      {src.auto_publish ? (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                          بله (مستقیم)
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          خیر (صف بررسی)
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="text-[11px] text-slate-400 font-mono">
                        {src.last_status || 'آماده اسکن'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleScanSource(src.id)}
                          disabled={scanningSourceId === src.id}
                          title="اسکن فوری"
                          className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 transition-colors disabled:opacity-50"
                        >
                          <Play className={`w-3.5 h-3.5 ${scanningSourceId === src.id ? 'animate-spin' : ''}`} />
                        </button>
                        {currentUser.role === 'admin' && (
                          <button
                            onClick={() => handleDeleteSource(src.id, src.title)}
                            title="حذف منبع"
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
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
        </div>
      )}

      {/* Content: Scan Jobs History */}
      {activeTab === 'jobs' && (
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                  <th className="p-3.5">شناسه جاب</th>
                  <th className="p-3.5">محرک (Trigger)</th>
                  <th className="p-3.5">وضعیت</th>
                  <th className="p-3.5">یافت شده</th>
                  <th className="p-3.5">جدید (Ingested)</th>
                  <th className="p-3.5">زمان شروع</th>
                  <th className="p-3.5">توضیحات / خطا</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {jobs.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-800/20">
                    <td className="p-3.5 font-mono text-slate-400">{j.id}</td>
                    <td className="p-3.5 text-slate-300">
                      {j.trigger === 'scheduled' ? 'زمان‌بندی خودکار' : j.trigger === 'manual' ? 'دستی' : 'ربات تلگرام'}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          j.status === 'done'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : j.status === 'running'
                            ? 'bg-amber-500/10 text-amber-400 animate-pulse'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {j.status === 'done' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : j.status === 'running' ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span>{j.status}</span>
                      </span>
                    </td>
                    <td className="p-3.5 font-mono tabular-nums text-slate-300">{toPersianDigits(j.found)}</td>
                    <td className="p-3.5 font-mono tabular-nums text-emerald-400 font-bold">
                      {toPersianDigits(j.new_count)}
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px]">
                      {j.started_at ? new Date(j.started_at).toLocaleTimeString('fa-IR') : '—'}
                    </td>
                    <td className="p-3.5 text-slate-500 max-w-xs truncate">{j.error || 'عملیات موفق'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Add Source */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              <span>افزودن منبع پایش جدید</span>
            </h4>

            <form onSubmit={handleCreateSource} className="space-y-3.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">نوع منبع</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="youtube_channel">کانال یوتیوب</option>
                  <option value="telegram_channel">کانال تلگرام</option>
                  <option value="web_url">آدرس وب / فید پادکست RSS</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">عنوان منبع</label>
                <input
                  type="text"
                  required
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="مثال: کانال رسمی فطرس"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  {type === 'youtube_channel'
                    ? 'هندل یا شناسه کانال (مانند @Fotros_ir یا UC...)'
                    : type === 'telegram_channel'
                    ? 'نام کاربری کانال (مانند @madahi_channel)'
                    : 'آدرس URL یا لینک فید RSS'}
                </label>
                <input
                  type="text"
                  required
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  placeholder={type === 'youtube_channel' ? '@channel_handle' : type === 'telegram_channel' ? '@username' : 'https://example.com/feed.xml'}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">بازه زمان‌بندی</label>
                  <select
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="daily">روزانه (۲۴ ساعت)</option>
                    <option value="every_6h">هر ۶ ساعت</option>
                    <option value="manual">فقط دستی</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">دسته‌بندی پیش‌فرض</label>
                  <select
                    value={defaultCategoryId}
                    onChange={(e) => setDefaultCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">انتخاب دسته</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoPub"
                  checked={autoPublish}
                  onChange={(e) => setAutoPublish(e.target.checked)}
                  className="rounded border-slate-800 text-emerald-500 focus:ring-0"
                />
                <label htmlFor="autoPub" className="text-xs text-slate-300">
                  انتشار خودکار مستقیم (بدون نیاز به تأیید دستی در صف)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {submitting ? 'در حال ثبت...' : 'افزودن منبع'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
