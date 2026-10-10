// src/components/admin/TakedownManager.tsx
// مدیریت درخواست‌های حذف اثر و کپی‌رایت توسط مدیران سامانه

import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Trash2, Clock, Mail, User, AlertCircle } from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';

interface TakedownRequest {
  id: string;
  track_id: string;
  requester_name: string;
  requester_email: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'rejected';
  created_at: string;
}

export const TakedownManager: React.FC = () => {
  const [requests, setRequests] = useState<TakedownRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchTakedowns = async () => {
    try {
      const res = await fetch('/api/admin/takedowns');
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchTakedowns();
  }, []);

  const handleResolve = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/takedowns/${id}/resolve`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setFeedback('درخواست حذف اثر تأیید و مختومه شد.');
        fetchTakedowns();
      }
    } catch (_) {}
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/takedowns/${id}/reject`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setFeedback('درخواست حذف رد شد.');
        fetchTakedowns();
      }
    } catch (_) {}
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold text-white">درخواست‌های حذف اثر (DMCA / Takedowns)</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {toPersianDigits(requests.length)} درخواست
          </span>
        </div>

        {requests.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <CheckCircle className="w-8 h-8 text-slate-600 mx-auto" />
            <p>هیچ درخواست حذف اثری ثبت نشده است.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                  <th className="p-3">شناسه اثر</th>
                  <th className="p-3">درخواست‌دهنده</th>
                  <th className="p-3">ایمیل / تماس</th>
                  <th className="p-3">علت درخواست</th>
                  <th className="p-3">وضعیت</th>
                  <th className="p-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/20">
                    <td className="p-3 font-mono text-slate-300 font-semibold">{r.track_id}</td>
                    <td className="p-3 text-slate-200">{r.requester_name || '—'}</td>
                    <td className="p-3 font-mono text-slate-400">{r.requester_email || '—'}</td>
                    <td className="p-3 text-slate-300 max-w-xs">{r.reason}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.status === 'resolved'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : r.status === 'rejected'
                            ? 'bg-slate-800 text-slate-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {r.status === 'resolved'
                          ? 'مختومه شده'
                          : r.status === 'rejected'
                          ? 'رد شده'
                          : 'در انتظار بررسی'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {r.status === 'pending' && (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleResolve(r.id)}
                            className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg text-[11px]"
                          >
                            تأیید حذف
                          </button>
                          <button
                            onClick={() => handleReject(r.id)}
                            className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg text-[11px]"
                          >
                            رد درخواست
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
