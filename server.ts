import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { createServer as createViteServer } from 'vite';

const execFileAsync = promisify(execFile);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json());

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

// API: Real Upload to ArvanCloud S3
app.post('/api/upload', upload.single('file'), async (req, res) => {
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

    return res.json({
      success: true,
      realUpload: true,
      url: publicUrl,
      s3Key,
      fileSizeMb,
      fileName: file.originalname,
      message: `فایل صوتی با موفقیت در باکت «${bucketName}» ابر آروان آپلود و ذخیره گردید.`,
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

    const isDirectAudio = cleanUrl.match(/\.(mp3|m4a|ogg|wav|aac|flac)($|\?)/i);

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

    // Process YouTube or online video/audio page via yt-dlp
    console.log(`[Extract] Starting yt-dlp media extraction for URL: ${cleanUrl}`);
    const tempId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    tempDir = path.join(os.tmpdir(), `ytdl_${tempId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const selectedQuality = bitrate === '320' ? '320k' : '128k';
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
      '--max-filesize',
      '150M',
      cleanUrl,
    ];

    let stdout = '';
    let stderr = '';
    try {
      const execResult = await execFileAsync('yt-dlp', ytdlArgs, {
        timeout: 120000, // 2 minutes max
        maxBuffer: 10 * 1024 * 1024,
      });
      stdout = execResult.stdout;
      stderr = execResult.stderr;
    } catch (execErr: any) {
      console.error('[Extract] yt-dlp execution error:', execErr.message, execErr.stderr);
      const errorMsg = String(execErr.stderr || execErr.message || '');
      let friendlyMsg = 'خطا در دریافت و تبدیل ویدیو به صوت.';
      if (errorMsg.includes('Video unavailable') || errorMsg.includes('does not exist')) {
        friendlyMsg = 'این ویدیو در یوتیوب موجود نیست یا حذف شده است.';
      } else if (errorMsg.includes('Private video')) {
        friendlyMsg = 'این ویدیو خصوصی (Private) است و امکان استخراج آن وجود ندارد.';
      } else if (errorMsg.includes('Sign in to confirm')) {
        friendlyMsg = 'یوتیوب نیاز به تایید دارد؛ لطفاً از لینک‌های عمومی یا لینک مستقیم فایل استفاده کنید.';
      } else if (errorMsg.includes('Requested format is not available')) {
        friendlyMsg = 'فرمت مناسب صوتی برای این ویدیو یافت نشد.';
      } else if (errorMsg.includes('timed out')) {
        friendlyMsg = 'مدت زمان استخراج از یوتیوب به پایان رسید (Timeout).';
      }
      return res.status(400).json({
        error: friendlyMsg,
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
      message: `ویدیو با موفقیت دریافت، به MP3 تبدیل و در باکت «${bucketName}» ابر آروان ذخیره شد.`,
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

// Mount Vite or serve static dist
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
