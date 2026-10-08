import path from 'path';
import fs from 'fs';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { localDb, YouTubeChannelSource, Track, DiscoveredVideo } from './db.js';

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(process.cwd(), 'data');
const YOUTUBE_COOKIES_PATH = path.join(DATA_DIR, 'youtube_cookies.txt');

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

const hasCookies = (): boolean => {
  if (fs.existsSync(YOUTUBE_COOKIES_PATH)) {
    try {
      const stat = fs.statSync(YOUTUBE_COOKIES_PATH);
      return stat.size > 20;
    } catch (_) {}
  }
  return false;
};

export interface ChannelVideoSummary {
  id: string;
  title: string;
  duration: number;
  url: string;
}

export interface ScanResult {
  channelId: string;
  channelName: string;
  channelHandle: string;
  totalFound: number;
  newVideosProcessed: number;
  newDiscovered: DiscoveredVideo[];
  discoveredVideos: DiscoveredVideo[];
  extractedTracks: Track[];
  errors: string[];
  scanTimestamp: string;
}

export interface MonitorStatus {
  isScanning: boolean;
  activeChannelName: string | null;
  lastScanAt: string | null;
  autoScanEnabled: boolean;
  intervalMinutes: number;
  discoveredCount: number;
  lastScanSummary?: {
    channelsScanned: number;
    newTracksAdded: number;
    newDiscoveredCount?: number;
    timestamp: string;
  };
}

class YouTubeMonitoringService {
  private isScanning: boolean = false;
  private activeChannelName: string | null = null;
  private lastScanAt: string | null = null;
  private autoScanEnabled: boolean = false;
  private intervalMinutes: number = 30;
  private timer: NodeJS.Timeout | null = null;
  private lastSummary: any = null;

  private normalizeChannelUrl(input: string): string {
    let raw = input.trim();
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      if (raw.startsWith('@')) {
        raw = `https://www.youtube.com/${raw}`;
      } else if (raw.startsWith('UC') || raw.startsWith('channel/')) {
        raw = `https://www.youtube.com/channel/${raw.replace('channel/', '')}`;
      } else {
        raw = `https://www.youtube.com/@${raw}`;
      }
    }
    return raw;
  }

  public async fetchChannelVideos(
    channelUrlOrHandle: string,
    maxItems: number = 5
  ): Promise<ChannelVideoSummary[]> {
    const rawUrl = this.normalizeChannelUrl(channelUrlOrHandle);
    const ytdlBinary = getYtDlpPath();

    // Try primary URL with /videos, and fallback to base URL if 404 occurs
    const candidateUrls = [
      rawUrl.includes('/videos') ? rawUrl : `${rawUrl.replace(/\/+$/, '')}/videos`,
      rawUrl.replace(/\/videos\/?$/, ''),
    ];

    let lastError: any = null;

    for (const targetUrl of candidateUrls) {
      const args = [
        '--flat-playlist',
        '--playlist-end',
        String(maxItems),
        '--print',
        '%(id)s\t%(title)s\t%(duration)s\t%(url)s',
        '--no-playlist',
        '--no-check-certificates',
      ];

      if (hasCookies()) {
        args.push('--cookies', YOUTUBE_COOKIES_PATH);
      } else {
        args.push('--extractor-args', 'youtube:player_client=android,web');
      }

      const nodeBinaryPath = process.execPath || '/usr/local/bin/node';
      args.push('--js-runtimes', `node:${nodeBinaryPath}`);
      args.push(targetUrl);

      try {
        const { stdout } = await execFileAsync(ytdlBinary, args, {
          timeout: 45000,
          maxBuffer: 5 * 1024 * 1024,
        });

        const lines = stdout.trim().split('\n').filter((l) => l.trim());
        const videos: ChannelVideoSummary[] = [];

        for (const line of lines) {
          // format: id \t title \t duration \t url
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const id = parts[0].trim();
            const title = parts[1].trim();
            const duration = parts[2] && !isNaN(Number(parts[2])) ? Number(parts[2]) : 240;
            const url = parts[3]?.trim() || `https://www.youtube.com/watch?v=${id}`;
            if (id && title) {
              videos.push({ id, title, duration, url });
            }
          }
        }

        if (videos.length > 0) {
          return videos;
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err.stderr || err.message || '');
        // If 404 on /videos, try base channel URL
        if (msg.includes('404') || msg.includes('Requested entity was not found')) {
          continue;
        }
        break;
      }
    }

    const cleanErr = lastError ? (lastError.stderr || lastError.message || String(lastError)) : 'کانال یافت نشد یا ویدیویی در دسترس نیست.';
    console.warn(`[YouTubeMonitor] Failed to list videos for ${rawUrl}:`, cleanErr);

    if (String(cleanErr).includes('404') || String(cleanErr).includes('Requested entity was not found')) {
      throw new Error(`آدرس یا هندل کانال یوتیوب نامعتبر است یا کانال یافت نشد (404 Not Found). لطفاً آدرس صحیح کانال را بررسی کنید.`);
    }

    throw new Error(`خطا در دریافت لیست ویدیوهای کانال: ${cleanErr}`);
  }

  public async scanSingleChannel(
    channelId: string,
    s3Helpers?: {
      s3: S3Client;
      bucketName: string;
      resolvePublicUrl: (key: string) => string;
    }
  ): Promise<ScanResult> {
    const channel = localDb.getYoutubeChannels().find((c) => c.id === channelId);
    if (!channel) {
      throw new Error(`کانال با شناسه ${channelId} در سیستم یافت نشد.`);
    }

    this.isScanning = true;
    this.activeChannelName = channel.channelName;
    const errors: string[] = [];
    const extractedTracks: Track[] = [];

    localDb.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      channel: 'پایش یوتیوب',
      message: `شروع بررسی کانال «${channel.channelName}»...`,
      level: 'info',
    });

    try {
      const channelUrl = channel.channelUrl || channel.channelHandle;
      const latestVideos = await this.fetchChannelVideos(channelUrl, 8);

      // Check which videos have already been processed or discovered
      const existingTracks = localDb.getTracks();
      const existingQueue = localDb.getPendingQueue();
      const existingDiscovered = localDb.getDiscoveredVideos();

      const isVideoKnown = (v: ChannelVideoSummary) => {
        return (
          existingTracks.some(
            (t) =>
              (t.sourceUrl && t.sourceUrl.includes(v.id)) ||
              t.title.trim().toLowerCase() === v.title.trim().toLowerCase()
          ) ||
          existingQueue.some(
            (q) =>
              (q.sourceUrl && q.sourceUrl.includes(v.id)) ||
              q.title.trim().toLowerCase() === v.title.trim().toLowerCase()
          ) ||
          existingDiscovered.some((d) => d.id === v.id)
        );
      };

      const newVideos = latestVideos.filter((v) => !isVideoKnown(v));

      const newDiscovered: DiscoveredVideo[] = newVideos.map((v) => ({
        id: v.id,
        channelId: channel.id,
        channelName: channel.channelName,
        channelHandle: channel.channelHandle,
        title: v.title,
        duration: v.duration || 240,
        url: v.url || `https://www.youtube.com/watch?v=${v.id}`,
        embedUrl: `https://www.youtube.com/embed/${v.id}`,
        thumbnailUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        discoveredAt: new Date().toLocaleTimeString('fa-IR'),
        defaultReciterId: channel.defaultReciterId,
        defaultCategoryId: channel.defaultCategoryId,
      }));

      if (newDiscovered.length > 0) {
        localDb.addDiscoveredVideos(newDiscovered);
      }

      // If channel is configured for automatic approval AND S3 is available, convert immediately
      if (channel.autoApprove && s3Helpers) {
        for (const video of newVideos.slice(0, 2)) {
          try {
            const track = await this.extractAndStoreVideo(video, channel, s3Helpers);
            if (track) {
              extractedTracks.push(track);
              localDb.removeDiscoveredVideo(video.id);
            }
          } catch (vErr: any) {
            console.error(`[YouTubeMonitor] Error processing video ${video.id}:`, vErr);
            errors.push(`خطا در استخراج ${video.title}: ${vErr.message}`);
          }
        }
      }

      // Update channel metadata
      localDb.updateYoutubeChannel(channel.id, {
        lastCheckedAt: new Date().toLocaleTimeString('fa-IR'),
        totalExtracted: (channel.totalExtracted || 0) + extractedTracks.length,
      });

      const resultMsg =
        newDiscovered.length > 0
          ? `پایش کانال «${channel.channelName}» با موفقیت انجام شد: ${newDiscovered.length} ویدیوی جدید با مشخصات و لینک پخش جهت بررسی و تایید در لیست قرار گرفت.`
          : `پایش کانال «${channel.channelName}» تکمیل شد. اثر جدیدی یافت نشد.`;

      localDb.addLog({
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        channel: 'پایش یوتیوب',
        message: resultMsg,
        level: newDiscovered.length > 0 ? 'success' : 'info',
      });

      return {
        channelId: channel.id,
        channelName: channel.channelName,
        channelHandle: channel.channelHandle,
        totalFound: latestVideos.length,
        newVideosProcessed: extractedTracks.length,
        newDiscovered,
        discoveredVideos: localDb.getDiscoveredVideos(),
        extractedTracks,
        errors,
        scanTimestamp: new Date().toISOString(),
      };
    } finally {
      this.isScanning = false;
      this.activeChannelName = null;
      this.lastScanAt = new Date().toISOString();
    }
  }

  public async approveAndExtractVideo(
    videoInput: {
      id: string;
      title?: string;
      url?: string;
      channelId?: string;
      channelName?: string;
      reciterId?: string;
      categoryId?: string;
      bitrate?: string;
    },
    s3Helpers: {
      s3: S3Client;
      bucketName: string;
      resolvePublicUrl: (key: string) => string;
    }
  ): Promise<Track> {
    const discoveredList = localDb.getDiscoveredVideos();
    const discovered = discoveredList.find((v) => v.id === videoInput.id);
    const videoUrl = videoInput.url || discovered?.url || `https://www.youtube.com/watch?v=${videoInput.id}`;
    const videoTitle = videoInput.title || discovered?.title || 'نوای صوتی یوتیوب';

    const channel =
      (videoInput.channelId && localDb.getYoutubeChannels().find((c) => c.id === videoInput.channelId)) ||
      (discovered?.channelId && localDb.getYoutubeChannels().find((c) => c.id === discovered.channelId)) ||
      localDb.getYoutubeChannels()[0] || {
        id: 'channel-default',
        channelName: videoInput.channelName || discovered?.channelName || 'یوتیوب',
        channelHandle: discovered?.channelHandle || '',
        channelUrl: videoUrl,
        isMonitored: true,
        lastCheckedAt: 'همین الان',
        totalExtracted: 0,
        defaultReciterId: videoInput.reciterId || discovered?.defaultReciterId || 'rec-karimi',
        defaultCategoryId: videoInput.categoryId || discovered?.defaultCategoryId || 'cat-moharram',
        autoApprove: false,
      };

    const targetReciterId =
      videoInput.reciterId || discovered?.defaultReciterId || channel.defaultReciterId || 'rec-karimi';
    const targetCategoryId =
      videoInput.categoryId || discovered?.defaultCategoryId || channel.defaultCategoryId || 'cat-moharram';

    const summary: ChannelVideoSummary = {
      id: videoInput.id,
      title: videoTitle,
      duration: discovered?.duration || 240,
      url: videoUrl,
    };

    const track = await this.extractAndStoreVideo(summary, channel, s3Helpers, {
      title: videoTitle,
      reciterId: targetReciterId,
      categoryId: targetCategoryId,
      bitrate: videoInput.bitrate || '320',
    });

    if (!track) {
      throw new Error('خطا در تبدیل و استخراج ویدیو');
    }

    // Remove from discovered list
    localDb.removeDiscoveredVideo(videoInput.id);

    // Update channel count
    if (channel.id) {
      localDb.updateYoutubeChannel(channel.id, {
        totalExtracted: (channel.totalExtracted || 0) + 1,
      });
    }

    localDb.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      channel: 'تایید و آپلود یوتیوب',
      message: `ویدیوی «${videoTitle}» با موفقیت تایید، تبدیل و در باکت ابر آروان ذخیره شد.`,
      level: 'success',
    });

    return track;
  }

  private async extractAndStoreVideo(
    video: ChannelVideoSummary,
    channel: YouTubeChannelSource,
    s3Helpers: {
      s3: S3Client;
      bucketName: string;
      resolvePublicUrl: (key: string) => string;
    },
    options?: {
      title?: string;
      reciterId?: string;
      categoryId?: string;
      bitrate?: string;
    }
  ): Promise<Track | null> {
    const tempId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const tempDir = path.join(os.tmpdir(), `ytdl_monitor_${tempId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const ytdlBinary = getYtDlpPath();
    const selectedBitrate = options?.bitrate === '128' ? '128k' : '320k';
    const args = [
      '-x',
      '--audio-format',
      'mp3',
      '--audio-quality',
      selectedBitrate,
      '-o',
      `${tempDir}/audio.%(ext)s`,
      '--write-thumbnail',
      '-o',
      `thumbnail:${tempDir}/thumb.%(ext)s`,
      '--no-playlist',
      '--no-check-certificates',
      '--max-filesize',
      '150M',
    ];

    if (hasCookies()) {
      args.push('--cookies', YOUTUBE_COOKIES_PATH);
    } else {
      args.push('--extractor-args', 'youtube:player_client=android,web');
    }

    const nodeBinaryPath = process.execPath || '/usr/local/bin/node';
    args.push('--js-runtimes', `node:${nodeBinaryPath}`);
    args.push(video.url);

    try {
      await execFileAsync(ytdlBinary, args, {
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });

      const files = fs.readdirSync(tempDir);
      const audioFileName = files.find((f) => f.endsWith('.mp3'));
      if (!audioFileName) return null;

      const audioBuf = fs.readFileSync(path.join(tempDir, audioFileName));
      const fileSizeMb = parseFloat((audioBuf.length / (1024 * 1024)).toFixed(2));

      const finalTrackTitle = options?.title || video.title;
      const safeSlug = finalTrackTitle
        .replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_')
        .slice(0, 40);
      const s3AudioKey = `incoming/youtube/${Date.now()}_${safeSlug}.mp3`;

      // Upload Audio to ArvanCloud S3
      await s3Helpers.s3.send(
        new PutObjectCommand({
          Bucket: s3Helpers.bucketName,
          Key: s3AudioKey,
          Body: audioBuf,
          ContentType: 'audio/mpeg',
          CacheControl: 'public, max-age=31536000',
          ACL: 'public-read',
        })
      );
      const publicAudioUrl = s3Helpers.resolvePublicUrl(s3AudioKey);

      // Upload Cover if available
      let publicCoverUrl = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
      const thumbFileName = files.find((f) => f.startsWith('thumb.'));
      if (thumbFileName) {
        try {
          const thumbBuf = fs.readFileSync(path.join(tempDir, thumbFileName));
          const thumbExt = path.extname(thumbFileName).toLowerCase() || '.jpg';
          const thumbKey = `incoming/covers/${Date.now()}_thumb${thumbExt}`;
          await s3Helpers.s3.send(
            new PutObjectCommand({
              Bucket: s3Helpers.bucketName,
              Key: thumbKey,
              Body: thumbBuf,
              ContentType: thumbExt === '.webp' ? 'image/webp' : 'image/jpeg',
              CacheControl: 'public, max-age=31536000',
              ACL: 'public-read',
            })
          );
          publicCoverUrl = s3Helpers.resolvePublicUrl(thumbKey);
        } catch (_) {}
      }

      // Resolve reciter & category
      const targetReciterId = options?.reciterId || channel.defaultReciterId || 'rec-karimi';
      const reciter = localDb.getReciters().find((r) => r.id === targetReciterId);
      const targetCategoryId = options?.categoryId || channel.defaultCategoryId || 'cat-moharram';
      const category = localDb.getCategories().find((c) => c.id === targetCategoryId);

      const newTrack: Track = {
        id: `track-yt-${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: finalTrackTitle,
        reciterId: targetReciterId,
        reciterName: reciter?.name || 'مداح منتخب',
        categoryId: targetCategoryId,
        categoryName: category?.name || 'محرم و عاشورا',
        duration: video.duration || 240,
        audioUrl: publicAudioUrl,
        coverUrl: publicCoverUrl,
        fileSizeMb,
        bitrate: selectedBitrate === '128k' ? '128 kbps' : '320 kbps',
        lyrics: [],
        status: channel.autoApprove ? 'approved' : 'pending',
        sourceType: 'youtube',
        sourceUrl: video.url,
        sourceChannelName: channel.channelName,
        playCount: 0,
        createdAt: `پایش یوتیوب (${new Date().toLocaleDateString('fa-IR')})`,
        s3Key: s3AudioKey,
        tags: ['پایش یوتیوب', channel.channelName, reciter?.name || 'مداحی'],
      };

      if (channel.autoApprove) {
        localDb.addTrack(newTrack);
      } else {
        localDb.addToQueue(newTrack);
      }

      return newTrack;
    } finally {
      if (fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (_) {}
      }
    }
  }

  public async scanAllMonitored(
    s3Helpers?: {
      s3: S3Client;
      bucketName: string;
      resolvePublicUrl: (key: string) => string;
    }
  ): Promise<{
    channelsScanned: number;
    newTracksAdded: number;
    newDiscoveredCount: number;
    discoveredVideos: DiscoveredVideo[];
    results: ScanResult[];
  }> {
    const channels = localDb.getYoutubeChannels().filter((c) => c.isMonitored);
    const results: ScanResult[] = [];
    let totalProcessed = 0;
    let totalDiscovered = 0;

    for (const channel of channels) {
      try {
        const res = await this.scanSingleChannel(channel.id, s3Helpers);
        results.push(res);
        totalProcessed += res.newVideosProcessed;
        totalDiscovered += res.newDiscovered.length;
      } catch (err: any) {
        results.push({
          channelId: channel.id,
          channelName: channel.channelName,
          channelHandle: channel.channelHandle,
          totalFound: 0,
          newVideosProcessed: 0,
          newDiscovered: [],
          discoveredVideos: localDb.getDiscoveredVideos(),
          extractedTracks: [],
          errors: [err.message || String(err)],
          scanTimestamp: new Date().toISOString(),
        });
      }
    }

    this.lastSummary = {
      channelsScanned: channels.length,
      newTracksAdded: totalProcessed,
      newDiscoveredCount: totalDiscovered,
      timestamp: new Date().toISOString(),
    };

    return {
      channelsScanned: channels.length,
      newTracksAdded: totalProcessed,
      newDiscoveredCount: totalDiscovered,
      discoveredVideos: localDb.getDiscoveredVideos(),
      results,
    };
  }

  public startAutoMonitoring(
    intervalMinutes: number = 30,
    s3Getter?: () => {
      s3: S3Client;
      bucketName: string;
      resolvePublicUrl: (key: string) => string;
    } | null
  ) {
    this.intervalMinutes = Math.max(5, intervalMinutes);
    this.autoScanEnabled = true;

    if (this.timer) {
      clearInterval(this.timer);
    }

    console.log(`[YouTubeMonitor] Auto-monitoring started (every ${this.intervalMinutes} minutes)`);

    this.timer = setInterval(async () => {
      try {
        const helpers = s3Getter ? s3Getter() : null;
        if (helpers) {
          console.log('[YouTubeMonitor] Running scheduled channel scan...');
          await this.scanAllMonitored(helpers);
        }
      } catch (err) {
        console.warn('[YouTubeMonitor] Scheduled scan warning:', err);
      }
    }, this.intervalMinutes * 60 * 1000);
  }

  public stopAutoMonitoring() {
    this.autoScanEnabled = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[YouTubeMonitor] Auto-monitoring stopped');
  }

  public getStatus(): MonitorStatus {
    return {
      isScanning: this.isScanning,
      activeChannelName: this.activeChannelName,
      lastScanAt: this.lastScanAt,
      autoScanEnabled: this.autoScanEnabled,
      intervalMinutes: this.intervalMinutes,
      discoveredCount: localDb.getDiscoveredVideos().length,
      lastScanSummary: this.lastSummary,
    };
  }
}

export const youtubeMonitor = new YouTubeMonitoringService();
