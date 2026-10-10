// src/components/admin/UserManager.tsx
// مدیریت کاربران سامانه، سطوح دسترسی (RBAC) و نگاشت Telegram ID

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Shield, Eye, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { AuthUser } from '../../types';
import { TakedownManager } from './TakedownManager';

interface UserManagerProps {
  currentUser: AuthUser;
}

export const UserManager: React.FC<UserManagerProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New user form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'reviewer'>('reviewer');
  const [telegramId, setTelegramId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'خطا در بارگذاری فهرست کاربران');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser.role === 'admin') {
      fetchUsers();
    }
  }, [currentUser]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      await api.createUser({
        username,
        password,
        role,
        telegram_id: telegramId || undefined,
      });
      setSuccess(`کاربر «${username}» با نقش «${role === 'admin' ? 'مدیر' : 'بررسی‌کننده'}» ایجاد شد.`);
      setUsername('');
      setPassword('');
      setTelegramId('');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'خطا در ایجاد کاربر');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`آیا از حذف کاربر «${name}» اطمینان دارید؟`)) return;
    try {
      await api.deleteUser(id);
      setSuccess(`کاربر «${name}» حذف گردید.`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'خطا در حذف کاربر');
    }
  };

  if (currentUser.role !== 'admin') {
    return (
      <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center gap-3">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <span>بخش مدیریت کاربران منحصراً برای مدیران اصلی (Admin) مجاز است. نقش شما: «بررسی‌کننده (Reviewer)».</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Notices */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-sm text-rose-300">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-sm text-emerald-300">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{success}</span>
        </div>
      )}

      {/* Grid: Create User Form + Existing Users List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form: Create User */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <UserPlus className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">افزودن کاربر جدید</h3>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-3.5">
            <div>
              <label className="text-xs text-slate-400 block mb-1">نام کاربری</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: reviewer1"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">کلمه عبور</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">نقش کاربری</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="reviewer">بررسی‌کننده (Reviewer - تأیید/رد و بررسی)</option>
                <option value="admin">مدیر کل (Admin - دسترسی نامحدود)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">شناسه عددی تلگرام (اختیاری جهت ربات)</label>
              <input
                type="text"
                value={telegramId}
                onChange={(e) => setTelegramId(e.target.value)}
                placeholder="مثال: 123456789"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? 'در حال ثبت...' : 'ثبت کاربر'}
            </button>
          </form>
        </div>

        {/* Table: Users List */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">فهرست کاربران و نگاشت دسترسی‌ها</h3>
            </div>
            <span className="text-xs text-slate-400">{users.length} کاربر ثبت شده</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-2.5">نام کاربری</th>
                  <th className="pb-2.5">نقش</th>
                  <th className="pb-2.5">شناسه تلگرام</th>
                  <th className="pb-2.5">تاریخ عضویت</th>
                  <th className="pb-2.5 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/20">
                    <td className="py-3 font-medium text-slate-200 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                        {u.role === 'admin' ? (
                          <Shield className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                      </div>
                      <span>{u.username}</span>
                      {u.id === currentUser.id && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                          (شما)
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          u.role === 'admin'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        {u.role === 'admin' ? 'مدیر اصلی (Admin)' : 'بررسی‌کننده (Reviewer)'}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-slate-400">
                      {u.telegram_id ? (
                        <span className="flex items-center gap-1 text-sky-400">
                          <Send className="w-3 h-3" />
                          <span>{u.telegram_id}</span>
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 text-slate-400 text-[11px]">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('fa-IR') : '—'}
                    </td>
                    <td className="py-3 text-center">
                      {u.id !== currentUser.id && (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          title="حذف کاربر"
                          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* بخش مدیریت درخواست‌های حذف اثر */}
      <TakedownManager />
    </div>
  );
};
