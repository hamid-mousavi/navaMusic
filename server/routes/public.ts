// server/routes/public.ts
// مسیرهای عمومی پلیر و دسترسی آزاد کاربران بدون نیاز به احراز هویت

import { Router } from 'express';
import multer from 'multer';
import { trackRepo, reciterRepo, categoryRepo, takedownRepo, auditRepo } from '../db/repos/index.js';
import { candidateService } from '../services/candidateService.js';
import { db } from '../db/index.js';

const router = Router();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // سقف ۵۰ مگابایت برای کاربران عمومی

// ۱. دریافت فهرست آثار منتشر شده با جستجو و فیلتر
router.get('/tracks', (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : undefined;
    const reciterId = typeof req.query.reciter === 'string' ? req.query.reciter : undefined;
    const categoryId = typeof req.query.category === 'string' ? req.query.category : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.page ? (parseInt(req.query.page as string, 10) - 1) * limit : 0;

    const result = trackRepo.listPublished({
      query,
      reciterId,
      categoryId,
      limit,
      offset,
    });

    const formattedTracks = result.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      reciterId: t.reciter_id,
      reciterName: t.reciter_name || 'نامشخص',
      categoryId: t.category_id,
      categoryName: t.category_name || 'عمومی',
      occasion: t.occasion,
      duration: t.duration,
      audioUrl: t.audio_url,
      coverUrl: t.cover_url,
      fileSizeMb: t.file_size,
      bitrate: t.bitrate,
      lyrics: JSON.parse(t.lyrics_json || '[]'),
      tags: JSON.parse(t.tags_json || '[]'),
      playCount: t.play_count,
      createdAt: t.created_at,
      status: 'approved',
    }));

    res.json({
      success: true,
      total: result.total,
      tracks: formattedTracks,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ۲. دریافت اطلاعات یک اثر خاص
router.get('/tracks/:id', (req, res) => {
  try {
    const track = trackRepo.findById(req.params.id);
    if (!track || track.status !== 'published') {
      return res.status(404).json({ success: false, error: 'اثر مورد نظر یافت نشد.' });
    }

    res.json({
      success: true,
      track: {
        id: track.id,
        title: track.title,
        reciterId: track.reciter_id,
        reciterName: track.reciter_name,
        categoryId: track.category_id,
        categoryName: track.category_name,
        occasion: track.occasion,
        duration: track.duration,
        audioUrl: track.audio_url,
        coverUrl: track.cover_url,
        fileSizeMb: track.file_size,
        bitrate: track.bitrate,
        lyrics: JSON.parse(track.lyrics_json || '[]'),
        tags: JSON.parse(track.tags_json || '[]'),
        playCount: track.play_count,
        createdAt: track.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ۳. فهرست مداحان
router.get('/reciters', (req, res) => {
  try {
    const reciters = reciterRepo.findAll().map((r) => ({
      id: r.id,
      name: r.name,
      title: r.title,
      bio: r.bio,
      avatarUrl: r.avatar_url,
      tracksCount: r.tracks_count,
      style: r.style,
      accentColor: r.accent_color,
    }));
    res.json({ success: true, reciters });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ۴. فهرست دسته‌بندی‌ها
router.get('/categories', (req, res) => {
  try {
    const categories = categoryRepo.findAll().map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      iconName: c.icon_name,
      tracksCount: c.tracks_count,
      description: c.description,
    }));
    res.json({ success: true, categories });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ۵. ثبت افزایش تعداد پخش اثر
router.post('/tracks/:id/play', (req, res) => {
  try {
    trackRepo.incrementPlayCount(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ۶. ثبت درخواست حذف اثر (DMCA / Takedown Request)
router.post('/takedown', (req, res) => {
  try {
    const { trackId, requesterName, requesterEmail, requesterContact, reason } = req.body;
    if (!trackId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'شناسه اثر و دلیل درخواست الزامی است.',
      });
    }

    const id = `td-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const email = requesterEmail || requesterContact || '';
    const name = requesterName || 'مخاطب عمومی';

    const request = takedownRepo.create({
      id,
      track_id: trackId,
      requester_name: name,
      requester_email: email,
      reason: reason.trim(),
      status: 'pending',
    });

    auditRepo.log({
      actor_type: 'web',
      actor_id: null,
      action: 'takedown_requested',
      entity: 'tracks',
      entity_id: trackId,
      meta_json: JSON.stringify({ requestId: id, requester: name, reason }),
    });

    res.json({
      success: true,
      requestId: id,
      message: 'درخواست حذف اثر ثبت شد و توسط مدیران بررسی خواهد گردید.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ۷. ارسال اثر پیشنهادی توسط مخاطبان عمومی (Public Submission)
router.post('/submit', upload.single('audio') as any, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: 'فایل صوتی جهت ارسال انتخاب نشده است.' });
    }

    const { title, reciterName, categoryId, note } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'عنوان اثر الزامی است.' });
    }

    const candidate = await candidateService.ingest({
      buffer: file.buffer,
      title: title.trim(),
      sourceType: 'user_submission',
      sourceOwnerName: reciterName || 'پیشنهاد کاربران',
      categoryId: categoryId || undefined,
      tags: ['پیشنهاد مخاطب'],
      actor: 'public_visitor',
    });

    res.json({
      success: true,
      candidateId: candidate.id,
      message: 'نوا با موفقیت دریافت شد و پس از بررسی در سامانه منتشر خواهد گردید. با سپاس از مشارکت شما.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
