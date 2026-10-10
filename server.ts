import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import cookieParser from 'cookie-parser';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { createServer as createViteServer } from 'vite';
import { localDb, Track as DbTrack } from './server/db.js';
import {
  testTelegramToken,
  sendChannelTestMessage,
  publishTrackToTelegramChannel,
} from './server/telegram.js';
import { youtubeMonitor } from './server/youtubeMonitor.js';
import { authService } from './server/services/authService.js';
import publicRoutes from './server/routes/public.js';
import adminRoutes from './server/routes/admin.js';

const execFileAsync = promisify(execFile);

dotenv.config();

// ایجاد ادمین اولیه در صورت نیاز (Bootstrap Admin)
authService.initBootstrapAdmin();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());
app.use(cookieParser());

// مسیرهای استاندارد تفکیک‌شده معماری جدید
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);

// In-memory buffer for uploaded files (up to 100MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Runtime configuration store for ArvanCloud S3
interface ArvanConfig {
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  region: string;
  cdnDomain: string;
}

// Data directory for persistent storage (e.g. YouTube cookies)
const DATA_DIR = path.join(process.cwd(), 'data');
const YOUTUBE_COOKIES_PATH = path.join(DATA_DIR, 'youtube_cookies.txt');

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (_) {}

// Locate yt-dlp binary (bundled local bin, system /usr/local/bin, or PATH)
const getYtDlpPath = (): string => {
  const localBin = path.join(process.cwd(), 'bin', 'yt-dlp');
  if (fs.existsSync(localBin)) {
    try {
      fs.chmodSync(localBin, 0o755);
    } catch (_) {}
    return localBin;
  }
  if (fs.existsSync('/usr/local/bin/yt-dlp')) {
    return '/usr/local/bin/yt-dlp';
  }
  return 'yt-dlp';
};

// Check if valid YouTube cookies are configured
const getYouTubeCookiesInfo = () => {
  if (fs.existsSync(YOUTUBE_COOKIES_PATH)) {
    try {
      const stat = fs.statSync(YOUTUBE_COOKIES_PATH);
      if (stat.size > 20) {
        const text = fs.readFileSync(YOUTUBE_COOKIES_PATH, 'utf8');
        const validLines = text
          .split('\n')
          .filter((l) => l.trim() && !l.trim().startsWith('#'));
        
        // Check if essential authentication cookies are present (LOGIN_INFO, __Secure-3PSID, SID, SAPISID)
        const hasAuthCookies = /LOGIN_INFO|__Secure-3PSID|__Secure-1PSID|\bSID\b|SAPISID/i.test(text);
        const hasLoginInfo = /LOGIN_INFO/i.test(text);

        return {
          configured: true,
          entryCount: validLines.length,
          sizeBytes: stat.size,
          lastModified: stat.mtime.toISOString(),
          hasAuthCookies,
          hasLoginInfo,
        };
      }
    } catch (_) {}
  }
  return {
    configured: false,
    entryCount: 0,
    sizeBytes: 0,
    lastModified: null,
    hasAuthCookies: false,
    hasLoginInfo: false,
  };
};

// Helpers to sanitize and normalize S3 parameters
const normalizeEndpoint = (raw?: string): string => {
  if (!raw) return 'https://s3.ir-thr-at1.arvanstorage.ir';
  let cleaned = raw.trim().replace(/^["'`]+|["'`]+$/g, '');
  if (!cleaned) return 'https://s3.ir-thr-at1.arvanstorage.ir';
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, '');
};

const normalizeCdnDomain = (raw?: string): string => {
  if (!raw) return '';
  let cleaned = raw.trim().replace(/^["'`]+|["'`]+$/g, '');
  if (!cleaned || cleaned.includes('yourdomain') || cleaned.includes('MY_ARVAN') || cleaned.includes('MY_CDN')) {
    return '';
  }
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, '');
};

const inferRegionFromEndpoint = (endpoint: string, explicitRegion?: string): string => {
  if (explicitRegion && explicitRegion.trim() && explicitRegion !== 'ir-thr-at1') {
    return explicitRegion.trim().replace(/^["'`]+|["'`]+$/g, '');
  }
  const match = endpoint.match(/s3\.([a-z0-9-]+)\.arvanstorage/i);
  if (match && match[1]) {
    return match[1];
  }
  return explicitRegion?.trim() || 'ir-central1';
};

const cleanCredential = (val?: string): string => {
  if (!val) return '';
  return val.trim().replace(/^["'`]+|["'`]+$/g, '');
};

const initialEndpoint = normalizeEndpoint(process.env.ARVAN_ENDPOINT);
const initialRegion = inferRegionFromEndpoint(initialEndpoint, process.env.ARVAN_REGION);

let activeArvanConfig: ArvanConfig = {
  accessKeyId: cleanCredential(process.env.ARVAN_ACCESS_KEY),
  secretAccessKey: cleanCredential(process.env.ARVAN_SECRET_KEY),
  bucketName: cleanCredential(process.env.ARVAN_BUCKET_NAME) || 'madahi-media-vault',
  endpoint: initialEndpoint,
  region: initialRegion,
  cdnDomain: normalizeCdnDomain(process.env.ARVAN_CDN_DOMAIN),
};

// Friendly error helper for AWS/Arvan S3 errors
const translateS3Error = (err: any): string => {
  const code = err?.name || err?.Code || '';
  const msg = err?.message || String(err);

  if (msg.includes('Invalid URL') || code === 'ERR_INVALID_URL' || msg.includes('ERR_INVALID_URL')) {
    return 'آدرس سرور ابر آروان (Endpoint) نامعتبر بود و اصلاح گردید. آدرس باید حتماً با //:https شروع شود (مثال: https://s3.ir-central1.arvanstorage.ir).';
  }
  if (code === 'InvalidAccessKeyId') {
    return 'کلید دسترسی (Access Key) وارد شده در ابر آروان نامعتبر است.';
  }
  if (code === 'SignatureDoesNotMatch') {
    return 'کلید محرمانه (Secret Key) نامعتبر است و امضای درخواست تایید نشد.';
  }
  if (code === 'NoSuchBucket' || code === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
    return `باکتی با نام «${activeArvanConfig.bucketName}» در ابر آروان یافت نشد. لطفاً ابتدا در پنل آروان باکت را بسازید یا نام آن را اصلاح کنید.`;
  }
  if (code === 'AccessDenied' || err?.$metadata?.httpStatusCode === 403) {
    return 'دسترسی غیرمجاز است (403 Forbidden). دسترسی‌های کلید خود را در پنل ابر آروان بررسی کنید (نیاز به خواندن و نوشتن دارد).';
  }
  if (msg.includes('ENOTFOUND') || msg.includes('fetch failed')) {
    return 'عدم امکان برقراری ارتباط با آدرس Endpoint ابر آروان. لطفاً آدرس سرور S3 را بررسی کنید.';
  }
  return msg || 'خطای ناشناخته در اتصال به استوریج ابر آروان';
};

const getS3Client = (cfg: ArvanConfig = activeArvanConfig, forcePathStyle = true) => {
  const accessKeyId = cleanCredential(cfg.accessKeyId);
  const secretAccessKey = cleanCredential(cfg.secretAccessKey);
  const endpoint = normalizeEndpoint(cfg.endpoint);
  const region = inferRegionFromEndpoint(endpoint, cfg.region);

  if (
    !accessKeyId ||
    !secretAccessKey ||
    accessKeyId === 'MY_ARVAN_ACCESS_KEY' ||
    secretAccessKey === 'MY_ARVAN_SECRET_KEY'
  ) {
    return null;
  }

  return new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle,
  });
};

const resolvePublicUrl = (s3Key: string): string => {
  const cdn = normalizeCdnDomain(activeArvanConfig.cdnDomain);
  if (cdn) {
    return `${cdn}/${s3Key}`;
  }
  const ep = normalizeEndpoint(activeArvanConfig.endpoint);
  const bucket = cleanCredential(activeArvanConfig.bucketName) || 'madahi-media-vault';
  return `${ep}/${bucket}/${s3Key}`;
};

// API: Check Storage and Cloud Connection Status
app.get('/api/storage/status', async (req, res) => {
  const isArvanConfigured = Boolean(
    activeArvanConfig.accessKeyId &&
      activeArvanConfig.secretAccessKey &&
      activeArvanConfig.accessKeyId !== 'MY_ARVAN_ACCESS_KEY'
  );
  const supabaseUrl = process.env.SUPABASE_URL;
  const isSupabaseConfigured = Boolean(supabaseUrl && supabaseUrl !== 'MY_SUPABASE_URL');

  let canConnectToBucket = false;
  let connectionMessage = '';

  if (isArvanConfigured) {
    const s3 = getS3Client();
    if (s3) {
      try {
        await s3.send(new HeadBucketCommand({ Bucket: activeArvanConfig.bucketName }));
        canConnectToBucket = true;
        connectionMessage = 'اتصال به باکت فعال و بدون مشکل است.';
      } catch (err: any) {
        canConnectToBucket = false;
        connectionMessage = translateS3Error(err);
      }
    }
  } else {
    connectionMessage = 'کلیدهای ابر آروان هنوز تنظیم نشده‌اند.';
  }

  res.json({
    arvan: {
      isConfigured: isArvanConfigured,
      canConnect: canConnectToBucket,
      connectionMessage,
      bucketName: activeArvanConfig.bucketName,
      endpoint: activeArvanConfig.endpoint,
      region: activeArvanConfig.region,
      cdnDomain: activeArvanConfig.cdnDomain,
      maskedAccessKey: isArvanConfigured
        ? `${activeArvanConfig.accessKeyId.slice(0, 6)}...${activeArvanConfig.accessKeyId.slice(-4)}`
        : null,
      maskedSecretKey: isArvanConfigured ? '••••••••••••••••' : null,
    },
    supabase: {
      isConfigured: isSupabaseConfigured,
      projectUrl: isSupabaseConfigured ? supabaseUrl : null,
    },
  });
});

// API: Save / Update ArvanCloud Credentials at Runtime
app.post('/api/storage/config', (req, res) => {
  try {
    const { accessKeyId, secretAccessKey, bucketName, endpoint, region, cdnDomain } = req.body;

    if (accessKeyId !== undefined) activeArvanConfig.accessKeyId = cleanCredential(accessKeyId);
    if (secretAccessKey !== undefined) activeArvanConfig.secretAccessKey = cleanCredential(secretAccessKey);
    if (bucketName !== undefined) activeArvanConfig.bucketName = cleanCredential(bucketName) || 'madahi-media-vault';
    if (endpoint !== undefined) {
      activeArvanConfig.endpoint = normalizeEndpoint(String(endpoint));
      activeArvanConfig.region = inferRegionFromEndpoint(activeArvanConfig.endpoint, activeArvanConfig.region);
    }
    if (region !== undefined && String(region).trim()) {
      activeArvanConfig.region = cleanCredential(region);
    }
    if (cdnDomain !== undefined) activeArvanConfig.cdnDomain = normalizeCdnDomain(String(cdnDomain));

    res.json({
      success: true,
      message: 'تنظیمات ابر آروان با موفقیت ذخیره و استانداردسازی شد.',
      config: {
        bucketName: activeArvanConfig.bucketName,
        endpoint: activeArvanConfig.endpoint,
        region: activeArvanConfig.region,
        cdnDomain: activeArvanConfig.cdnDomain,
        isConfigured: Boolean(activeArvanConfig.accessKeyId && activeArvanConfig.secretAccessKey),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در ذخیره تنظیمات: ' + error.message });
  }
});

// API: Test Live Connection to ArvanCloud S3 Bucket
app.post('/api/storage/test', async (req, res) => {
  try {
    const rawEndpoint = req.body.endpoint !== undefined ? String(req.body.endpoint) : activeArvanConfig.endpoint;
    const normalizedEp = normalizeEndpoint(rawEndpoint);
    const resolvedRegion = inferRegionFromEndpoint(
      normalizedEp,
      req.body.region !== undefined ? String(req.body.region) : activeArvanConfig.region
    );

    const customConfig: ArvanConfig = {
      accessKeyId: cleanCredential(req.body.accessKeyId) || activeArvanConfig.accessKeyId,
      secretAccessKey: cleanCredential(req.body.secretAccessKey) || activeArvanConfig.secretAccessKey,
      bucketName: cleanCredential(req.body.bucketName) || activeArvanConfig.bucketName,
      endpoint: normalizedEp,
      region: resolvedRegion,
      cdnDomain: normalizeCdnDomain(req.body.cdnDomain !== undefined ? String(req.body.cdnDomain) : activeArvanConfig.cdnDomain),
    };

    if (!customConfig.accessKeyId || !customConfig.secretAccessKey) {
      return res.status(400).json({
        success: false,
        error: 'کلید دسترسی (Access Key) یا کلید محرمانه (Secret Key) وارد نشده است.',
      });
    }

    const s3 = getS3Client(customConfig);
    if (!s3) {
      return res.status(400).json({
        success: false,
        error: 'امکان ساخت کلاینت S3 با مقادیر ارائه شده وجود ندارد.',
      });
    }

    // 1. Check bucket existence
    await s3.send(new HeadBucketCommand({ Bucket: customConfig.bucketName }));

    // 2. Test listing permissions
    const listResult = await s3.send(
      new ListObjectsV2Command({
        Bucket: customConfig.bucketName,
        MaxKeys: 10,
      })
    );

    // Save into active if requested
    if (req.body.saveOnSuccess) {
      activeArvanConfig = customConfig;
    }

    res.json({
      success: true,
      message: `اتصال با موفقیت برقرار شد! باکت «${customConfig.bucketName}» در دسترس است.`,
      itemsFound: listResult.KeyCount || 0,
      bucketName: customConfig.bucketName,
      endpoint: customConfig.endpoint,
      region: customConfig.region,
    });
  } catch (error: any) {
    console.error('S3 Connection Test Error:', error);
    const friendlyError = translateS3Error(error);
    res.status(400).json({
      success: false,
      error: friendlyError,
      code: error.name || 'S3_ERROR',
      details: error.message || String(error),
    });
  }
});

// API: Sync & List Real Objects from ArvanCloud S3 Bucket
app.get('/api/storage/files', async (req, res) => {
  try {
    const s3 = getS3Client();
    if (!s3) {
      return res.status(400).json({
        success: false,
        error: 'کلیدهای ابر آروان تنظیم نشده‌اند. ابتدا کلیدها را در بخش تنظیمات یا Secrets ثبت کنید.',
      });
    }

    const bucketName = activeArvanConfig.bucketName;
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : '';

    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      MaxKeys: 100,
    });

    const response = await s3.send(listCommand);
    const contents = response.Contents || [];

    const files = contents.map((item) => {
      const key = item.Key || '';
      const sizeBytes = item.Size || 0;
      const sizeMb = parseFloat((sizeBytes / (1024 * 1024)).toFixed(2));
      const publicUrl = resolvePublicUrl(key);
      const fileName = key.split('/').pop() || key;

      return {
        key,
        fileName,
        sizeMb,
        sizeBytes,
        lastModified: item.LastModified?.toISOString() || null,
        url: publicUrl,
        isAudio: /\.(mp3|m4a|ogg|wav|aac)$/i.test(key),
        isImage: /\.(jpg|jpeg|png|webp)$/i.test(key),
      };
    });

    res.json({
      success: true,
      bucketName,
      count: files.length,
      files,
    });
  } catch (error: any) {
    console.error('List S3 Files Error:', error);
    res.status(500).json({
      success: false,
      error: translateS3Error(error),
      details: error.message || String(error),
    });
  }
});

// API: Delete an Object from ArvanCloud S3
app.delete('/api/storage/file', async (req, res) => {
  try {
    const key = typeof req.query.key === 'string' ? req.query.key : req.body?.key;
    if (!key) {
      return res.status(400).json({ error: 'کلید فایل (s3Key) ارسال نشده است.' });
    }

    const s3 = getS3Client();
    if (!s3) {
      return res.status(400).json({ error: 'کلیدهای ابر آروان تنظیم نشده‌اند.' });
    }

    await s3.send(
      new DeleteObjectCommand({
        Bucket: activeArvanConfig.bucketName,
        Key: key,
      })
    );

    res.json({
      success: true,
      message: `فایل «${key}» از باکت ابر آروان حذف شد.`,
    });
  } catch (error: any) {
    console.error('Delete S3 File Error:', error);
    res.status(500).json({
      error: translateS3Error(error),
      details: error.message || String(error),
    });
  }
});

// API: Get YouTube Cookies Status
app.get('/api/youtube/cookies', (req, res) => {
  try {
    const info = getYouTubeCookiesInfo();
    res.json({
      success: true,
      ...info,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در بررسی وضعیت کوکی‌ها: ' + error.message });
  }
});

// API: Save / Update YouTube Cookies
app.post('/api/youtube/cookies', (req, res) => {
  try {
    const { cookiesContent } = req.body;
    if (!cookiesContent || typeof cookiesContent !== 'string' || cookiesContent.trim().length < 15) {
      return res.status(400).json({
        error: 'محتوای کوکی نامعتبر یا خالی است. لطفاً متن کوکی خروجی گرفته‌شده به فرمت Netscape را وارد کنید.',
      });
    }

    const cleanContent = cookiesContent.trim();
    fs.writeFileSync(YOUTUBE_COOKIES_PATH, cleanContent, 'utf8');

    const info = getYouTubeCookiesInfo();
    res.json({
      success: true,
      message: `کوکی‌های یوتیوب با موفقیت ذخیره شدند (${info.entryCount} ورودی شناسایی شد). اکنون می‌توانید ویدیوهای محافظت‌شده یوتیوب را استخراج کنید.`,
      ...info,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در ذخیره کوکی‌ها: ' + error.message });
  }
});

// API: Delete YouTube Cookies
app.delete('/api/youtube/cookies', (req, res) => {
  try {
    if (fs.existsSync(YOUTUBE_COOKIES_PATH)) {
      fs.unlinkSync(YOUTUBE_COOKIES_PATH);
    }
    res.json({
      success: true,
      message: 'فایل کوکی‌های یوتیوب با موفقیت حذف شد.',
    });
  } catch (error: any) {
    res.status(500).json({ error: 'خطا در حذف کوکی‌ها: ' + error.message });
  }
});

const getS3Helpers = () => {
  const s3 = getS3Client();
  if (!s3) return null;
  return {
    s3,
    bucketName: activeArvanConfig.bucketName,
    resolvePublicUrl: (key: string) => resolvePublicUrl(key),
  };
};

// ==========================================
// YouTube Channel Monitoring & Auto-Scraper
// ==========================================

// 1. List YouTube Channels
app.get('/api/youtube/channels', (req, res) => {
  res.json({ success: true, channels: localDb.getYoutubeChannels() });
});

// 2. Add YouTube Channel to monitor
app.post('/api/youtube/channels', (req, res) => {
  try {
    const {
      channelName,
      channelHandle,
      channelUrl,
      defaultReciterId,
      defaultCategoryId,
      autoApprove,
      isMonitored,
    } = req.body;

    if (!channelName || (!channelHandle && !channelUrl)) {
      return res.status(400).json({ error: 'نام و هندل یا آدرس کانال یوتیوب الزامی است.' });
    }

    const newChannel = {
      id: `yt-${Date.now()}`,
      channelName: String(channelName).trim(),
      channelHandle: String(channelHandle || '').trim(),
      channelUrl: String(channelUrl || channelHandle || '').trim(),
      isMonitored: isMonitored !== undefined ? !!isMonitored : true,
      lastCheckedAt: 'همین الان',
      totalExtracted: 0,
      defaultReciterId: defaultReciterId || 'rec-karimi',
      defaultCategoryId: defaultCategoryId || 'cat-moharram',
      autoApprove: !!autoApprove,
    };

    const saved = localDb.addYoutubeChannel(newChannel);
    localDb.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      channel: 'پایش یوتیوب',
      message: `کانال جدید «${saved.channelName}» برای پایش خودکار ثبت شد.`,
      level: 'success',
    });

    res.json({ success: true, channel: saved });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Update YouTube Channel
app.put('/api/youtube/channels/:id', (req, res) => {
  const updated = localDb.updateYoutubeChannel(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'کانال یافت نشد.' });
  res.json({ success: true, channel: updated });
});

// 4. Delete YouTube Channel
app.delete('/api/youtube/channels/:id', (req, res) => {
  const ok = localDb.deleteYoutubeChannel(req.params.id);
  res.json({ success: ok, message: ok ? 'کانال حذف شد.' : 'کانال یافت نشد.' });
});

// 5. Preview latest videos of a channel without downloading
app.post('/api/youtube/preview-channel', async (req, res) => {
  try {
    const { url, handle } = req.body;
    const target = url || handle;
    if (!target) return res.status(400).json({ error: 'آدرس یا هندل کانال الزامی است.' });
    const videos = await youtubeMonitor.fetchChannelVideos(target, 5);
    res.json({ success: true, videos });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5.1. Get Discovered YouTube Videos Pending Approval
app.get('/api/youtube/discovered', (req, res) => {
  res.json({ success: true, videos: localDb.getDiscoveredVideos() });
});

// 5.2. Approve and Convert Discovered Video to S3 Track
app.post('/api/youtube/approve-discovered', async (req, res) => {
  try {
    const helpers = getS3Helpers();
    if (!helpers) {
      return res.status(400).json({
        error: 'کلیدهای ابر آروان تنظیم نشده‌اند. ابتدا در تب همگام‌سازی استوریج، اتصال باکت را بررسی کنید.',
      });
    }

    const { videoId, customTitle, reciterId, categoryId, bitrate } = req.body;
    if (!videoId) {
      return res.status(400).json({ error: 'شناسه ویدیو (videoId) ارسال نشده است.' });
    }

    const track = await youtubeMonitor.approveAndExtractVideo(
      {
        id: videoId,
        title: customTitle,
        reciterId,
        categoryId,
        bitrate,
      },
      helpers
    );

    res.json({
      success: true,
      track,
      discoveredVideos: localDb.getDiscoveredVideos(),
      message: `قطعه صوتی «${track.title}» با موفقیت تبدیل و به صف بررسی افزوده شد.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5.3. Dismiss Discovered Video (or clear all)
app.post('/api/youtube/dismiss-discovered', (req, res) => {
  const { videoId, clearAll } = req.body;
  if (clearAll) {
    localDb.clearDiscoveredVideos();
  } else if (videoId) {
    localDb.removeDiscoveredVideo(videoId);
  }
  res.json({ success: true, discoveredVideos: localDb.getDiscoveredVideos() });
});

// 5.4. Fast Media Info & Playback Resolver for Single Video / Media URLs
app.post('/api/media-info', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !String(url).trim()) {
      return res.status(400).json({ error: 'آدرس URL ارسال نشده است.' });
    }
    const cleanUrl = String(url).trim().replace(/^["'`]+|["'`]+$/g, '');

    // 1. YouTube Link Detection
    const ytMatch = cleanUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
    );
    if (ytMatch) {
      const videoId = ytMatch[1];
      const playbackUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
      const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      // Fast oEmbed lookup for official title & author
      let title = 'ویدیوی یوتیوب';
      let author = 'یوتیوب';
      let authorUrl = '';

      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
        );
        if (oembedRes.ok) {
          const oembedData: any = await oembedRes.json();
          if (oembedData.title) title = oembedData.title;
          if (oembedData.author_name) author = oembedData.author_name;
          if (oembedData.author_url) authorUrl = oembedData.author_url;
        }
      } catch (oeErr) {
        console.warn('[MediaInfo] oEmbed fallback notice:', oeErr);
      }

      // Check if this video is already in database tracks or pending queue
      const existingTracks = localDb.getTracks();
      const existingQueue = localDb.getPendingQueue();
      const matchTrack = existingTracks.find(
        (t) => (t.sourceUrl && t.sourceUrl.includes(videoId)) || t.id.includes(videoId) || (t.s3Key && t.s3Key.includes(videoId))
      );
      const matchQueue = existingQueue.find(
        (q) => (q.sourceUrl && q.sourceUrl.includes(videoId)) || q.id.includes(videoId) || (q.s3Key && q.s3Key.includes(videoId))
      );

      // Guess matching reciter from author name if available
      const allReciters = localDb.getReciters();
      const matchedReciter = allReciters.find((r) => {
        const n = r.name.toLowerCase();
        const t = r.title.toLowerCase();
        const text = `${title} ${author}`.toLowerCase();
        return text.includes(n) || text.includes(t);
      });

      return res.json({
        success: true,
        sourceType: 'youtube',
        id: videoId,
        title,
        uploader: author,
        authorUrl,
        thumbnail: thumbnailUrl,
        embedUrl,
        playbackUrl,
        duration: 240,
        isDuplicate: Boolean(matchTrack || matchQueue),
        duplicateLocation: matchTrack ? 'database' : matchQueue ? 'queue' : null,
        existingItem: matchTrack || matchQueue || null,
        suggestedReciterId: matchedReciter?.id,
        suggestedReciterName: matchedReciter?.name,
      });
    }

    // 2. Aparat Video Detection
    const aparatMatch = cleanUrl.match(/aparat\.com\/v\/([a-zA-Z0-9]+)/i);
    if (aparatMatch) {
      const vidHash = aparatMatch[1];
      return res.json({
        success: true,
        sourceType: 'aparat',
        id: vidHash,
        title: `ویدیوی آپارات (${vidHash})`,
        uploader: 'آپارات',
        authorUrl: cleanUrl,
        thumbnail: '',
        embedUrl: `https://www.aparat.com/video/video/embed/videohash/${vidHash}/vt/frame`,
        playbackUrl: cleanUrl,
        duration: 210,
      });
    }

    // 3. Direct Audio / Video Media URLs
    const isDirectAudio = /\.(mp3|m4a|wav|aac|ogg)(\?.*)?$/i.test(cleanUrl);
    const isDirectVideo = /\.(mp4|mkv|webm|mov)(\?.*)?$/i.test(cleanUrl);
    const urlFilename = cleanUrl.split('/').pop()?.split('?')[0] || 'فایل رسانه';

    return res.json({
      success: true,
      sourceType: isDirectAudio ? 'direct_audio' : isDirectVideo ? 'direct_video' : 'web_page',
      id: `media-${Date.now()}`,
      title: decodeURIComponent(urlFilename).replace(/\.[^/.]+$/, ''),
      uploader: 'لینک مستقیم وب',
      authorUrl: cleanUrl,
      thumbnail: '',
      embedUrl: null,
      playbackUrl: cleanUrl,
      duration: 180,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'خطا در دریافت اطلاعات رسانه' });
  }
});

// 5.5. Fast YouTube Channel Inspector & Reciter Auto-Detector
app.post('/api/youtube/inspect-channel', async (req, res) => {
  try {
    const { target } = req.body;
    if (!target || !String(target).trim()) {
      return res.status(400).json({ error: 'آدرس یا هندل کانال ارسال نشده است.' });
    }
    const info = await youtubeMonitor.inspectChannel(String(target).trim());
    res.json({ success: true, ...info });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'خطا در استعلام مشخصات کانال' });
  }
});

// 6. Scan a specific channel immediately (discovers and lists videos)
app.post('/api/youtube/channels/:id/scan', async (req, res) => {
  try {
    const helpers = getS3Helpers();
    const result = await youtubeMonitor.scanSingleChannel(req.params.id, helpers || undefined);
    res.json({ success: true, result, discoveredVideos: localDb.getDiscoveredVideos() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Scan all monitored YouTube channels immediately (discovers and lists videos)
app.post('/api/youtube/scan-all', async (req, res) => {
  try {
    const helpers = getS3Helpers();
    const summary = await youtubeMonitor.scanAllMonitored(helpers || undefined);
    res.json({ success: true, summary, discoveredVideos: localDb.getDiscoveredVideos() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Get Monitor Status
app.get('/api/youtube/monitor/status', (req, res) => {
  res.json({ success: true, status: youtubeMonitor.getStatus() });
});

// 9. Toggle Auto-Monitoring Schedule
app.post('/api/youtube/monitor/toggle', (req, res) => {
  const { enabled, intervalMinutes } = req.body;
  if (enabled) {
    youtubeMonitor.startAutoMonitoring(intervalMinutes || 30, getS3Helpers);
  } else {
    youtubeMonitor.stopAutoMonitoring();
  }
  res.json({ success: true, status: youtubeMonitor.getStatus() });
});

// API: Real Upload to ArvanCloud S3
app.post('/api/upload', upload.single('file') as any, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'هیچ فایلی برای آپلود انتخاب نشده است.' });
    }

    const s3 = getS3Client();
    if (!s3) {
      return res.status(400).json({
        error:
          'کلیدهای استوریج ابر آروان تنظیم نشده‌اند! لطفاً در تب «فضای ابری و استوریج» کلیدهای ARVAN_ACCESS_KEY و ARVAN_SECRET_KEY را وارد کرده و دکمه ذخیره و تست را بزنید.',
      });
    }

    const bucketName = activeArvanConfig.bucketName;
    const timestamp = Date.now();
    const cleanFileName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `audio/${new Date().toISOString().slice(0, 7)}/${timestamp}_${cleanFileName}`;
    const fileSizeMb = parseFloat((file.size / (1024 * 1024)).toFixed(2));

    // Upload to ArvanCloud S3
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype || 'audio/mpeg',
      CacheControl: 'public, max-age=31536000',
      ACL: 'public-read',
    });

    await s3.send(command);

    const publicUrl = resolvePublicUrl(s3Key);

    const reciterId = req.body?.reciterId || 'rec-karimi';
    const reciterObj = localDb.getReciters().find((r) => r.id === reciterId);
    const reciterName = reciterObj?.name || req.body?.reciterName || 'حاج محمود کریمی';
    const categoryId = req.body?.categoryId || 'cat-moharram';
    const categoryObj = localDb.getCategories().find((c) => c.id === categoryId);
    const categoryName = categoryObj?.name || req.body?.categoryName || 'محرم و عاشورا';
    const trackTitle = (req.body?.title && String(req.body.title).trim()) || file.originalname.replace(/\.[^/.]+$/, '');

    const newQueueItem = localDb.addToQueue({
      id: `queue-${Date.now()}`,
      title: trackTitle,
      reciterId,
      reciterName,
      categoryId,
      categoryName,
      duration: Number(req.body?.duration) || 240,
      audioUrl: publicUrl,
      coverUrl: req.body?.coverUrl || '',
      fileSizeMb,
      bitrate: '320 kbps',
      lyrics: [],
      status: 'pending',
      sourceType: 'manual_upload',
      playCount: 0,
      createdAt: 'همین الان (آپلود فایل)',
      s3Key,
      tags: ['آپلود فایل', reciterName],
    });

    localDb.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      channel: 'آپلود فایل',
      message: `فایل صوتی «${trackTitle}» با موفقیت آپلود و در صف بررسی ثبت شد.`,
      level: 'success',
    });

    return res.json({
      success: true,
      realUpload: true,
      url: publicUrl,
      s3Key,
      fileSizeMb,
      fileName: file.originalname,
      queueItem: newQueueItem,
      message: `فایل صوتی با موفقیت در باکت «${bucketName}» ابر آروان آپلود و در صف بررسی ذخیره گردید.`,
    });
  } catch (error: any) {
    console.error('Upload Error:', error);
    const friendlyError = translateS3Error(error);
    return res.status(500).json({
      error: `خطا در آپلود به ابر آروان: ${friendlyError}`,
      code: error.name || 'UPLOAD_ERROR',
      details: error.message || String(error),
    });
  }
});

// API: Process YouTube or Web URL (Extract audio, convert to MP3, upload to ArvanCloud S3)
app.post('/api/extract-url', async (req, res) => {
  let tempDir: string | null = null;
  try {
    const { url, title, reciterName, categoryId, bitrate } = req.body;
    if (!url || !String(url).trim()) {
      return res.status(400).json({ error: 'آدرس URL ارسال نشده است.' });
    }

    let cleanUrl = String(url).trim().replace(/^["'`]+|["'`]+$/g, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    const s3 = getS3Client();
    const bucketName = activeArvanConfig.bucketName;

    if (!s3 || !bucketName) {
      return res.status(400).json({
        error:
          'اتصال به ابر آروان برقرار نیست. ابتدا کلیدهای استوریج ابر آروان را در بخش «تنظیمات ابر آروان» ذخیره کنید.',
      });
    }

    // Check for existing duplicate by YouTube ID unless force is requested
    const ytMatch = cleanUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
    );
    if (ytMatch && !req.body.force) {
      const vidId = ytMatch[1];
      const matchTrack = localDb.getTracks().find((t) => t.sourceUrl?.includes(vidId) || t.id.includes(vidId) || t.s3Key?.includes(vidId));
      const matchQueue = localDb.getPendingQueue().find((q) => q.sourceUrl?.includes(vidId) || q.id.includes(vidId) || q.s3Key?.includes(vidId));
      if (matchTrack || matchQueue) {
        return res.status(409).json({
          isDuplicate: true,
          error: `این ویدیو قبلاً پردازش شده است (${matchTrack ? 'در دیتابیس قطعات منتشر شده' : 'در صف بررسی موجود است'}). جهت دانلود و استخراج مجدد، گزینه «تأیید مجدد» را انتخاب کنید.`,
          existingItem: matchTrack || matchQueue,
        });
      }
    }

    const isDirectAudio = cleanUrl.match(/\.(mp3|m4a|ogg|wav|aac|flac)($|\?)/i);
    const isDirectVideo = cleanUrl.match(/\.(mp4|mov|webm|mkv|avi)($|\?)/i);

    // Direct audio URL fast-path
    if (isDirectAudio) {
      console.log(`[Extract] Processing direct audio URL: ${cleanUrl}`);
      const audioResponse = await fetch(cleanUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      if (!audioResponse.ok) {
        throw new Error(`دانلود فایل صوتی از مبدا با خطا مواجه شد (${audioResponse.status} ${audioResponse.statusText})`);
      }
      const arrayBuffer = await audioResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const s3Key = `incoming/web/${Date.now()}_audio.mp3`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: buffer,
          ContentType: 'audio/mpeg',
          CacheControl: 'public, max-age=31536000',
          ACL: 'public-read',
        })
      );

      const publicUrl = resolvePublicUrl(s3Key);
      const fileSizeMb = parseFloat((buffer.length / (1024 * 1024)).toFixed(2));

      return res.json({
        success: true,
        realUpload: true,
        url: publicUrl,
        s3Key,
        fileSizeMb,
        title: title || 'قطعه صوتی استخراج شده از وب',
        duration: 180,
        coverUrl: '',
        message: `فایل صوتی وب با موفقیت دانلود و در باکت «${bucketName}» ابر آروان ذخیره شد.`,
      });
    }

    // Direct video URL fast-path (convert to MP3 via ffmpeg directly)
    if (isDirectVideo) {
      console.log(`[Extract] Processing direct video URL via ffmpeg: ${cleanUrl}`);
      const tempId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      tempDir = path.join(os.tmpdir(), `direct_vid_${tempId}`);
      fs.mkdirSync(tempDir, { recursive: true });

      const videoResponse = await fetch(cleanUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      });
      if (!videoResponse.ok) {
        throw new Error(`دانلود ویدیو از آدرس مستقیم ناموفق بود (${videoResponse.status} ${videoResponse.statusText})`);
      }
      const arrayBuffer = await videoResponse.arrayBuffer();
      const rawVideoPath = path.join(tempDir, 'source_video.mp4');
      fs.writeFileSync(rawVideoPath, Buffer.from(arrayBuffer));

      const outAudioPath = path.join(tempDir, 'output.mp3');
      const selectedAudioBitrate = bitrate === '128' ? '128k' : '320k';
      await execFileAsync('ffmpeg', [
        '-i', rawVideoPath,
        '-vn',
        '-c:a', 'libmp3lame',
        '-b:a', selectedAudioBitrate,
        '-y',
        outAudioPath,
      ]);

      const audioBuffer = fs.readFileSync(outAudioPath);
      const fileSizeMb = parseFloat((audioBuffer.length / (1024 * 1024)).toFixed(2));
      const s3Key = `incoming/video/${Date.now()}_converted.mp3`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: audioBuffer,
          ContentType: 'audio/mpeg',
          CacheControl: 'public, max-age=31536000',
          ACL: 'public-read',
        })
      );

      const publicUrl = resolvePublicUrl(s3Key);

      const targetReciterId = req.body?.reciterId || 'rec-karimi';
      const reciterObj = localDb.getReciters().find((r) => r.id === targetReciterId);
      const targetReciterName = reciterObj?.name || req.body?.reciterName || 'حاج محمود کریمی';
      const targetCategoryId = categoryId || 'cat-moharram';
      const categoryObj = localDb.getCategories().find((c) => c.id === targetCategoryId);
      const targetCategoryName = categoryObj?.name || 'محرم و عاشورا';
      const directTitle = title || 'صوت استخراج شده از ویدیو مستقیم';

      const queueItem = localDb.addToQueue({
        id: `queue-${Date.now()}`,
        title: directTitle,
        reciterId: targetReciterId,
        reciterName: targetReciterName,
        categoryId: targetCategoryId,
        categoryName: targetCategoryName,
        duration: 240,
        audioUrl: publicUrl,
        coverUrl: '',
        fileSizeMb,
        bitrate: `${selectedAudioBitrate}bps`,
        lyrics: [],
        status: 'pending',
        sourceType: 'web_url',
        sourceUrl: cleanUrl,
        playCount: 0,
        createdAt: 'همین الان (تبدیل ویدیو مستقیم)',
        s3Key,
        tags: ['ویدیو مستقیم', targetReciterName],
      });

      localDb.addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        channel: 'تبدیل ویدیو',
        message: `ویدیو با موفقیت به MP3 تبدیل و در صف بررسی ذخیره شد: «${directTitle}»`,
        level: 'success',
      });

      return res.json({
        success: true,
        realUpload: true,
        url: publicUrl,
        s3Key,
        fileSizeMb,
        title: directTitle,
        duration: 240,
        coverUrl: '',
        queueItem,
        message: `ویدیو با موفقیت به صوت MP3 تبدیل، در باکت «${bucketName}» ذخیره و به صف بررسی افزوده شد.`,
      });
    }

    // Process YouTube or online video/audio page via yt-dlp
    console.log(`[Extract] Starting yt-dlp media extraction for URL: ${cleanUrl}`);
    const tempId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    tempDir = path.join(os.tmpdir(), `ytdl_${tempId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const selectedQuality = bitrate === '320' ? '320k' : '128k';
    const ytdlBinary = getYtDlpPath();

    const ytdlArgs = [
      '-x',
      '--audio-format',
      'mp3',
      '--audio-quality',
      selectedQuality,
      '-o',
      `${tempDir}/audio.%(ext)s`,
      '--write-thumbnail',
      '-o',
      `thumbnail:${tempDir}/thumb.%(ext)s`,
      '--print-json',
      '--no-playlist',
      '--no-check-certificates',
      '--max-filesize',
      '150M',
    ];

    // Check if user has uploaded YouTube cookies
    const cookiesInfo = getYouTubeCookiesInfo();
    if (cookiesInfo.configured) {
      console.log(`[Extract] Using authenticated YouTube cookies (${cookiesInfo.entryCount} entries)`);
      ytdlArgs.push('--cookies', YOUTUBE_COOKIES_PATH);
    } else {
      // Use resilient player client fallbacks
      ytdlArgs.push('--extractor-args', 'youtube:player_client=android,web');
    }

    // Enable Node.js as JavaScript runtime for solving YouTube JS challenges
    const nodeBinaryPath = process.execPath || '/usr/local/bin/node';
    ytdlArgs.push('--js-runtimes', `node:${nodeBinaryPath}`);

    ytdlArgs.push(cleanUrl);

    let stdout = '';
    let stderr = '';
    try {
      const execResult = await execFileAsync(ytdlBinary, ytdlArgs, {
        timeout: 120000, // 2 minutes max
        maxBuffer: 10 * 1024 * 1024,
      });
      stdout = execResult.stdout;
      stderr = execResult.stderr;
    } catch (execErr: any) {
      console.error('[Extract] yt-dlp execution error:', execErr.message, execErr.stderr);
      const errorMsg = String(execErr.stderr || execErr.message || '');
      let friendlyMsg = 'خطا در دریافت و تبدیل ویدیو به صوت.';
      let requiresCookies = false;

      if (errorMsg.includes('Sign in to confirm')) {
        requiresCookies = true;
        friendlyMsg =
          'یوتیوب این ویدیو را نیازمند تایید هویت تشخیص داده است (Sign in to confirm you are not a bot). برای رفع این مشکل، لطفاً کوکی‌های یوتیوب خود را در بخش «تنظیمات کوکی یوتیوب» وارد کنید، یا از لینک مستقیم فایل استفاده نمایید.';
      } else if (errorMsg.includes('Video unavailable') || errorMsg.includes('does not exist')) {
        friendlyMsg = 'این ویدیو در یوتیوب موجود نیست یا حذف شده است.';
      } else if (errorMsg.includes('Private video')) {
        friendlyMsg = 'این ویدیو خصوصی (Private) است و امکان استخراج آن وجود ندارد.';
      } else if (errorMsg.includes('Requested format is not available')) {
        friendlyMsg = 'فرمت مناسب صوتی برای این ویدیو یافت نشد.';
      } else if (errorMsg.includes('timed out')) {
        friendlyMsg = 'مدت زمان استخراج از یوتیوب به پایان رسید (Timeout).';
      }

      return res.status(400).json({
        error: friendlyMsg,
        requiresCookies,
        details: errorMsg.slice(0, 300),
      });
    }

    // Parse metadata from yt-dlp JSON output
    let meta: any = {};
    try {
      const firstLine = stdout.trim().split('\n')[0];
      if (firstLine) {
        meta = JSON.parse(firstLine);
      }
    } catch (parseErr) {
      console.warn('[Extract] Could not parse yt-dlp metadata JSON:', parseErr);
    }

    // Locate generated MP3 file
    const files = fs.readdirSync(tempDir);
    const audioFileName = files.find((f) => f.endsWith('.mp3'));
    if (!audioFileName) {
      throw new Error('فایل صوتی MP3 پس از اتمام پردازش ایجاد نشد.');
    }

    const audioFilePath = path.join(tempDir, audioFileName);
    const audioBuffer = fs.readFileSync(audioFilePath);
    const fileSizeMb = parseFloat((audioBuffer.length / (1024 * 1024)).toFixed(2));

    const finalTitle =
      (title && String(title).trim()) ||
      meta.title ||
      'نوای استخراج شده از یوتیوب';

    const safeSlug = finalTitle
      .replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_')
      .slice(0, 45);

    const s3Key = `incoming/youtube/${Date.now()}_${safeSlug}.mp3`;

    console.log(`[Extract] Uploading extracted MP3 (${fileSizeMb}MB) to ArvanCloud: ${s3Key}`);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: audioBuffer,
        ContentType: 'audio/mpeg',
        CacheControl: 'public, max-age=31536000',
        ACL: 'public-read',
      })
    );

    const publicAudioUrl = resolvePublicUrl(s3Key);

    // Optional: upload extracted thumbnail if present
    let publicCoverUrl = meta.thumbnail || '';
    const thumbFileName = files.find((f) => f.startsWith('thumb.'));
    if (thumbFileName) {
      try {
        const thumbPath = path.join(tempDir, thumbFileName);
        const thumbBuf = fs.readFileSync(thumbPath);
        const thumbExt = path.extname(thumbFileName).toLowerCase() || '.jpg';
        const thumbKey = `incoming/covers/${Date.now()}_cover${thumbExt}`;
        const thumbMime = thumbExt === '.webp' ? 'image/webp' : 'image/jpeg';

        await s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: thumbKey,
            Body: thumbBuf,
            ContentType: thumbMime,
            CacheControl: 'public, max-age=31536000',
            ACL: 'public-read',
          })
        );
        publicCoverUrl = resolvePublicUrl(thumbKey);
      } catch (thumbUploadErr) {
        console.warn('[Extract] Thumbnail upload notice:', thumbUploadErr);
      }
    }

    const reciterId = req.body?.reciterId || 'rec-karimi';
    const reciterObj = localDb.getReciters().find((r) => r.id === reciterId);
    const resolvedReciterName = reciterObj?.name || req.body?.reciterName || meta.uploader || 'حاج محمود کریمی';
    const catId = categoryId || 'cat-moharram';
    const catObj = localDb.getCategories().find((c) => c.id === catId);
    const resolvedCatName = catObj?.name || 'محرم و عاشورا';

    const queueItem = localDb.addToQueue({
      id: `queue-${Date.now()}`,
      title: finalTitle,
      reciterId,
      reciterName: resolvedReciterName,
      categoryId: catId,
      categoryName: resolvedCatName,
      duration: meta.duration || 210,
      audioUrl: publicAudioUrl,
      coverUrl: publicCoverUrl,
      fileSizeMb,
      bitrate: `${selectedQuality}bps`,
      lyrics: [],
      status: 'pending',
      sourceType: 'youtube',
      sourceUrl: cleanUrl,
      sourceChannelName: meta.uploader || '',
      playCount: 0,
      createdAt: 'همین الان (استخراج یوتیوب)',
      s3Key,
      tags: ['یوتیوب', resolvedReciterName],
    });

    localDb.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      channel: 'یوتیوب استودیو',
      message: `صوت «${finalTitle}» از یوتیوب استخراج، در استوریج ذخیره و در صف بررسی ثبت شد.`,
      level: 'success',
    });

    return res.json({
      success: true,
      realUpload: true,
      url: publicAudioUrl,
      s3Key,
      fileSizeMb,
      title: finalTitle,
      duration: meta.duration || 210,
      coverUrl: publicCoverUrl,
      uploader: meta.uploader || 'یوتیوب',
      bitrate: `${selectedQuality}bps`,
      queueItem,
      message: `ویدیو با موفقیت دریافت، به MP3 تبدیل، در باکت «${bucketName}» ذخیره و در صف بررسی ثبت شد.`,
    });
  } catch (error: any) {
    console.error('URL Extraction Error:', error);
    const friendlyError = translateS3Error(error);
    return res.status(500).json({
      error: `خطا در استخراج و آپلود صوت: ${friendlyError}`,
      details: error.message || String(error),
    });
  } finally {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  }
});

// ==========================================
// Local Database & Telegram Bot API Routes
// ==========================================

// 1. Get entire database state
app.get('/api/db/all', (req, res) => {
  try {
    const raw = localDb.getAll();
    const safeData = {
      ...raw,
      botConfig: raw.botConfig
        ? {
            ...raw.botConfig,
            token: raw.botConfig.token
              ? `${raw.botConfig.token.slice(0, 4)}••••••••${raw.botConfig.token.slice(-4)}`
              : '',
            hasToken: Boolean(raw.botConfig.token),
          }
        : undefined,
    };
    res.json({ success: true, data: safeData });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Tracks CRUD
app.get('/api/tracks', (req, res) => {
  res.json({ success: true, tracks: localDb.getTracks() });
});

app.post('/api/tracks', (req, res) => {
  try {
    const track = localDb.addTrack(req.body);
    res.json({ success: true, track });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/tracks/:id', (req, res) => {
  const updated = localDb.updateTrack(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'قطعه مورد نظر یافت نشد.' });
  res.json({ success: true, track: updated });
});

app.delete('/api/tracks/:id', (req, res) => {
  const ok = localDb.deleteTrack(req.params.id);
  res.json({ success: ok, message: ok ? 'قطعه با موفقیت حذف شد.' : 'قطعه یافت نشد.' });
});

// 3. Queue CRUD & Approval
app.get('/api/queue', (req, res) => {
  res.json({ success: true, queue: localDb.getPendingQueue() });
});

app.post('/api/queue', (req, res) => {
  try {
    const item = localDb.addToQueue(req.body);
    res.json({ success: true, item });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/queue/:id', (req, res) => {
  const updated = localDb.updateQueueItem(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'آیتم صف یافت نشد.' });
  res.json({ success: true, item: updated });
});

app.delete('/api/queue/:id', (req, res) => {
  const ok = localDb.deleteQueueItem(req.params.id);
  res.json({ success: ok, message: ok ? 'از صف بررسی حذف شد.' : 'آیتم یافت نشد.' });
});

app.post('/api/queue/:id/approve', async (req, res) => {
  try {
    const { overrides, publishToTelegram, track: payloadTrack } = req.body || {};
    const approved = localDb.approveQueueItemWithFallback(req.params.id, overrides, payloadTrack);

    if (!approved) {
      return res.status(404).json({ error: 'آیتم مورد نظر در صف یافت نشد.' });
    }

    let telegramResult: any = null;
    const botConfig = localDb.getBotConfig();
    if (publishToTelegram || botConfig.autoPublishApproved) {
      if (botConfig.token && botConfig.targetChannel) {
        try {
          telegramResult = await publishTrackToTelegramChannel(approved, botConfig);
          if (telegramResult.success) {
            localDb.addLog({
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleTimeString('fa-IR'),
              channel: 'کانال تلگرام',
              message: `قطعه «${approved.title}» همزمان با تأیید، در کانال منتشر گردید.`,
              level: 'success',
            });
          }
        } catch (tgErr: any) {
          console.warn('[TelegramPublish] Non-fatal error during approval publish:', tgErr);
          telegramResult = { success: false, error: tgErr.message || 'خطا در ارسال به کانال تلگرام' };
        }
      }
    }

    res.json({
      success: true,
      track: approved,
      telegram: telegramResult,
      message: 'قطعه با موفقیت تأیید و در پایگاه داده ذخیره شد.',
    });
  } catch (err: any) {
    console.error('Approve Error:', err);
    res.status(500).json({ error: 'خطا در تأیید قطعه: ' + err.message });
  }
});

// 4. Reciters CRUD
app.get('/api/reciters', (req, res) => {
  res.json({ success: true, reciters: localDb.getReciters() });
});

app.post('/api/reciters', (req, res) => {
  try {
    const newReciter = {
      id: req.body.id || `rec-${Date.now()}`,
      name: String(req.body.name).trim(),
      title: req.body.title ? String(req.body.title).trim() : String(req.body.name).trim(),
      bio: req.body.bio || '',
      avatarUrl: req.body.avatarUrl || '',
      tracksCount: Number(req.body.tracksCount) || 0,
      style: req.body.style || 'شور، زمینه و روضه',
      accentColor: req.body.accentColor || '#10b981',
    };
    const saved = localDb.addReciter(newReciter);
    localDb.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      channel: 'مداحان',
      message: `مداح جدید «${saved.name}» به پایگاه داده افزوده شد.`,
      level: 'success',
    });
    res.json({ success: true, reciter: saved });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/reciters/:id', (req, res) => {
  const updated = localDb.updateReciter(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'مداح یافت نشد.' });
  res.json({ success: true, reciter: updated });
});

app.delete('/api/reciters/:id', (req, res) => {
  const ok = localDb.deleteReciter(req.params.id);
  res.json({ success: ok, message: ok ? 'مداح با موفقیت حذف شد.' : 'مداح یافت نشد.' });
});

// 5. Categories CRUD
app.get('/api/categories', (req, res) => {
  res.json({ success: true, categories: localDb.getCategories() });
});

app.post('/api/categories', (req, res) => {
  try {
    const newCat = {
      id: req.body.id || `cat-${Date.now()}`,
      name: String(req.body.name).trim(),
      slug: req.body.slug ? String(req.body.slug).trim() : `cat-${Date.now()}`,
      iconName: req.body.iconName || 'Flame',
      tracksCount: Number(req.body.tracksCount) || 0,
      description: req.body.description || '',
    };
    const saved = localDb.addCategory(newCat);
    res.json({ success: true, category: saved });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/categories/:id', (req, res) => {
  const updated = localDb.updateCategory(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'دسته‌بندی یافت نشد.' });
  res.json({ success: true, category: updated });
});

app.delete('/api/categories/:id', (req, res) => {
  const ok = localDb.deleteCategory(req.params.id);
  res.json({ success: ok, message: ok ? 'دسته‌بندی حذف شد.' : 'دسته‌بندی یافت نشد.' });
});

// 6. Telegram Bot Config & Actions
app.get('/api/bot/config', (req, res) => {
  const config = localDb.getBotConfig();
  const maskedConfig = {
    ...config,
    token: config.token
      ? `${config.token.slice(0, 4)}••••••••${config.token.slice(-4)}`
      : '',
    hasToken: Boolean(config.token),
  };
  res.json({ success: true, config: maskedConfig });
});

app.post('/api/bot/config', (req, res) => {
  const payload = { ...req.body };
  // Never overwrite an existing token with masked dots
  if (payload.token && payload.token.includes('••')) {
    delete payload.token;
  }
  const updated = localDb.updateBotConfig(payload);
  const safeUpdated = {
    ...updated,
    token: updated.token
      ? `${updated.token.slice(0, 4)}••••••••${updated.token.slice(-4)}`
      : '',
    hasToken: Boolean(updated.token),
  };
  res.json({ success: true, config: safeUpdated });
});

app.post('/api/bot/test', async (req, res) => {
  try {
    const token = (req.body?.token || localDb.getBotConfig().token || '').trim();
    const result = await testTelegramToken(token);
    if (result.success && result.bot) {
      localDb.updateBotConfig({
        token,
        username: result.bot.username ? `@${result.bot.username}` : '',
        name: result.bot.first_name || '',
        botActive: true,
        lastTestedAt: new Date().toISOString(),
      });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bot/test-channel', async (req, res) => {
  try {
    const botConfig = localDb.getBotConfig();
    const token = (req.body?.token || botConfig.token || '').trim();
    const channel = (req.body?.channel || botConfig.targetChannel || '').trim();
    const result = await sendChannelTestMessage(token, channel);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bot/publish-track', async (req, res) => {
  try {
    const { trackId, track, customCaption } = req.body || {};
    const targetTrack: DbTrack | undefined =
      track ||
      localDb.getTracks().find((t) => t.id === trackId) ||
      localDb.getPendingQueue().find((t) => t.id === trackId);

    if (!targetTrack) {
      return res.status(400).json({ success: false, error: 'اطلاعات قطعه جهت ارسال به تلگرام یافت نشد.' });
    }

    const botConfig = localDb.getBotConfig();
    const result = await publishTrackToTelegramChannel(targetTrack, botConfig, customCaption);
    if (result.success) {
      localDb.addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        channel: 'کانال تلگرام',
        message: `قطعه «${targetTrack.title}» با موفقیت در کانال ${botConfig.targetChannel} ارسال شد.`,
        level: 'success',
      });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Database Export & Reset
app.get('/api/db/export', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="madahi_backup_database.json"');
  res.send(localDb.exportJson());
});

app.post('/api/db/reset', (req, res) => {
  return res.status(403).json({
    success: false,
    error: 'مسیر بازنشانی دیتابیس به دلایل امنیتی تا پیاده‌سازی کامل سیستم احراز هویت غیرفعال است.',
  });
});
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist/index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on port ${port} (http://localhost:${port})`);
});
