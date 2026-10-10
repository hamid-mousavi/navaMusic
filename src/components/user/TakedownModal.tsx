// src/components/user/TakedownModal.tsx
// مدال رسمی درخواست حذف اثر (DMCA / Takedown Request)

import React, { useState } from 'react';
import { ShieldAlert, X, CheckCircle2, AlertCircle, Mail, User, FileText } from 'lucide-react';
import { Track } from '../../types';

interface TakedownModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTrack?: Track | null;
}

export const TakedownModal: React.FC<TakedownModalProps> = ({
  isOpen,
  onClose,
  selectedTrack,
}) => {
  const [trackId, setTrackId] = useState(selectedTrack?.id || '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/public/takedown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: selectedTrack?.id || trackId,
          requesterName: name.trim(),
          requesterEmail: email.trim(),
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(data.message || 'درخواست شما با موفقیت ثبت شد و توسط مدیران بررسی خواهد شد.');
        setReason('');
      } else {
        setError(data.error || 'خطا در ثبت درخواست');
      }
    } catch (err: any) {
      setError(err.message || 'خطای شبکه در ثبت درخواست');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">درخواست حذف اثر (DMCA / گزارش تخلف)</h3>
              <p className="text-xs text-slate-400">احترام به حقوق مادی و معنوی صاحبان آثار</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {selectedTrack && (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
            <span className="text-slate-500 block text-[10px]">اثر مورد نظر جهت حذف:</span>
            <span className="font-bold text-white">{selectedTrack.title}</span> -{' '}
            <span>{selectedTrack.reciterName}</span>
          </div>
        )}

        {success ? (
          <div className="p-6 text-center space-y-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-emerald-300">درخواست شما دریافت شد</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{success}</p>
            <button
              onClick={() => {
                setSuccess(null);
                onClose();
              }}
              className="px-4 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl mt-2"
            >
              بستن پنجره
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {!selectedTrack && (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  شناسه یا عنوان دقیق اثر <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={trackId}
                  onChange={(e) => setTrackId(e.target.value)}
                  placeholder="مثال: track-123 یا نام قطعه"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">نام یا عنوان مالک اثر</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: روابط عمومی هیئت..."
                    className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                  <User className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">ایمیل یا شماره تماس پیگیری</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                  />
                  <Mail className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                دلیل درخواست حذف یا توضیح حقوقی <span className="text-rose-400">*</span>
              </label>
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="توضیح دهید که به چه دلیل تقاضای حذف این اثر را دارید (مالکیت اثر، درخواست مداح، و...)"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? 'در حال ثبت...' : 'ثبت درخواست حذف'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
