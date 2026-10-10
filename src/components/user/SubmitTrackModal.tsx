// src/components/user/SubmitTrackModal.tsx
// مدال عمومی پیشنهاد و ارسال اثر صوتی توسط مخاطبان سامانه

import React, { useState } from 'react';
import { UploadCloud, X, CheckCircle2, AlertCircle, Music, User, Tag } from 'lucide-react';
import { Category, Reciter } from '../../types';

interface SubmitTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  reciters: Reciter[];
}

export const SubmitTrackModal: React.FC<SubmitTrackModalProps> = ({
  isOpen,
  onClose,
  categories,
  reciters,
}) => {
  const [title, setTitle] = useState('');
  const [reciterName, setReciterName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('لطفاً فایل صوتی مورد نظر را انتخاب نمایید.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('title', title.trim());
    if (reciterName.trim()) formData.append('reciterName', reciterName.trim());
    if (categoryId) formData.append('categoryId', categoryId);

    try {
      const res = await fetch('/api/public/submit', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message || 'اثر شما با موفقیت دریافت شد و پس از بررسی منتشر خواهد گردید.');
        setTitle('');
        setReciterName('');
        setFile(null);
      } else {
        setErrorMessage(data.error || 'خطا در ارسال اثر.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'خطای شبکه در ارسال فایل.');
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
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">پیشنهاد و ارسال اثر جدید</h3>
              <p className="text-xs text-slate-400">مشارکت در تکمیل گنجینه نوای آسمانی</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notices */}
        {successMessage ? (
          <div className="p-6 text-center space-y-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-emerald-300">با سپاس از همکاری و نیت خیر شما</h4>
            <p className="text-xs text-slate-300 leading-relaxed">{successMessage}</p>
            <button
              onClick={() => {
                setSuccessMessage(null);
                onClose();
              }}
              className="px-4 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded-xl mt-2"
            >
              بستن پنجره
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                عنوان قطعه یا نام فراز دعا <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: زیارت وارث یا روضه شب عاشورا"
                  className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                />
                <Music className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">نام مداح یا قاری</label>
                <div className="relative">
                  <input
                    type="text"
                    value={reciterName}
                    onChange={(e) => setReciterName(e.target.value)}
                    placeholder="مثال: میثم مطیعی"
                    className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                  <User className="w-4 h-4 absolute right-3 top-2.5 text-slate-500" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">دسته‌بندی یا مناسبت</label>
                <div className="relative">
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">انتخاب دسته (اختیاری)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Tag className="w-4 h-4 absolute right-3 top-2.5 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                فایل صوتی (MP3 / M4A) <span className="text-rose-400">*</span>
              </label>
              <input
                type="file"
                required
                accept="audio/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-400 file:mr-0 file:ml-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 bg-slate-950 border border-slate-800 rounded-xl p-1.5"
              />
              <p className="text-[10px] text-slate-500 mt-1">حداکثر حجم مجاز: ۵۰ مگابایت</p>
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
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {submitting ? 'در حال ارسال فایل...' : 'ارسال اثر برای بررسی'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
