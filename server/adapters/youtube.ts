// server/adapters/youtube.ts
// آداپتور اسکن بهینه کانال‌های یوتیوب با yt-dlp (--flat-playlist)

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { IScanAdapter, DiscoveredItem } from './types.js';
import { Source } from '../db/types.js';
import { trackRepo } from '../db/repos/index.js';
import { candidateService } from '../services/candidateService.js';

const execFileAsync = promisify(execFile);

export class YouTubeAdapter implements IScanAdapter {
  private getYtDlpPath(): string {
    const candidates = [
      process.env.YTDLP_PATH,
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      path.join(process.cwd(), 'node_modules', '.bin', 'yt-dlp'),
    ].filter(Boolean) as string[];

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return 'yt-dlp';
  }

  private getCookiesPath(): string | null {
    const cookiePath = path.join(process.cwd(), 'data', 'youtube_cookies.txt');
    if (fs.existsSync(cookiePath)) {
      return cookiePath;
    }
    return null;
  }

  /**
   * استخراج سریع لیست ویدیوها با --flat-playlist بدون دانلود
   */
  public async scan(source: Source): Promise<DiscoveredItem[]> {
    let targetUrl = source.ref;
    if (targetUrl.startsWith('@')) {
      targetUrl = `https://www.youtube.com/${targetUrl}/videos`;
    } else if (!targetUrl.startsWith('http')) {
      targetUrl = `https://www.youtube.com/channel/${targetUrl}/videos`;
    }

    const ytdl = this.getYtDlpPath();
    const args = [
      '--flat-playlist',
      '--print-json',
      '--playlist-end',
      '15', // حداکثر ۱۵ ویدیوی اخیر جهت سرعت بالا
      '--no-check-certificates',
    ];

    const proxy = process.env.OUTBOUND_PROXY;
    if (proxy) {
      args.push('--proxy', proxy);
    }

    const cookies = this.getCookiesPath();
    if (cookies) {
      args.push('--cookies', cookies);
    }

    args.push(targetUrl);

    try {
      const { stdout } = await execFileAsync(ytdl, args, { timeout: 60000 });
      const lines = stdout.trim().split('\n');
      const items: DiscoveredItem[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          const externalId = json.id || json.url;
          if (externalId) {
            items.push({
              externalId: String(externalId),
              title: json.title || 'ویدیوی یوتیوب',
              url: `https://www.youtube.com/watch?v=${externalId}`,
              duration: json.duration ? Math.round(json.duration) : undefined,
              author: json.channel || json.uploader || source.title,
            });
          }
        } catch (_) {}
      }

      return items;
    } catch (err: any) {
      console.warn(`[YouTubeAdapter] Error flat-scanning ${source.title}:`, err.message);
      return [];
    }
  }

  /**
   * دانلود صوتی و ثبت کاندید در استیجینگ
   */
  public async downloadAndIngest(item: DiscoveredItem, source: Source): Promise<any> {
    // ۱. بررسی تکراری نبودن در دیتابیس
    const existing = trackRepo.findBySource('youtube_channel', item.externalId);
    if (existing) {
      return existing;
    }

    const tempDir = path.join(os.tmpdir(), `yt_scan_${Date.now()}_${item.externalId}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const ytdl = this.getYtDlpPath();
      const args = [
        '-x',
        '--audio-format',
        'mp3',
        '--audio-quality',
        '320k',
        '-o',
        `${tempDir}/audio.%(ext)s`,
        '--no-check-certificates',
      ];

      const proxy = process.env.OUTBOUND_PROXY;
      if (proxy) args.push('--proxy', proxy);

      const cookies = this.getCookiesPath();
      if (cookies) args.push('--cookies', cookies);

      args.push(item.url);

      await execFileAsync(ytdl, args, { timeout: 180000 });

      const files = fs.readdirSync(tempDir);
      const audioFile = files.find((f) => f.endsWith('.mp3'));
      if (!audioFile) {
        throw new Error('فایل صوتی استخراج نشد');
      }

      const audioBuffer = fs.readFileSync(path.join(tempDir, audioFile));

      // ثبت در صف استیجینگ
      const candidate = await candidateService.ingest({
        buffer: audioBuffer,
        title: item.title,
        sourceType: 'youtube_channel',
        sourceExternalId: item.externalId,
        sourceUrl: item.url,
        sourceOwnerName: item.author || source.title,
        reciterId: source.default_reciter_id || undefined,
        categoryId: source.default_category_id || undefined,
        autoPublish: source.auto_publish === 1,
        actor: 'scheduler_youtube',
      });

      return candidate;
    } finally {
      // پاک‌سازی پوشه موقت
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  }
}

export const youtubeAdapter = new YouTubeAdapter();
