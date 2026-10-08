import fs from 'fs';
import path from 'path';

export interface LyricLine {
  id: string;
  time: number;
  textArabic: string;
  textPersian: string;
}

export type TrackStatus = 'approved' | 'pending' | 'rejected';
export type TrackSourceType = 'youtube' | 'telegram' | 'web_url' | 'manual_upload';

export interface Track {
  id: string;
  title: string;
  reciterId: string;
  reciterName: string;
  reciterAvatar?: string;
  categoryId: string;
  categoryName: string;
  occasion?: string;
  duration: number;
  audioUrl: string;
  coverUrl: string;
  fileSizeMb: number;
  bitrate: string;
  lyrics: LyricLine[];
  status: TrackStatus;
  sourceType?: TrackSourceType;
  sourceUrl?: string;
  sourceChannelName?: string;
  sourceTelegramChannel?: string;
  sourceTelegramMsgId?: number;
  playCount: number;
  createdAt: string;
  s3Key: string;
  tags: string[];
  isFavorite?: boolean;
}

export interface Reciter {
  id: string;
  name: string;
  title: string;
  bio: string;
  avatarUrl: string;
  tracksCount: number;
  style: string;
  accentColor: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  iconName: string;
  tracksCount: number;
  description: string;
}

export interface YouTubeChannelSource {
  id: string;
  channelName: string;
  channelHandle: string;
  channelUrl: string;
  isMonitored: boolean;
  lastCheckedAt: string;
  totalExtracted: number;
  defaultReciterId: string;
  defaultCategoryId: string;
  autoApprove: boolean;
}

export interface TelegramSource {
  id: string;
  channelUsername: string;
  channelTitle: string;
  isMonitored: boolean;
  lastScrapedAt: string;
  totalExtracted: number;
  autoApprove: boolean;
  categoryDefault: string;
}

export interface ScraperLog {
  id: string;
  timestamp: string;
  channel: string;
  message: string;
  level: 'info' | 'success' | 'warn' | 'error';
}

export interface BotConfig {
  token: string;
  username: string;
  name: string;
  targetChannel: string;
  adminIds: string;
  welcomeMessage: string;
  channelCaptionTemplate: string;
  autoPublishApproved: boolean;
  botActive: boolean;
  lastTestedAt: string | null;
}

export interface DiscoveredVideo {
  id: string;
  channelId?: string;
  channelName: string;
  channelHandle?: string;
  title: string;
  duration: number;
  url: string;
  embedUrl: string;
  thumbnailUrl: string;
  discoveredAt: string;
  defaultReciterId?: string;
  defaultCategoryId?: string;
}

export interface AppDatabase {
  version: number;
  lastUpdated: string;
  tracks: Track[];
  pendingQueue: Track[];
  discoveredVideos?: DiscoveredVideo[];
  reciters: Reciter[];
  categories: Category[];
  youtubeChannels: YouTubeChannelSource[];
  telegramSources: TelegramSource[];
  botConfig: BotConfig;
  logs: ScraperLog[];
  stats: {
    totalPlays: number;
    totalExtractions: number;
  };
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'db.json');

// Ensure data folder exists
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (_) {}

// Default Seeds
const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'cat-all',
    name: 'همه آثار',
    slug: 'all',
    iconName: 'Sparkles',
    tracksCount: 24,
    description: 'تمامی نواها و قطعات صوتی مذهبی',
  },
  {
    id: 'cat-ziyarat',
    name: 'ادعیه و زیارات',
    slug: 'ziyarat',
    iconName: 'BookOpen',
    tracksCount: 12,
    description: 'زیارت عاشورا، دعای توسل، دعای کمیل، عهد و ندبه',
  },
  {
    id: 'cat-munajat',
    name: 'مناجات و خلوت',
    slug: 'munajat',
    iconName: 'Moon',
    tracksCount: 8,
    description: 'مناجات شعبانیه، جوشن کبیر، افتتاح و مناجات خمسه عشر',
  },
  {
    id: 'cat-moharram',
    name: 'محرم و عاشورا',
    slug: 'moharram',
    iconName: 'Flame',
    tracksCount: 15,
    description: 'شور، واحد، زمینه و روضه‌های ایام محرم و صفر',
  },
  {
    id: 'cat-fatemiyeh',
    name: 'فاطمیه',
    slug: 'fatemiyeh',
    iconName: 'HeartHandshake',
    tracksCount: 6,
    description: 'مراثی و سوگواری ایام شهادت حضرت فاطمه زهرا (س)',
  },
  {
    id: 'cat-karbala',
    name: 'شوق و دلتنگی کربلا',
    slug: 'karbala',
    iconName: 'Compass',
    tracksCount: 9,
    description: 'نواهای دلتنگی حرم مطهر و پیاده‌روی اربعین حسینی',
  },
];

const DEFAULT_RECITERS: Reciter[] = [
  {
    id: 'rec-karimi',
    name: 'محمود کریمی',
    title: 'حاج محمود کریمی',
    bio: 'از برجسته‌ترین و نام‌آشناترین مداحان اهل بیت (ع) با اجراهای ماندگار در هیئت رایه العباس (ع).',
    avatarUrl: '',
    tracksCount: 8,
    style: 'شور، زمینه و روضه اصیل',
    accentColor: '#10b981',
  },
  {
    id: 'rec-motiee',
    name: 'میثم مطیعی',
    title: 'دکتر حاج میثم مطیعی',
    bio: 'مداح اهل بیت (ع) و استاد دانشگاه، شناخته‌شده با نوحه‌های حماسی، بین‌المللی و ادعیه‌خوانی فاخر.',
    avatarUrl: '',
    tracksCount: 6,
    style: 'حماسی، نجوا و ادعیه',
    accentColor: '#0ea5e9',
  },
  {
    id: 'rec-banifatemeh',
    name: 'سید مجید بنی‌فاطمه',
    title: 'سید مجید بنی‌فاطمه',
    bio: 'مداح صاحب سبک هیئت ریحانه الحسین (ع) با سوز دلنشین و شورهای آرامش‌بخش.',
    avatarUrl: '',
    tracksCount: 5,
    style: 'شور احساسی و نوحه',
    accentColor: '#8b5cf6',
  },
  {
    id: 'rec-farahmand',
    name: 'محسن فرهمند',
    title: 'استاد محسن فرهمند آزاد',
    bio: 'قاری و ادعیه‌خوان برجسته با تلاوت ماندگار زیارت عاشورا و دعای عهد و مجیر.',
    avatarUrl: '',
    tracksCount: 7,
    style: 'ادعیه و زیارات با صوت محزون و دقیق',
    accentColor: '#f59e0b',
  },
  {
    id: 'rec-taheri',
    name: 'حسین طاهری',
    title: 'کربلایی حسین طاهری',
    bio: 'از مداحان نسل جوان هیئت فدائیان حضرت زهرا (س) با شورهای پرانرژی و سرودهای مذهبی.',
    avatarUrl: '',
    tracksCount: 4,
    style: 'شور جوان‌پسند و حماسی',
    accentColor: '#ec4899',
  },
  {
    id: 'rec-rasouli',
    name: 'مهدی رسولی',
    title: 'حاج مهدی رسولی',
    bio: 'مداح نامدار هیئت ثارالله زنجان، صاحب آثار ویژه به زبان‌های ترکی و فارسی.',
    avatarUrl: '',
    tracksCount: 5,
    style: 'زمینه ترکی و فارسی حماسی',
    accentColor: '#14b8a6',
  },
  {
    id: 'rec-samavati',
    name: 'مهدی سماواتی',
    title: 'حاج مهدی سماواتی',
    bio: 'استاد باسابقه ادعیه و زیارات با نوای دلنشین و سوزناک سحرهای ماه مبارک رمضان.',
    avatarUrl: '',
    tracksCount: 6,
    style: 'مناجات‌خوانی سنتی و ادعیه',
    accentColor: '#6366f1',
  },
];

const DEFAULT_TRACKS: Track[] = [
  {
    id: 'track-1',
    title: 'زیارت عاشورا (قرائت کامل و فراز به فراز)',
    reciterId: 'rec-farahmand',
    reciterName: 'استاد محسن فرهمند',
    categoryId: 'cat-ziyarat',
    categoryName: 'ادعیه و زیارات',
    occasion: 'زیارت روزانه و ایام محرم',
    duration: 1140,
    audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3',
    coverUrl: '',
    fileSizeMb: 17.4,
    bitrate: '128 kbps',
    status: 'approved',
    playCount: 14280,
    createdAt: '1403/07/15',
    s3Key: 'audio/farahmand/ziyarat-ashura-full.mp3',
    tags: ['زیارت عاشورا', 'فرهمند', 'امام حسین', 'ادعیه'],
    lyrics: [
      {
        id: 'l1',
        time: 0,
        textArabic: 'اَلسَّلامُ عَلَيْكَ يا اَبا عَبْدِاللهِ، اَلسَّلامُ عَلَيْكَ يَابْنَ رَسُولِ اللهِ',
        textPersian: 'سلام بر تو ای اباعبدالله، سلام بر تو ای فرزند رسول خدا',
      },
    ],
  },
  {
    id: 'track-2',
    title: 'نوحه مشهور: ای ماه منیر بنی‌هاشم',
    reciterId: 'rec-karimi',
    reciterName: 'حاج محمود کریمی',
    categoryId: 'cat-moharram',
    categoryName: 'محرم و عاشورا',
    occasion: 'شب نهم محرم (تاسوعا)',
    duration: 380,
    audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/2.mp3',
    coverUrl: '',
    fileSizeMb: 5.8,
    bitrate: '320 kbps',
    status: 'approved',
    playCount: 28410,
    createdAt: '1403/05/20',
    s3Key: 'audio/karimi/mah-monir.mp3',
    tags: ['محمود کریمی', 'تاسوعا', 'حضرت عباس'],
    lyrics: [],
  },
  {
    id: 'track-3',
    title: 'مناجات منظوم امیرالمؤمنین (ع)',
    reciterId: 'rec-samavati',
    reciterName: 'حاج مهدی سماواتی',
    categoryId: 'cat-munajat',
    categoryName: 'مناجات و خلوت',
    occasion: 'سحرهای ماه مبارک رمضان',
    duration: 620,
    audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/3.mp3',
    coverUrl: '',
    fileSizeMb: 9.5,
    bitrate: '128 kbps',
    status: 'approved',
    playCount: 9150,
    createdAt: '1403/01/10',
    s3Key: 'audio/samavati/monajat-manzoom.mp3',
    tags: ['سماواتی', 'مناجات', 'رمضان'],
    lyrics: [],
  },
];

const DEFAULT_PENDING_QUEUE: Track[] = [
  {
    id: 'queue-yt-1',
    title: 'شور طوفانی: حیدر حیدر اول و آخر حیدر (کیفیت استودیویی ۳۲۰)',
    reciterId: 'rec-karimi',
    reciterName: 'حاج محمود کریمی',
    categoryId: 'cat-moharram',
    categoryName: 'محرم و عاشورا',
    occasion: 'شب بیست و یکم ماه رمضان',
    duration: 380,
    audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/112.mp3',
    coverUrl: '',
    fileSizeMb: 8.7,
    bitrate: '320 kbps',
    status: 'pending',
    sourceType: 'youtube',
    sourceChannelName: 'پایگاه فطرس (@Fotros_ir)',
    sourceUrl: 'https://youtube.com/watch?v=sample_karimi_yt',
    playCount: 0,
    createdAt: 'همین الان (پایش خودکار یوتیوب)',
    s3Key: 'incoming/youtube/fotros_haidar_320.mp3',
    tags: ['محمود کریمی', 'یوتیوب', 'شور', 'رمضان'],
    lyrics: [],
  },
  {
    id: 'queue-1',
    title: 'شور حماسی: ای اهل حرم میر و علمدار نیامد',
    reciterId: 'rec-taheri',
    reciterName: 'حسین طاهری',
    categoryId: 'cat-moharram',
    categoryName: 'محرم و عاشورا',
    occasion: 'شب عاشورا و تاسوعا',
    duration: 320,
    audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/114.mp3',
    coverUrl: '',
    fileSizeMb: 5.1,
    bitrate: '128 kbps',
    status: 'pending',
    sourceTelegramChannel: '@fotros_ir',
    sourceTelegramMsgId: 14290,
    playCount: 0,
    createdAt: 'همین الان (ربات تلگرام)',
    s3Key: 'incoming/bot_extract_14290.mp3',
    tags: ['حسین طاهری', 'ابالفضل العباس', 'شور', 'تاسوعا'],
    lyrics: [
      {
        id: 'pq1',
        time: 0,
        textArabic: 'ای ماه منیر بنی‌هاشم، علمدار دلاور حرم',
        textPersian: 'ای ماه منیر بنی‌هاشم، علمدار دلاور حرم',
      },
    ],
  },
  {
    id: 'queue-2',
    title: 'مناجات شعبانیه با صدای محزون شبانه',
    reciterId: 'rec-samavati',
    reciterName: 'حاج مهدی سماواتی',
    categoryId: 'cat-munajat',
    categoryName: 'مناجات و خلوت',
    occasion: 'ماه معظم شعبان',
    duration: 890,
    audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/55.mp3',
    coverUrl: '',
    fileSizeMb: 14.2,
    bitrate: '128 kbps',
    status: 'pending',
    sourceTelegramChannel: '@nohe_archive',
    sourceTelegramMsgId: 8841,
    playCount: 0,
    createdAt: '۲ ساعت پیش (ربات تلگرام)',
    s3Key: 'incoming/bot_extract_8841.mp3',
    tags: ['مناجات شعبانیه', 'سماواتی', 'شعبان'],
    lyrics: [],
  },
];

const DEFAULT_TELEGRAM_SOURCES: TelegramSource[] = [
  {
    id: 'src-1',
    channelUsername: '@fotros_ir',
    channelTitle: 'پایگاه اطلاع‌رسانی آثار حاج محمود کریمی',
    isMonitored: true,
    lastScrapedAt: '۱۰ دقیقه پیش',
    totalExtracted: 184,
    autoApprove: false,
    categoryDefault: 'cat-moharram',
  },
  {
    id: 'src-2',
    channelUsername: '@meysammotiee',
    channelTitle: 'کانال رسمی دکتر حاج میثم مطیعی',
    isMonitored: true,
    lastScrapedAt: '۳۵ دقیقه پیش',
    totalExtracted: 96,
    autoApprove: false,
    categoryDefault: 'cat-karbala',
  },
  {
    id: 'src-3',
    channelUsername: '@nohe_archive',
    channelTitle: 'آرشیو جامع ادعیه، مناجات و مراثی مذهبی',
    isMonitored: true,
    lastScrapedAt: '۱ ساعت پیش',
    totalExtracted: 412,
    autoApprove: false,
    categoryDefault: 'cat-ziyarat',
  },
];

const DEFAULT_YOUTUBE_CHANNELS: YouTubeChannelSource[] = [
  {
    id: 'yt-1',
    channelName: 'پایگاه اطلاع‌رسانی فطرس (حاج محمود کریمی)',
    channelHandle: '@Fotros_ir',
    channelUrl: 'https://youtube.com/@Fotros_ir',
    isMonitored: true,
    lastCheckedAt: '۱۰ دقیقه پیش',
    totalExtracted: 64,
    defaultReciterId: 'rec-karimi',
    defaultCategoryId: 'cat-moharram',
    autoApprove: false,
  },
  {
    id: 'yt-2',
    channelName: 'کانال مداحی‌های حاج میثم مطیعی (یا ابا عبدالله)',
    channelHandle: '@yaabaabdillah',
    channelUrl: 'https://www.youtube.com/channel/UCSmLsAe1MnJKPfMEUEJq7ag',
    isMonitored: true,
    lastCheckedAt: 'همین الان',
    totalExtracted: 48,
    defaultReciterId: 'rec-motiee',
    defaultCategoryId: 'cat-ziyarat',
    autoApprove: false,
  },
];

const DEFAULT_BOT_CONFIG: BotConfig = {
  token: process.env.TELEGRAM_BOT_TOKEN || '',
  username: process.env.TELEGRAM_BOT_USERNAME || '',
  name: 'ربات مداحی و ادعیه',
  targetChannel: process.env.TELEGRAM_TARGET_CHANNEL || '@madahi_channel',
  adminIds: process.env.TELEGRAM_ADMIN_IDS || '',
  welcomeMessage:
    'سلام و درود! به سامانه جامع مداحی، مراثی و ادعیه خوش آمدید.\nجهت جستجوی اثر، نام مداح، مناسبت یا بخشی از متن شعر را ارسال نمایید.',
  channelCaptionTemplate:
    '🎙 {title}\n👤 با نوای: {reciter}\n📁 دسته: {category}\n⏱ مدت زمان: {duration}\n\n🆔 {channel}',
  autoPublishApproved: false,
  botActive: false,
  lastTestedAt: null,
};

const DEFAULT_LOGS: ScraperLog[] = [
  {
    id: 'log-init-1',
    timestamp: new Date().toLocaleTimeString('fa-IR'),
    channel: 'دیتابیس محلی',
    message: 'دیتابیس مستقل محلی با موفقیت راه‌اندازی و بارگذاری شد.',
    level: 'success',
  },
];

const createInitialDb = (): AppDatabase => {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    tracks: DEFAULT_TRACKS,
    pendingQueue: DEFAULT_PENDING_QUEUE,
    discoveredVideos: [],
    reciters: DEFAULT_RECITERS,
    categories: DEFAULT_CATEGORIES,
    youtubeChannels: DEFAULT_YOUTUBE_CHANNELS,
    telegramSources: DEFAULT_TELEGRAM_SOURCES,
    botConfig: DEFAULT_BOT_CONFIG,
    logs: DEFAULT_LOGS,
    stats: {
      totalPlays: 51840,
      totalExtractions: 3,
    },
  };
};

class LocalDatabase {
  private db: AppDatabase;

  constructor() {
    this.db = this.loadFromDisk();
  }

  private loadFromDisk(): AppDatabase {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.tracks) && Array.isArray(parsed.reciters)) {
          // Fill in any missing properties gracefully
          if (!parsed.botConfig) parsed.botConfig = DEFAULT_BOT_CONFIG;
          if (!Array.isArray(parsed.pendingQueue)) parsed.pendingQueue = [];
          if (!Array.isArray(parsed.discoveredVideos)) parsed.discoveredVideos = [];
          if (!Array.isArray(parsed.categories)) parsed.categories = DEFAULT_CATEGORIES;
          if (!Array.isArray(parsed.youtubeChannels)) parsed.youtubeChannels = DEFAULT_YOUTUBE_CHANNELS;
          if (!Array.isArray(parsed.telegramSources)) parsed.telegramSources = DEFAULT_TELEGRAM_SOURCES;
          if (!Array.isArray(parsed.logs)) parsed.logs = [];
          if (!parsed.stats) parsed.stats = { totalPlays: 0, totalExtractions: 0 };
          return parsed;
        }
      }
    } catch (err) {
      console.error('[Database] Failed to read db.json, generating default:', err);
    }

    const fresh = createInitialDb();
    this.saveToDisk(fresh);
    return fresh;
  }

  private saveToDisk(data: AppDatabase) {
    try {
      data.lastUpdated = new Date().toISOString();
      const tmpFile = `${DB_FILE_PATH}.tmp_${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmpFile, DB_FILE_PATH);
    } catch (err) {
      console.error('[Database] Error saving to disk:', err);
    }
  }

  public getAll(): AppDatabase {
    return this.db;
  }

  public getTracks(): Track[] {
    return this.db.tracks;
  }

  public addTrack(track: Track): Track {
    this.db.tracks.unshift(track);
    this.updateReciterAndCategoryCount(track.reciterId, track.categoryId, +1);
    this.saveToDisk(this.db);
    return track;
  }

  public updateTrack(id: string, updates: Partial<Track>): Track | null {
    const idx = this.db.tracks.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.db.tracks[idx] = { ...this.db.tracks[idx], ...updates };
    this.saveToDisk(this.db);
    return this.db.tracks[idx];
  }

  public deleteTrack(id: string): boolean {
    const track = this.db.tracks.find((t) => t.id === id);
    if (!track) return false;
    this.db.tracks = this.db.tracks.filter((t) => t.id !== id);
    this.updateReciterAndCategoryCount(track.reciterId, track.categoryId, -1);
    this.saveToDisk(this.db);
    return true;
  }

  public getPendingQueue(): Track[] {
    return this.db.pendingQueue;
  }

  public addToQueue(item: Track): Track {
    // Check if duplicate id
    const existingIdx = this.db.pendingQueue.findIndex((q) => q.id === item.id);
    if (existingIdx !== -1) {
      this.db.pendingQueue[existingIdx] = item;
    } else {
      this.db.pendingQueue.unshift(item);
    }
    this.db.stats.totalExtractions = (this.db.stats.totalExtractions || 0) + 1;
    this.saveToDisk(this.db);
    return item;
  }

  public updateQueueItem(id: string, updates: Partial<Track>): Track | null {
    const idx = this.db.pendingQueue.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    this.db.pendingQueue[idx] = { ...this.db.pendingQueue[idx], ...updates };
    this.saveToDisk(this.db);
    return this.db.pendingQueue[idx];
  }

  public deleteQueueItem(id: string): boolean {
    const initialLen = this.db.pendingQueue.length;
    this.db.pendingQueue = this.db.pendingQueue.filter((q) => q.id !== id);
    if (this.db.pendingQueue.length !== initialLen) {
      this.saveToDisk(this.db);
      return true;
    }
    return false;
  }

  public approveQueueItem(id: string, overrides?: Partial<Track>): Track | null {
    // Try by exact ID
    let itemIdx = this.db.pendingQueue.findIndex((q) => q.id === id);

    // Fallback: search by partial ID, sourceUrl, or s3Key
    if (itemIdx === -1 && id) {
      itemIdx = this.db.pendingQueue.findIndex(
        (q) =>
          q.id.includes(id) ||
          id.includes(q.id) ||
          (q.sourceUrl && id.includes(q.sourceUrl)) ||
          (q.s3Key && id.includes(q.s3Key))
      );
    }

    if (itemIdx === -1) return null;

    const [item] = this.db.pendingQueue.splice(itemIdx, 1);
    const approvedTrack: Track = {
      ...item,
      ...overrides,
      status: 'approved',
      createdAt: overrides?.createdAt || new Date().toLocaleDateString('fa-IR'),
    };

    // Remove any existing duplicate in tracks before adding
    this.db.tracks = this.db.tracks.filter((t) => t.id !== approvedTrack.id && t.s3Key !== approvedTrack.s3Key);
    this.db.tracks.unshift(approvedTrack);
    this.updateReciterAndCategoryCount(approvedTrack.reciterId, approvedTrack.categoryId, +1);

    this.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      channel: 'پنل مدیریت',
      message: `قطعه «${approvedTrack.title}» با موفقیت تأیید و به فهرست اصلی افزوده شد.`,
      level: 'success',
    });

    this.saveToDisk(this.db);
    return approvedTrack;
  }

  public approveQueueItemWithFallback(
    id: string,
    overrides?: Partial<Track>,
    payloadTrack?: Partial<Track>
  ): Track {
    const existing = this.approveQueueItem(id, overrides);
    if (existing) return existing;

    // Fallback when item was not in server queue (e.g. client-only queue item)
    const fallbackId = payloadTrack?.id || id || `track-${Date.now()}`;
    const defaultRec = this.db.reciters[0];
    const defaultCat = this.db.categories[1] || this.db.categories[0];

    const approvedTrack: Track = {
      id: fallbackId,
      title: overrides?.title || payloadTrack?.title || 'نوای تایید شده',
      reciterId: overrides?.reciterId || payloadTrack?.reciterId || defaultRec?.id || 'rec-karimi',
      reciterName: overrides?.reciterName || payloadTrack?.reciterName || defaultRec?.name || 'مداح منتخب',
      categoryId: overrides?.categoryId || payloadTrack?.categoryId || defaultCat?.id || 'cat-moharram',
      categoryName: overrides?.categoryName || payloadTrack?.categoryName || defaultCat?.name || 'محرم و عاشورا',
      occasion: overrides?.occasion || payloadTrack?.occasion || 'مداحی و مراثی',
      duration: overrides?.duration || payloadTrack?.duration || 240,
      audioUrl: overrides?.audioUrl || payloadTrack?.audioUrl || '',
      coverUrl: overrides?.coverUrl || payloadTrack?.coverUrl || '',
      fileSizeMb: overrides?.fileSizeMb || payloadTrack?.fileSizeMb || 5.0,
      bitrate: overrides?.bitrate || payloadTrack?.bitrate || '320 kbps',
      status: 'approved',
      sourceType: payloadTrack?.sourceType || 'youtube',
      sourceUrl: payloadTrack?.sourceUrl || '',
      sourceChannelName: payloadTrack?.sourceChannelName || '',
      playCount: 0,
      createdAt: overrides?.createdAt || new Date().toLocaleDateString('fa-IR'),
      s3Key: overrides?.s3Key || payloadTrack?.s3Key || `audio/${Date.now()}.mp3`,
      tags: overrides?.tags || payloadTrack?.tags || ['مداحی'],
      lyrics: overrides?.lyrics || payloadTrack?.lyrics || [],
    };

    // Remove from pendingQueue if any matching item exists
    this.deleteQueueItem(id);
    if (payloadTrack?.id && payloadTrack.id !== id) {
      this.deleteQueueItem(payloadTrack.id);
    }

    this.db.tracks = this.db.tracks.filter((t) => t.id !== approvedTrack.id);
    this.db.tracks.unshift(approvedTrack);
    this.updateReciterAndCategoryCount(approvedTrack.reciterId, approvedTrack.categoryId, +1);

    this.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('fa-IR'),
      channel: 'پنل مدیریت',
      message: `قطعه «${approvedTrack.title}» با موفقیت در پایگاه داده ذخیره و تایید شد.`,
      level: 'success',
    });

    this.saveToDisk(this.db);
    return approvedTrack;
  }

  public getDiscoveredVideos(): DiscoveredVideo[] {
    return this.db.discoveredVideos || [];
  }

  public addDiscoveredVideos(videos: DiscoveredVideo[]): DiscoveredVideo[] {
    if (!this.db.discoveredVideos) this.db.discoveredVideos = [];
    let addedCount = 0;
    for (const v of videos) {
      if (!this.db.discoveredVideos.some((existing) => existing.id === v.id)) {
        this.db.discoveredVideos.unshift(v);
        addedCount++;
      }
    }
    if (addedCount > 0) {
      this.saveToDisk(this.db);
    }
    return this.db.discoveredVideos;
  }

  public removeDiscoveredVideo(id: string): boolean {
    if (!this.db.discoveredVideos) return false;
    const initialLen = this.db.discoveredVideos.length;
    this.db.discoveredVideos = this.db.discoveredVideos.filter((v) => v.id !== id);
    if (this.db.discoveredVideos.length !== initialLen) {
      this.saveToDisk(this.db);
      return true;
    }
    return false;
  }

  public clearDiscoveredVideos(): void {
    this.db.discoveredVideos = [];
    this.saveToDisk(this.db);
  }

  public getReciters(): Reciter[] {
    return this.db.reciters;
  }

  public addReciter(reciter: Reciter): Reciter {
    this.db.reciters.push(reciter);
    this.saveToDisk(this.db);
    return reciter;
  }

  public updateReciter(id: string, updates: Partial<Reciter>): Reciter | null {
    const idx = this.db.reciters.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.db.reciters[idx] = { ...this.db.reciters[idx], ...updates };
    // also update reciterName in tracks if name changed
    if (updates.name) {
      this.db.tracks.forEach((t) => {
        if (t.reciterId === id) t.reciterName = updates.name!;
      });
      this.db.pendingQueue.forEach((t) => {
        if (t.reciterId === id) t.reciterName = updates.name!;
      });
    }
    this.saveToDisk(this.db);
    return this.db.reciters[idx];
  }

  public deleteReciter(id: string): boolean {
    const initialLen = this.db.reciters.length;
    this.db.reciters = this.db.reciters.filter((r) => r.id !== id);
    if (this.db.reciters.length !== initialLen) {
      this.saveToDisk(this.db);
      return true;
    }
    return false;
  }

  public getCategories(): Category[] {
    return this.db.categories;
  }

  public addCategory(cat: Category): Category {
    this.db.categories.push(cat);
    this.saveToDisk(this.db);
    return cat;
  }

  public updateCategory(id: string, updates: Partial<Category>): Category | null {
    const idx = this.db.categories.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.db.categories[idx] = { ...this.db.categories[idx], ...updates };
    if (updates.name) {
      this.db.tracks.forEach((t) => {
        if (t.categoryId === id) t.categoryName = updates.name!;
      });
      this.db.pendingQueue.forEach((t) => {
        if (t.categoryId === id) t.categoryName = updates.name!;
      });
    }
    this.saveToDisk(this.db);
    return this.db.categories[idx];
  }

  public deleteCategory(id: string): boolean {
    const initialLen = this.db.categories.length;
    this.db.categories = this.db.categories.filter((c) => c.id !== id);
    if (this.db.categories.length !== initialLen) {
      this.saveToDisk(this.db);
      return true;
    }
    return false;
  }

  public getBotConfig(): BotConfig {
    return this.db.botConfig;
  }

  public updateBotConfig(updates: Partial<BotConfig>): BotConfig {
    this.db.botConfig = { ...this.db.botConfig, ...updates };
    this.saveToDisk(this.db);
    return this.db.botConfig;
  }

  public getYoutubeChannels(): YouTubeChannelSource[] {
    return this.db.youtubeChannels;
  }

  public addYoutubeChannel(ch: YouTubeChannelSource): YouTubeChannelSource {
    this.db.youtubeChannels.push(ch);
    this.saveToDisk(this.db);
    return ch;
  }

  public updateYoutubeChannel(id: string, updates: Partial<YouTubeChannelSource>): YouTubeChannelSource | null {
    const idx = this.db.youtubeChannels.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.db.youtubeChannels[idx] = { ...this.db.youtubeChannels[idx], ...updates };
    this.saveToDisk(this.db);
    return this.db.youtubeChannels[idx];
  }

  public deleteYoutubeChannel(id: string): boolean {
    const initialLen = this.db.youtubeChannels.length;
    this.db.youtubeChannels = this.db.youtubeChannels.filter((c) => c.id !== id);
    if (this.db.youtubeChannels.length !== initialLen) {
      this.saveToDisk(this.db);
      return true;
    }
    return false;
  }

  public getLogs(): ScraperLog[] {
    return this.db.logs;
  }

  public addLog(log: ScraperLog): void {
    this.db.logs.unshift(log);
    if (this.db.logs.length > 200) {
      this.db.logs = this.db.logs.slice(0, 200);
    }
    this.saveToDisk(this.db);
  }

  public clearLogs(): void {
    this.db.logs = [];
    this.saveToDisk(this.db);
  }

  public resetToDefault(): AppDatabase {
    this.db = createInitialDb();
    this.saveToDisk(this.db);
    return this.db;
  }

  public exportJson(): string {
    return JSON.stringify(this.db, null, 2);
  }

  private updateReciterAndCategoryCount(reciterId: string, categoryId: string, delta: number) {
    const reciter = this.db.reciters.find((r) => r.id === reciterId);
    if (reciter) {
      reciter.tracksCount = Math.max(0, (reciter.tracksCount || 0) + delta);
    }
    const cat = this.db.categories.find((c) => c.id === categoryId);
    if (cat) {
      cat.tracksCount = Math.max(0, (cat.tracksCount || 0) + delta);
    }
    const catAll = this.db.categories.find((c) => c.id === 'cat-all');
    if (catAll) {
      catAll.tracksCount = Math.max(0, (catAll.tracksCount || 0) + delta);
    }
  }
}

export const localDb = new LocalDatabase();
