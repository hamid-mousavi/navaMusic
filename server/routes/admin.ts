// server/routes/admin.ts
// مسیرهای مدیریت و کنترل دسترسی بر پایه نقش‌ها (RBAC)

import { Router } from 'express';
import fs from 'fs';
import { z } from 'zod';
import { authService, hashPassword } from '../services/authService.js';
import { candidateService } from '../services/candidateService.js';
import { storageService } from '../services/storageService.js';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth.js';
import {
  trackRepo,
  sourceRepo,
  scanJobRepo,
  reciterRepo,
  categoryRepo,
  userRepo,
  auditRepo,
  settingsRepo,
  takedownRepo,
} from '../db/repos/index.js';
import { scheduler } from '../scheduler/index.js';
import { localDb } from '../db.js';

const router = Router();

// ==========================================
// ۱. احراز هویت (Auth)
// ==========================================

const loginSchema = z.object({
  username: z.string().min(1, 'نام کاربری الزامی است'),
  password: z.string().min(1, 'کلمه عبور الزامی است'),
});

router.post('/auth/login', async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message || 'اطلاعات ورودی نامعتبر است.',
      });
    }

    const { username, password } = parseResult.data;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

    const loginResult = await authService.login(username, password, clientIp);
    if (!loginResult) {
      return res.status(401).json({
        success: false,
        error: 'نام کاربری یا کلمه عبور نادرست است.',
      });
    }

    // تنظیم کوکی httpOnly و امن
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('nava_session', loginResult.token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // ۷ روز
    });

    res.json({
      success: true,
      user: loginResult.user,
      token: loginResult.token,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/auth/logout', (req: AuthenticatedRequest, res) => {
  const token =
    req.cookies?.nava_session ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : undefined);
  if (token) {
    authService.logout(token, req.user?.userId);
  }
  res.clearCookie('nava_session');
  res.json({ success: true, message: 'خروج با موفقیت انجام شد.' });
});

router.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'احراز هویت نشده است.' });
  }

  const user = userRepo.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ success: false, error: 'کاربر یافت نشد.' });
  }

  const { password_hash, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// ==========================================
// ۲. مدیریت کاندیدها و صف بررسی (Candidates)
// ==========================================

router.get('/candidates', requireRole('reviewer'), (req, res) => {
  try {
    const statusParam = req.query.status as any;
    const candidates = trackRepo.listCandidates(statusParam);
    res.json({ success: true, candidates });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/candidates/:id', requireRole('reviewer'), (req, res) => {
  const track = trackRepo.findById(req.params.id);
  if (!track) return res.status(404).json({ success: false, error: 'کاندید یافت نشد.' });
  res.json({ success: true, track });
});

// مسیر پیش‌نمایش استریم صوت از استیجینگ با Range Header
router.get('/candidates/:id/preview', (req, res) => {
  const track = trackRepo.findById(req.params.id);
  if (!track) return res.status(404).json({ success: false, error: 'کاندید یافت نشد.' });

  if (track.staging_path && fs.existsSync(track.staging_path)) {
    storageService.streamStagingFile(track.staging_path, req, res);
  } else if (track.audio_url) {
    res.redirect(track.audio_url);
  } else {
    res.status(404).json({ success: false, error: 'فایل صوتی جهت پیش‌نمایش یافت نشد.' });
  }
});

router.patch('/candidates/:id', requireRole('reviewer'), (req: AuthenticatedRequest, res) => {
  try {
    const updated = trackRepo.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'کاندید یافت نشد.' });

    auditRepo.log({
      actor_type: 'web',
      actor_id: req.user?.userId || null,
      action: 'candidate_edited',
      entity: 'tracks',
      entity_id: req.params.id,
      meta_json: JSON.stringify(req.body),
    });

    res.json({ success: true, track: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/candidates/:id/approve', requireRole('reviewer'), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await candidateService.approve(req.params.id, {
      ...req.body,
      actor: req.user?.username || 'reviewer',
    });
    res.json({ success: true, track: updated, message: 'اثر با موفقیت تأیید و منتشر شد.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/candidates/:id/reject', requireRole('reviewer'), async (req: AuthenticatedRequest, res) => {
  try {
    const reason = req.body.reason || 'رد توسط مدیر';
    const updated = await candidateService.reject(
      req.params.id,
      reason,
      req.user?.username || 'reviewer'
    );
    res.json({ success: true, track: updated, message: 'کاندید با موفقیت رد شد.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/candidates/:id/retry-upload', requireRole('reviewer'), async (req: AuthenticatedRequest, res) => {
  try {
    const updated = await candidateService.retryUpload(
      req.params.id,
      req.user?.username || 'reviewer'
    );
    res.json({ success: true, track: updated, message: 'فرآیند تلاش مجدد آپلود با موفقیت انجام شد.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// ۳. مدیریت منابع (Sources)
// ==========================================

router.get('/sources', requireRole('reviewer'), (req, res) => {
  res.json({ success: true, sources: sourceRepo.findAll() });
});

router.post('/sources', requireRole('admin'), (req: AuthenticatedRequest, res) => {
  try {
    const { type, ref, title, schedule, auto_publish, default_reciter_id, default_category_id, filters } = req.body;
    if (!type || !ref || !title) {
      return res.status(400).json({ success: false, error: 'نوع، مرجع و عنوان منبع الزامی است.' });
    }

    const newSource = sourceRepo.create({
      id: `src-${Date.now()}`,
      type,
      ref,
      title,
      schedule: schedule || 'daily',
      enabled: 1,
      auto_publish: auto_publish ? 1 : 0,
      default_reciter_id: default_reciter_id || null,
      default_category_id: default_category_id || null,
      filters_json: JSON.stringify(filters || {}),
      last_run_at: null,
      last_status: 'ready',
      created_at: new Date().toISOString(),
    });

    auditRepo.log({
      actor_type: 'web',
      actor_id: req.user?.userId || null,
      action: 'source_created',
      entity: 'sources',
      entity_id: newSource.id,
      meta_json: JSON.stringify({ title, type }),
    });

    res.json({ success: true, source: newSource });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/sources/:id', requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const updated = sourceRepo.update(req.params.id, req.body);
  if (!updated) return res.status(404).json({ success: false, error: 'منبع یافت نشد.' });
  res.json({ success: true, source: updated });
});

router.delete('/sources/:id', requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const ok = sourceRepo.delete(req.params.id);
  auditRepo.log({
    actor_type: 'web',
    actor_id: req.user?.userId || null,
    action: 'source_deleted',
    entity: 'sources',
    entity_id: req.params.id,
    meta_json: '{}',
  });
  res.json({ success: ok, message: ok ? 'منبع حذف شد.' : 'منبع یافت نشد.' });
});

router.post('/sources/:id/scan', requireRole('admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const job = await scheduler.scanSource(req.params.id, 'manual');
    res.json({ success: true, job, message: 'اسکن منبع با موفقیت آغاز شد.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/scan-all', requireRole('admin'), async (req: AuthenticatedRequest, res) => {
  try {
    scheduler.scanAllDue().catch((e) => console.error('[Admin] Scan all error:', e));
    res.json({ success: true, message: 'فرآیند اسکن تمامی منابع سررسید شده در پس‌زمینه آغاز گردید.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/jobs', requireRole('reviewer'), (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  res.json({ success: true, jobs: scanJobRepo.findAll(limit) });
});

// ==========================================
// ۴. مدیریت کاربران و دسترسی‌ها (Users - فقط Admin)
// ==========================================

router.get('/users', requireRole('admin'), (req, res) => {
  res.json({ success: true, users: userRepo.findAll() });
});

router.post('/users', requireRole('admin'), (req: AuthenticatedRequest, res) => {
  try {
    const { username, password, role, telegram_id } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'نام کاربری و کلمه عبور الزامی است.' });
    }

    const existing = userRepo.findByUsername(username.trim());
    if (existing) {
      return res.status(409).json({ success: false, error: 'این نام کاربری قبلاً ثبت شده است.' });
    }

    const newUser = userRepo.create({
      id: `user-${Date.now()}`,
      username: username.trim(),
      password_hash: hashPassword(password),
      role: role === 'admin' ? 'admin' : 'reviewer',
      telegram_id: telegram_id ? String(telegram_id).trim() : null,
      active: 1,
      created_at: new Date().toISOString(),
    });

    auditRepo.log({
      actor_type: 'web',
      actor_id: req.user?.userId || null,
      action: 'user_created',
      entity: 'users',
      entity_id: newUser.id,
      meta_json: JSON.stringify({ username: newUser.username, role: newUser.role }),
    });

    const { password_hash, ...safeUser } = newUser;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/users/:id', requireRole('admin'), (req: AuthenticatedRequest, res) => {
  try {
    const updates: any = { ...req.body };
    if (updates.password) {
      updates.password_hash = hashPassword(updates.password);
      delete updates.password;
    }

    const updated = userRepo.update(req.params.id, updates);
    if (!updated) return res.status(404).json({ success: false, error: 'کاربر یافت نشد.' });

    const { password_hash, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/users/:id', requireRole('admin'), (req: AuthenticatedRequest, res) => {
  if (req.user?.userId === req.params.id) {
    return res.status(400).json({ success: false, error: 'امکان حذف کاربر جاری وجود ندارد.' });
  }

  const ok = userRepo.delete(req.params.id);
  res.json({ success: ok, message: ok ? 'کاربر حذف شد.' : 'کاربر یافت نشد.' });
});

// ==========================================
// ۵. لاگ ممیزی و وضعیت سلامت (Audit & Health)
// ==========================================

router.get('/audit', requireRole('admin'), (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  res.json({ success: true, logs: auditRepo.listRecent(limit) });
});

router.get('/health', requireRole('reviewer'), (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    publishedTracksCount: trackRepo.listPublished().total,
    pendingCandidatesCount: trackRepo.countByStatus('pending'),
  });
});

// ==========================================
// ۶. مدیریت درخواست‌های حذف اثر (Takedowns)
// ==========================================

router.get('/takedowns', requireRole('reviewer'), (req, res) => {
  res.json({ success: true, requests: takedownRepo.findAll(100) });
});

router.post('/takedowns/:id/resolve', requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const reqObj = takedownRepo.findById(req.params.id);
  if (!reqObj) return res.status(404).json({ success: false, error: 'درخواست یافت نشد.' });

  takedownRepo.updateStatus(req.params.id, 'resolved');
  auditRepo.log({
    actor_type: 'web',
    actor_id: req.user?.userId || null,
    action: 'takedown_resolved',
    entity: 'takedowns',
    entity_id: req.params.id,
    meta_json: JSON.stringify({ trackId: reqObj.track_id }),
  });

  res.json({ success: true, message: 'درخواست حذف اثر تأیید و مختومه شد.' });
});

router.post('/takedowns/:id/reject', requireRole('admin'), (req: AuthenticatedRequest, res) => {
  takedownRepo.updateStatus(req.params.id, 'rejected');
  res.json({ success: true, message: 'درخواست رد گردید.' });
});

export default router;
