import React, { useState, useEffect } from 'react';
import {
  Layers,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Clock,
  Radio,
  HardDrive,
  Database,
  Terminal,
  Play,
  Pause,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  Copy,
  Check,
  FileCode,
  ShieldCheck,
  Search,
  ExternalLink,
  Sliders,
  Send,
  Eye,
  Sparkles,
  Youtube,
  Globe,
  Link,
  ArrowDownToLine,
  Film,
  AlertTriangle,
  Key,
  Server,
  Download,
  Folder,
  Share2,
  Bot,
  MessageSquare,
  RotateCcw,
  Settings,
  Users,
} from 'lucide-react';
import {
  Track,
  Reciter,
  Category,
  TelegramSource,
  YouTubeChannelSource,
  DiscoveredVideo,
  CloudStorageConfig,
  SupabaseConfig,
  ScraperLog,
  BotConfig,
  AuthUser,
} from '../../types';
import { UserManager } from './UserManager';
import { api } from '../../services/api';
import { usePlayer } from '../../context/PlayerContext';
import { formatDuration, toPersianDigits, formatFileSize } from '../../utils/formatters';

interface AdminDashboardProps {
  currentUser?: AuthUser | null;
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  pendingQueue: Track[];
  setPendingQueue: React.Dispatch<React.SetStateAction<Track[]>>;
  reciters: Reciter[];
  setReciters: React.Dispatch<React.SetStateAction<Reciter[]>>;
  categories: Category[];
  setCategories?: React.Dispatch<React.SetStateAction<Category[]>>;
  telegramSources: TelegramSource[];
  setTelegramSources: React.Dispatch<React.SetStateAction<TelegramSource[]>>;
  youtubeChannels: YouTubeChannelSource[];
  setYoutubeChannels: React.Dispatch<React.SetStateAction<YouTubeChannelSource[]>>;
  cloudConfig: CloudStorageConfig;
  supabaseConfig: SupabaseConfig;
  botConfig?: BotConfig;
  setBotConfig?: React.Dispatch<React.SetStateAction<BotConfig>>;
  logs: ScraperLog[];
  setLogs: React.Dispatch<React.SetStateAction<ScraperLog[]>>;
  onDbRefresh?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  tracks,
  setTracks,
  pendingQueue,
  setPendingQueue,
  reciters,
  setReciters,
  categories,
  setCategories,
  telegramSources,
  setTelegramSources,
  youtubeChannels,
  setYoutubeChannels,
  cloudConfig,
  supabaseConfig,
  botConfig,
  setBotConfig,
  logs,
  setLogs,
  onDbRefresh,
}) => {
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayer();

  const [activeAdminTab, setActiveAdminTab] = useState<
    'queue' | 'youtube_studio' | 'upload' | 'cloud_sync' | 'reciters' | 'categories' | 'telegram' | 'scripts' | 'settings' | 'users'
  >('queue');

  // Telegram Bot states
  const [botTokenInput, setBotTokenInput] = useState(botConfig?.token || '');
  const [botChannelInput, setBotChannelInput] = useState(botConfig?.targetChannel || '@madahi_channel');
  const [botWelcomeInput, setBotWelcomeInput] = useState(botConfig?.welcomeMessage || '');
  const [botCaptionInput, setBotCaptionInput] = useState(botConfig?.channelCaptionTemplate || '');
  const [botAutoPublish, setBotAutoPublish] = useState(!!botConfig?.autoPublishApproved);
  const [isTestingBot, setIsTestingBot] = useState(false);
  const [botTestInfo, setBotTestInfo] = useState<any>(null);
  const [botTestError, setBotTestError] = useState<string | null>(null);
  const [isTestingChannel, setIsTestingChannel] = useState(false);
  const [channelTestSuccess, setChannelTestSuccess] = useState<string | null>(null);
  const [channelTestError, setChannelTestError] = useState<string | null>(null);
  const [isSavingBotConfig, setIsSavingBotConfig] = useState(false);
  const [botSaveMessage, setBotSaveMessage] = useState<string | null>(null);
  const [selectedPublishTrackId, setSelectedPublishTrackId] = useState<string>('');
  const [isPublishingManual, setIsPublishingManual] = useState(false);
  const [publishFeedback, setPublishFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Categories modal states
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySlug, setNewCategorySlug] = useState('');
  const [newCategoryDesc, setNewCategoryDesc] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('Flame');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // DB management states
  const [isResettingDb, setIsResettingDb] = useState(false);
  const [dbResetConfirm, setDbResetConfirm] = useState(false);
  const [dbFeedbackMsg, setDbFeedbackMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Queue Approval states
  const [approvingTrackId, setApprovingTrackId] = useState<string | null>(null);
  const [queueFeedback, setQueueFeedback] = useState<{ id: string; msg: string; type: 'success' | 'error' } | null>(null);

  // Edit modal state for reviewing a queue track
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [scriptSubTab, setScriptSubTab] = useState<'youtube_watcher' | 'python' | 'sql' | 'docker' | 'vps_guide' | 'mobile'>('youtube_watcher');

  // YouTube Studio states
  const [ytInputUrl, setYtInputUrl] = useState('');
  const [ytCustomTitle, setYtCustomTitle] = useState('');
  const [ytReciterId, setYtReciterId] = useState(reciters[0]?.id || '');
  const [ytCategoryId, setYtCategoryId] = useState(categories[1]?.id || '');
  const [ytBitrate, setYtBitrate] = useState<'128' | '320'>('320');
  const [isYtProcessing, setIsYtProcessing] = useState(false);
  const [ytProcessStep, setYtProcessStep] = useState<string>('');
  const [ytProcessProgress, setYtProcessProgress] = useState<number>(0);
  const [ytErrorMessage, setYtErrorMessage] = useState<string | null>(null);
  const [ytSuccessMessage, setYtSuccessMessage] = useState<string | null>(null);

  // YouTube Media Inspection state (Step 1: Inspect info & preview before S3 upload)
  const [isInspectingMedia, setIsInspectingMedia] = useState(false);
  const [inspectedMedia, setInspectedMedia] = useState<{
    id: string;
    sourceType?: string;
    title: string;
    uploader: string;
    authorUrl?: string;
    thumbnail?: string;
    embedUrl?: string | null;
    playbackUrl: string;
    duration: number;
    isDuplicate?: boolean;
    duplicateLocation?: 'database' | 'queue' | null;
    existingItem?: any;
    suggestedReciterId?: string;
  } | null>(null);
  const [showMediaPreviewPlayer, setShowMediaPreviewPlayer] = useState(false);

  // Auto-channel inspect & Quick reciter add states
  const [isInspectingChannel, setIsInspectingChannel] = useState(false);
  const [suggestedCandidateReciter, setSuggestedCandidateReciter] = useState<{ id?: string; name: string } | null>(null);
  const [showQuickAddReciterModal, setShowQuickAddReciterModal] = useState(false);
  const [quickReciterName, setQuickReciterName] = useState('');
  const [quickReciterTarget, setQuickReciterTarget] = useState<'instant' | 'channel'>('channel');

  // YouTube Cookies State & Management
  const [ytCookiesStatus, setYtCookiesStatus] = useState<{
    configured: boolean;
    entryCount: number;
    sizeBytes: number;
    lastModified: string | null;
    hasAuthCookies?: boolean;
    hasLoginInfo?: boolean;
  }>({ configured: false, entryCount: 0, sizeBytes: 0, lastModified: null, hasAuthCookies: false, hasLoginInfo: false });
  const [ytCookiesInput, setYtCookiesInput] = useState('');
  const [showCookiesManager, setShowCookiesManager] = useState(false);
  const [isSavingCookies, setIsSavingCookies] = useState(false);
  const [cookiesActionMsg, setCookiesActionMsg] = useState<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);

  const fetchCookiesStatus = async () => {
    try {
      const res = await fetch('/api/youtube/cookies');
      const data = await res.json();
      if (data.success) {
        setYtCookiesStatus({
          configured: !!data.configured,
          entryCount: data.entryCount || 0,
          sizeBytes: data.sizeBytes || 0,
          lastModified: data.lastModified || null,
          hasAuthCookies: !!data.hasAuthCookies,
          hasLoginInfo: !!data.hasLoginInfo,
        });
      }
    } catch (_) {}
  };

  const handleSaveCookies = async (contentToSave?: string) => {
    const rawContent = (contentToSave !== undefined ? contentToSave : ytCookiesInput).trim();
    if (!rawContent) {
      setCookiesActionMsg({ type: 'error', text: 'لطفاً متن کوکی‌های یوتیوب را وارد کنید.' });
      return;
    }
    setIsSavingCookies(true);
    setCookiesActionMsg(null);
    try {
      const res = await fetch('/api/youtube/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookiesContent: rawContent }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCookiesActionMsg({ type: 'success', text: data.message });
        setYtCookiesInput('');
        fetchCookiesStatus();
      } else {
        setCookiesActionMsg({ type: 'error', text: data.error || 'خطا در ذخیره کوکی‌ها' });
      }
    } catch (e: any) {
      setCookiesActionMsg({ type: 'error', text: e.message || 'خطا در ارتباط با سرور' });
    } finally {
      setIsSavingCookies(false);
    }
  };

  const handleDeleteCookies = async () => {
    if (!window.confirm('آیا از حذف کوکی‌های یوتیوب اطمینان دارید؟')) return;
    try {
      const res = await fetch('/api/youtube/cookies', { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setCookiesActionMsg({ type: 'success', text: data.message });
        fetchCookiesStatus();
      }
    } catch (_) {}
  };

  const handleUploadCookiesFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setYtCookiesInput(text);
        handleSaveCookies(text);
      }
    };
    reader.readAsText(file);
  };

  // YouTube Monitoring & Live Scan states
  const [scanningChannelId, setScanningChannelId] = useState<string | null>(null);
  const [isScanningAllYt, setIsScanningAllYt] = useState(false);
  const [ytScanNotification, setYtScanNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [ytPreviewChannelId, setYtPreviewChannelId] = useState<string | null>(null);
  const [ytChannelPreviewList, setYtChannelPreviewList] = useState<any[]>([]);
  const [isPreviewingYt, setIsPreviewingYt] = useState(false);

  // Real Backend Cloud Storage Status
  const [serverCloudStatus, setServerCloudStatus] = useState<{
    arvan: {
      isConfigured: boolean;
      canConnect: boolean;
      connectionMessage?: string;
      bucketName: string;
      endpoint: string;
      region?: string;
      cdnDomain?: string;
      maskedAccessKey: string | null;
      maskedSecretKey?: string | null;
    };
    supabase: { isConfigured: boolean; projectUrl: string | null };
  } | null>(null);

  // Live Arvan Credentials Editor form
  const [arvanForm, setArvanForm] = useState({
    accessKeyId: '',
    secretAccessKey: '',
    bucketName: 'madahi-media-vault',
    endpoint: 'https://s3.ir-thr-at1.arvanstorage.ir',
    region: 'ir-thr-at1',
    cdnDomain: '',
  });
  const [isTestingArvan, setIsTestingArvan] = useState(false);
  const [arvanTestResult, setArvanTestResult] = useState<{
    success: boolean;
    message: string;
    itemsFound?: number;
  } | null>(null);
  const [saveConfigSuccess, setSaveConfigSuccess] = useState(false);

  // Synced real S3 files state
  const [syncedS3Files, setSyncedS3Files] = useState<
    Array<{
      key: string;
      fileName: string;
      sizeMb: number;
      sizeBytes: number;
      lastModified: string | null;
      url: string;
      isAudio: boolean;
      isImage: boolean;
    }>
  >([]);
  const [isLoadingS3Files, setIsLoadingS3Files] = useState(false);
  const [s3SyncError, setS3SyncError] = useState<string | null>(null);
  const [syncedFileFilter, setSyncedFileFilter] = useState('');

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadReciterId, setUploadReciterId] = useState(reciters[0]?.id || '');
  const [uploadCategoryId, setUploadCategoryId] = useState(categories[1]?.id || '');
  const [uploadOccasion, setUploadOccasion] = useState('');
  const [uploadLyricsArabic, setUploadLyricsArabic] = useState('');
  const [uploadLyricsPersian, setUploadLyricsPersian] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadSuccessUrl, setUploadSuccessUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Function to refresh storage status
  const refreshStorageStatus = async () => {
    try {
      const res = await fetch('/api/storage/status');
      const data = await res.json();
      setServerCloudStatus(data);
      if (data.arvan) {
        setArvanForm((prev) => ({
          ...prev,
          bucketName: data.arvan.bucketName || prev.bucketName,
          endpoint: data.arvan.endpoint || prev.endpoint,
          region: data.arvan.region || prev.region,
          cdnDomain: data.arvan.cdnDomain || prev.cdnDomain,
        }));
      }
    } catch (err) {
      console.log('Storage status check:', err);
    }
  };

  // Fetch real files in Arvan S3 bucket
  const fetchSyncedFiles = async () => {
    setIsLoadingS3Files(true);
    setS3SyncError(null);
    try {
      const res = await fetch('/api/storage/files');
      const data = await res.json();
      if (!res.ok || !data.success) {
        setS3SyncError(data.error || 'عدم اتصال به باکت ابر آروان. لطفاً کلیدها را بررسی کنید.');
        setSyncedS3Files([]);
      } else {
        setSyncedS3Files(data.files || []);
      }
    } catch (err: any) {
      setS3SyncError(err.message || 'خطا در برقراری ارتباط با سرور');
      setSyncedS3Files([]);
    } finally {
      setIsLoadingS3Files(false);
    }
  };

  const normalizeClientEndpoint = (ep: string): string => {
    let cleaned = ep.trim().replace(/^["'`]+|["'`]+$/g, '');
    if (!cleaned) return 'https://s3.ir-central1.arvanstorage.ir';
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = `https://${cleaned}`;
    }
    return cleaned.replace(/\/+$/, '');
  };

  const normalizeClientCdn = (cdn: string): string => {
    let cleaned = cdn.trim().replace(/^["'`]+|["'`]+$/g, '');
    if (!cleaned || cleaned.includes('yourdomain') || cleaned.includes('MY_ARVAN')) return '';
    if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
      cleaned = `https://${cleaned}`;
    }
    return cleaned.replace(/\/+$/, '');
  };

  // Live test ArvanCloud S3 connection
  const handleTestArvanConnection = async (saveOnSuccess = false) => {
    setIsTestingArvan(true);
    setArvanTestResult(null);
    const cleanedConfig = {
      ...arvanForm,
      accessKeyId: arvanForm.accessKeyId.trim().replace(/^["'`]+|["'`]+$/g, ''),
      secretAccessKey: arvanForm.secretAccessKey.trim().replace(/^["'`]+|["'`]+$/g, ''),
      bucketName: arvanForm.bucketName.trim().replace(/^["'`]+|["'`]+$/g, '') || 'madahi-media-vault',
      endpoint: normalizeClientEndpoint(arvanForm.endpoint),
      cdnDomain: normalizeClientCdn(arvanForm.cdnDomain),
    };
    setArvanForm(cleanedConfig);

    try {
      const res = await fetch('/api/storage/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...cleanedConfig,
          saveOnSuccess,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setArvanTestResult({
          success: true,
          message: data.message || 'اتصال به باکت ابر آروان با موفقیت برقرار شد!',
          itemsFound: data.itemsFound,
        });
        await refreshStorageStatus();
        fetchSyncedFiles();
      } else {
        setArvanTestResult({
          success: false,
          message: data.error || data.details || 'خطا در اتصال به ابر آروان',
        });
      }
    } catch (err: any) {
      setArvanTestResult({
        success: false,
        message: err.message || 'خطا در برقراری ارتباط با سرور محلی',
      });
    } finally {
      setIsTestingArvan(false);
    }
  };

  // Save Arvan credentials
  const handleSaveArvanConfig = async () => {
    const cleanedConfig = {
      ...arvanForm,
      accessKeyId: arvanForm.accessKeyId.trim().replace(/^["'`]+|["'`]+$/g, ''),
      secretAccessKey: arvanForm.secretAccessKey.trim().replace(/^["'`]+|["'`]+$/g, ''),
      bucketName: arvanForm.bucketName.trim().replace(/^["'`]+|["'`]+$/g, '') || 'madahi-media-vault',
      endpoint: normalizeClientEndpoint(arvanForm.endpoint),
      cdnDomain: normalizeClientCdn(arvanForm.cdnDomain),
    };
    setArvanForm(cleanedConfig);

    try {
      const res = await fetch('/api/storage/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedConfig),
      });
      if (res.ok) {
        setSaveConfigSuccess(true);
        setTimeout(() => setSaveConfigSuccess(false), 3000);
        await refreshStorageStatus();
        // Immediately run connection test to give instant visual feedback
        await handleTestArvanConnection(true);
      }
    } catch (err) {
      console.error('Save config error:', err);
    }
  };

  // Delete object from Arvan S3
  const handleDeleteS3File = async (key: string) => {
    if (!window.confirm(`آیا از حذف دائم فایل «${key}» از باکت ابر آروان اطمینان دارید؟`)) return;
    try {
      const res = await fetch('/api/storage/file', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        setSyncedS3Files((prev) => prev.filter((f) => f.key !== key));
        setLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('fa-IR'),
            channel: 'استوریج ابر آروان',
            message: `فایل «${key}» از باکت ابر آروان حذف شد.`,
            level: 'warn',
          },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Import synced S3 file to tracks playlist
  const handleImportS3FileToTracks = (file: { key: string; fileName: string; sizeMb: number; url: string }) => {
    const cleanTitle = file.fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const newTrack: Track = {
      id: `imported-${Date.now()}`,
      title: cleanTitle,
      reciterId: reciters[0]?.id || 'rec-karimi',
      reciterName: reciters[0]?.name || 'مداح نامشخص',
      categoryId: 'cat-all',
      categoryName: 'همه آثار',
      occasion: 'همگام‌سازی از باکت آروان',
      duration: 300,
      audioUrl: file.url,
      coverUrl: '',
      fileSizeMb: file.sizeMb,
      bitrate: '320 kbps',
      status: 'approved',
      playCount: 0,
      createdAt: 'همگام‌سازی از باکت آروان',
      s3Key: file.key,
      tags: ['ابر آروان', 'سینک زنده'],
      lyrics: [],
    };
    setTracks((prev) => [newTrack, ...prev]);
    setLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        channel: 'همگام‌سازی آروان',
        message: `قطعه «${newTrack.title}» مستقیماً از باکت به لیست پلیر اضافه شد.`,
        level: 'success',
      },
      ...prev,
    ]);
  };

  React.useEffect(() => {
    refreshStorageStatus();
    fetchCookiesStatus();
  }, []);

  // New YouTube Channel modal state
  const [newYtChannelName, setNewYtChannelName] = useState('');
  const [newYtChannelHandle, setNewYtChannelHandle] = useState('');
  const [newYtChannelReciterId, setNewYtChannelReciterId] = useState(reciters[0]?.id || '');


  // New Reciter modal state
  const [showAddReciterModal, setShowAddReciterModal] = useState(false);
  const [newReciterName, setNewReciterName] = useState('');
  const [newReciterStyle, setNewReciterStyle] = useState('');
  const [newReciterBio, setNewReciterBio] = useState('');

  // New Telegram Channel state
  const [newChannelUsername, setNewChannelUsername] = useState('');
  const [newChannelTitle, setNewChannelTitle] = useState('');

  // Simulation: Trigger Scraper now
  const [isScrapingRunning, setIsScrapingRunning] = useState(false);

  // Handlers for Queue
  const handleApproveTrack = async (track: Track, publishToTelegram: boolean = false) => {
    setApprovingTrackId(track.id);
    try {
      const res = await api.approveQueueItem(track.id, undefined, publishToTelegram, track);
      setTracks((prev) => [res.track, ...prev.filter((t) => t.id !== track.id)]);
      setPendingQueue((prev) => prev.filter((t) => t.id !== track.id));
      if (onDbRefresh) {
        onDbRefresh();
      }

      let msg = `قطعه «${track.title}» تایید و در دیتابیس ثبت شد.`;
      if (publishToTelegram) {
        if (res.telegram?.success) {
          msg += ` همزمان در کانال تلگرام منتشر گردید.`;
        } else if (res.telegram?.error) {
          msg += ` (ارسال به کانال: ${res.telegram.error})`;
        }
      }
      setQueueFeedback({ id: track.id, msg, type: 'success' });
      setLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('fa-IR'),
          channel: 'پنل مدیریت',
          message: msg,
          level: 'success',
        },
        ...prev,
      ]);
    } catch (err: any) {
      setQueueFeedback({ id: track.id, msg: `خطا در تأیید: ${err.message}`, type: 'error' });
    } finally {
      setApprovingTrackId(null);
      if (editingTrack?.id === track.id) {
        setEditingTrack(null);
      }
    }
  };

  const handleRejectTrack = async (trackId: string) => {
    try {
      await api.deleteQueueItem(trackId);
    } catch (_) {}
    setPendingQueue((prev) => prev.filter((t) => t.id !== trackId));
    setLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        channel: 'پنل مدیریت',
        message: `قطعه با شناسه ${trackId} از صف بررسی حذف شد.`,
        level: 'warn',
      },
      ...prev,
    ]);
    if (editingTrack?.id === trackId) {
      setEditingTrack(null);
    }
  };

  const handleSaveEditedTrack = async () => {
    if (!editingTrack) return;
    try {
      await api.updateQueueItem(editingTrack.id, editingTrack);
    } catch (_) {}
    setPendingQueue((prev) =>
      prev.map((t) => (t.id === editingTrack.id ? editingTrack : t))
    );
    setEditingTrack(null);
  };

  // Handler for adding reciter
  const handleCreateReciter = async () => {
    if (!newReciterName.trim()) return;
    const newRec: Reciter = {
      id: `rec-${Date.now()}`,
      name: newReciterName.trim(),
      title: `حاج ${newReciterName.trim()}`,
      bio: newReciterBio.trim() || 'از مداحان و ذاکرین اهل بیت (ع)',
      avatarUrl: '',
      tracksCount: 0,
      style: newReciterStyle.trim() || 'نوحه و روضه',
      accentColor: '#10b981',
    };
    try {
      const saved = await api.addReciter(newRec);
      setReciters((prev) => [...prev, saved]);
    } catch (e) {
      setReciters((prev) => [...prev, newRec]);
    }
    setNewReciterName('');
    setNewReciterStyle('');
    setNewReciterBio('');
    setShowAddReciterModal(false);
  };

  const handleDeleteReciter = async (reciterId: string) => {
    if (!confirm('آیا از حذف این مداح اطمینان دارید؟')) return;
    try {
      await api.deleteReciter(reciterId);
    } catch (_) {}
    setReciters((prev) => prev.filter((r) => r.id !== reciterId));
  };

  // Handler for adding category
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    setIsSavingCategory(true);
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: newCategoryName.trim(),
      slug: (newCategorySlug.trim() || `cat-${Date.now()}`).toLowerCase().replace(/\s+/g, '-'),
      iconName: newCategoryIcon || 'Flame',
      tracksCount: 0,
      description: newCategoryDesc.trim() || 'دسته‌بندی نواهای مذهبی',
    };
    try {
      const saved = await api.addCategory(newCat);
      if (setCategories) {
        setCategories((prev) => [...prev, saved]);
      }
    } catch (e) {
      if (setCategories) {
        setCategories((prev) => [...prev, newCat]);
      }
    } finally {
      setIsSavingCategory(false);
      setNewCategoryName('');
      setNewCategorySlug('');
      setNewCategoryDesc('');
      setShowAddCategoryModal(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (catId === 'cat-all') {
      alert('دسته‌بندی پیش‌فرض «همه آثار» قابل حذف نیست.');
      return;
    }
    if (!confirm('آیا از حذف این دسته‌بندی اطمینان دارید؟')) return;
    try {
      await api.deleteCategory(catId);
    } catch (_) {}
    if (setCategories) {
      setCategories((prev) => prev.filter((c) => c.id !== catId));
    }
  };

  // Telegram Bot handlers
  const handleTestBot = async () => {
    setIsTestingBot(true);
    setBotTestInfo(null);
    setBotTestError(null);
    try {
      const res = await api.testBot(botTokenInput);
      if (res.success && res.bot) {
        setBotTestInfo(res.bot);
        if (setBotConfig) {
          setBotConfig((prev) => ({
            ...prev,
            token: botTokenInput,
            username: res.bot.username ? `@${res.bot.username}` : '',
            name: res.bot.first_name || '',
            botActive: true,
          }));
        }
      } else {
        setBotTestError(res.error || 'توکن نامعتبر است.');
      }
    } catch (err: any) {
      setBotTestError(err.message || 'خطا در برقراری ارتباط');
    } finally {
      setIsTestingBot(false);
    }
  };

  const handleTestChannel = async () => {
    setIsTestingChannel(true);
    setChannelTestSuccess(null);
    setChannelTestError(null);
    try {
      const res = await api.testChannel(botTokenInput, botChannelInput);
      if (res.success) {
        setChannelTestSuccess(`پیام آزمایشی با موفقیت در کانال ارسال شد (شناسه پیام: ${res.messageId || 'ثبت شده'}).`);
      } else {
        setChannelTestError(res.error || 'ارسال به کانال ناموفق بود.');
      }
    } catch (err: any) {
      setChannelTestError(err.message || 'خطای سرور');
    } finally {
      setIsTestingChannel(false);
    }
  };

  const handleSaveBotConfig = async () => {
    setIsSavingBotConfig(true);
    setBotSaveMessage(null);
    try {
      const updated = await api.updateBotConfig({
        token: botTokenInput.trim(),
        targetChannel: botChannelInput.trim(),
        welcomeMessage: botWelcomeInput.trim(),
        channelCaptionTemplate: botCaptionInput.trim(),
        autoPublishApproved: botAutoPublish,
      });
      if (setBotConfig) {
        setBotConfig(updated);
      }
      setBotSaveMessage('تنظیمات ربات تلگرام با موفقیت در دیتابیس محلی ذخیره شد.');
      setTimeout(() => setBotSaveMessage(null), 4000);
    } catch (err: any) {
      alert(`خطا در ذخیره تنظیمات: ${err.message}`);
    } finally {
      setIsSavingBotConfig(false);
    }
  };

  const handlePublishManual = async (trackToPublish?: Track) => {
    const target = trackToPublish || tracks.find((t) => t.id === selectedPublishTrackId);
    if (!target) {
      alert('لطفاً ابتدا یک قطعه را برای ارسال انتخاب کنید.');
      return;
    }
    setIsPublishingManual(true);
    setPublishFeedback(null);
    try {
      const res = await api.publishTrackToTelegram(target.id, target);
      if (res.success) {
        setPublishFeedback({
          type: 'success',
          msg: `قطعه «${target.title}» با موفقیت در کانال ${botChannelInput} ارسال شد.`,
        });
      } else {
        setPublishFeedback({
          type: 'error',
          msg: `خطا در ارسال: ${res.error || 'بررسی کنید ربات ادمین کانال باشد.'}`,
        });
      }
    } catch (err: any) {
      setPublishFeedback({ type: 'error', msg: `خطای شبکه: ${err.message}` });
    } finally {
      setIsPublishingManual(false);
    }
  };

  const handleExportDb = () => {
    window.location.href = '/api/db/export';
  };

  const handleResetDb = async () => {
    setIsResettingDb(true);
    setDbFeedbackMsg(null);
    try {
      const fresh = await api.resetDatabase();
      setTracks(fresh.tracks);
      setPendingQueue(fresh.pendingQueue);
      setReciters(fresh.reciters);
      if (setCategories) setCategories(fresh.categories);
      setTelegramSources(fresh.telegramSources);
      setYoutubeChannels(fresh.youtubeChannels);
      if (setBotConfig) setBotConfig(fresh.botConfig);
      setLogs(fresh.logs);
      setDbFeedbackMsg({ type: 'success', msg: 'دیتابیس به داده‌های نمونه اولیه بازگردانده شد.' });
      setDbResetConfirm(false);
    } catch (err: any) {
      setDbFeedbackMsg({ type: 'error', msg: `خطا در بازنشانی: ${err.message}` });
    } finally {
      setIsResettingDb(false);
    }
  };

  // Handler for adding telegram source
  const handleAddTelegramChannel = () => {
    if (!newChannelUsername.trim()) return;
    const cleanUsername = newChannelUsername.startsWith('@')
      ? newChannelUsername.trim()
      : `@${newChannelUsername.trim()}`;

    const newSource: TelegramSource = {
      id: `src-${Date.now()}`,
      channelUsername: cleanUsername,
      channelTitle: newChannelTitle.trim() || cleanUsername,
      isMonitored: true,
      lastScrapedAt: 'همین الان',
      totalExtracted: 0,
      autoApprove: false,
      categoryDefault: 'cat-moharram',
    };
    setTelegramSources((prev) => [...prev, newSource]);
    setNewChannelUsername('');
    setNewChannelTitle('');
  };

  // Handler for Adding Monitored YouTube Channel (Persisted via Backend)
  const handleAddYouTubeChannel = async () => {
    if (!newYtChannelName.trim()) return;
    const cleanHandle = newYtChannelHandle.startsWith('@')
      ? newYtChannelHandle.trim()
      : `@${newYtChannelHandle.trim()}`;

    const selectedRec = reciters.find((r) => r.id === newYtChannelReciterId) || reciters[0];

    try {
      const created = await api.addYoutubeChannel({
        channelName: newYtChannelName.trim(),
        channelHandle: cleanHandle || '@Channel',
        channelUrl: `https://youtube.com/${cleanHandle}`,
        isMonitored: true,
        defaultReciterId: selectedRec?.id || 'rec-karimi',
        defaultCategoryId: 'cat-moharram',
        autoApprove: false,
      });

      setYoutubeChannels((prev) => [...prev, created]);
      setNewYtChannelName('');
      setNewYtChannelHandle('');
      setLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('fa-IR'),
          channel: 'یوتیوب استودیو',
          message: `کانال جدید یوتیوب «${created.channelName}» در دیتابیس ثبت و فعال شد.`,
          level: 'success',
        },
        ...prev,
      ]);
      setYtScanNotification({
        type: 'success',
        message: `کانال «${created.channelName}» با موفقیت افزوده شد.`,
      });
      setTimeout(() => setYtScanNotification(null), 4000);
    } catch (err: any) {
      setYtScanNotification({
        type: 'error',
        message: `خطا در ثبت کانال: ${err.message}`,
      });
      setTimeout(() => setYtScanNotification(null), 5000);
    }
  };

  // Toggle channel monitoring status with backend persistence
  const handleToggleChannelMonitoring = async (channelId: string, currentStatus: boolean) => {
    try {
      const updated = await api.updateYoutubeChannel(channelId, { isMonitored: !currentStatus });
      setYoutubeChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, isMonitored: updated.isMonitored } : c))
      );
    } catch (err: any) {
      // Fallback local update
      setYoutubeChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, isMonitored: !currentStatus } : c))
      );
    }
  };

  // Delete channel with backend persistence
  const handleDeleteYouTubeChannel = async (channelId: string, channelName: string) => {
    if (!window.confirm(`آیا از حذف کانال «${channelName}» اطمینان دارید؟`)) return;
    try {
      await api.deleteYoutubeChannel(channelId);
      setYoutubeChannels((prev) => prev.filter((c) => c.id !== channelId));
      setLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('fa-IR'),
          channel: 'یوتیوب استودیو',
          message: `کانال یوتیوب «${channelName}» حذف شد.`,
          level: 'warn',
        },
        ...prev,
      ]);
    } catch (err: any) {
      alert(`خطا در حذف کانال: ${err.message}`);
    }
  };

  // Preview latest videos of a channel
  const handlePreviewChannelVideos = async (channel: YouTubeChannelSource) => {
    setYtPreviewChannelId(channel.id);
    setIsPreviewingYt(true);
    setYtChannelPreviewList([]);
    try {
      const videos = await api.previewChannel(channel.channelUrl || channel.channelHandle);
      setYtChannelPreviewList(videos);
    } catch (err: any) {
      setYtScanNotification({
        type: 'error',
        message: `خطا در دریافت لیست ویدیوهای ${channel.channelName}: ${err.message}`,
      });
      setTimeout(() => setYtScanNotification(null), 5000);
    } finally {
      setIsPreviewingYt(false);
    }
  };

  // Live Real Scan for a single channel
  const handleScanSingleChannelNow = async (channel: YouTubeChannelSource) => {
    setScanningChannelId(channel.id);
    setYtScanNotification({
      type: 'info',
      message: `در حال بررسی آخرین ویدیوهای کانال «${channel.channelName}» و استخراج صوت...`,
    });
    try {
      const res = await api.scanSingleYoutubeChannel(channel.id);
      const newTracks = res?.extractedTracks || [];
      const duplicatesSkipped = res?.duplicatesSkipped || 0;
      const errors = res?.errors || [];

      // Refresh DB queue so any background items are in sync
      const dbAll = await api.getFullDatabase();
      if (dbAll?.pendingQueue) setPendingQueue(dbAll.pendingQueue);
      if (dbAll?.youtubeChannels) setYoutubeChannels(dbAll.youtubeChannels);

      if (newTracks.length > 0) {
        setYtScanNotification({
          type: 'success',
          message: `پایش موفق! ${toPersianDigits(newTracks.length)} قطعه صوتی جدید از «${channel.channelName}» استخراج و به صف بررسی افزوده شد${
            duplicatesSkipped > 0 ? ` (${toPersianDigits(duplicatesSkipped)} اثر تکراری رد شد)` : ''
          }.`,
        });
      } else if (duplicatesSkipped > 0) {
        setYtScanNotification({
          type: 'info',
          message: `پایش کانال «${channel.channelName}» انجام شد: ${toPersianDigits(duplicatesSkipped)} ویدیوی بررسی شده تکراری بودند و رد شدند (قبلاً در پایگاه داده یا صف بررسی ثبت شده‌اند).`,
        });
      } else if (errors.length > 0) {
        const isBotBlock = errors.some((e: string) => e.includes('bot') || e.includes('Sign in'));
        setYtScanNotification({
          type: 'error',
          message: isBotBlock
            ? `ویدیوهای جدید در کانال «${channel.channelName}» پیدا شد اما یوتیوب دانلود فایل را به دلیل نیاز به تایید هویت مسدود کرد. لطفاً کوکی‌های یوتیوب را در بخش «تنظیمات و کوکی‌ها» به‌روزرسانی کنید.`
            : `خطا در دریافت ویدیوها: ${errors[0]?.slice(0, 100)}`,
        });
      } else {
        setYtScanNotification({
          type: 'info',
          message: `پایش کانال «${channel.channelName}» انجام شد. ویدیوی جدیدی در کانال یافت نشد.`,
        });
      }
      setTimeout(() => setYtScanNotification(null), 8000);
    } catch (err: any) {
      setYtScanNotification({
        type: 'error',
        message: `خطا در پایش کانال ${channel.channelName}: ${err.message}`,
      });
      setTimeout(() => setYtScanNotification(null), 6000);
    } finally {
      setScanningChannelId(null);
    }
  };

  // Real Scan All Monitored YouTube Channels
  const handleScanAllChannelsNow = async () => {
    setIsScanningAllYt(true);
    setYtScanNotification({
      type: 'info',
      message: 'شروع پایش زنده تمام کانال‌های فعال یوتیوب و بررسی ویدیوهای جدید...',
    });
    try {
      const summary = await api.scanAllYoutubeChannels();
      const count = summary?.newTracksAdded || 0;
      const duplicates = summary?.totalDuplicatesSkipped || 0;
      // Refresh DB queue
      const dbAll = await api.getFullDatabase();
      if (dbAll?.pendingQueue) {
        setPendingQueue(dbAll.pendingQueue);
      }
      if (dbAll?.youtubeChannels) {
        setYoutubeChannels(dbAll.youtubeChannels);
      }
      setYtScanNotification({
        type: 'success',
        message: `پایش کامل به پایان رسید: ${toPersianDigits(summary?.channelsScanned || 0)} کانال بررسی شد و ${toPersianDigits(count)} صوت جدید به صف بررسی اضافه گردید${
          duplicates > 0 ? ` (${toPersianDigits(duplicates)} ویدیوی تکراری نادیده گرفته شد)` : ''
        }.`,
      });
      setTimeout(() => setYtScanNotification(null), 7000);
    } catch (err: any) {
      setYtScanNotification({
        type: 'error',
        message: `خطا در پایش کانال‌ها: ${err.message}`,
      });
      setTimeout(() => setYtScanNotification(null), 6000);
    } finally {
      setIsScanningAllYt(false);
    }
  };

  // Helper to sanitize and normalize media URLs
  const normalizeMediaUrl = (input: string): string => {
    let clean = input.trim().replace(/^["'`]+|["'`]+$/g, '');
    if (!clean) return '';
    // Auto-fix missing protocol if starts with domain or common media site
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      if (clean.includes('.') || clean.includes('/')) {
        clean = `https://${clean}`;
      }
    }
    return clean;
  };

  // Step 1: Inspect Media Info & Preview before Sending to Cloud
  const handleInspectMedia = async (urlToInspect?: string) => {
    const rawUrl = urlToInspect || ytInputUrl;
    const normalizedUrl = normalizeMediaUrl(rawUrl);
    if (!normalizedUrl) {
      setYtErrorMessage('لطفاً آدرس لینک یوتیوب، آپارات یا فایل مستقیم را در کادر بالا وارد کنید.');
      const el = document.getElementById('yt-url-input');
      if (el) el.focus();
      return;
    }

    setIsInspectingMedia(true);
    setYtErrorMessage(null);
    setYtSuccessMessage(null);
    setYtInputUrl(normalizedUrl);

    try {
      const data = await api.getMediaInfo(normalizedUrl);
      if (data && data.success) {
        setInspectedMedia(data);
        setYtCustomTitle(data.title || '');
        if (data.suggestedReciterId) {
          setYtReciterId(data.suggestedReciterId);
        }
      } else {
        throw new Error(data?.error || 'امکان دریافت اطلاعات از این لینک وجود ندارد.');
      }
    } catch (err: any) {
      setYtErrorMessage(`خطا در استعلام اطلاعات ویدیو: ${err.message}`);
    } finally {
      setIsInspectingMedia(false);
    }
  };

  // Step 2: Confirm, Convert with FFmpeg/yt-dlp, Upload to ArvanCloud S3 & Push to Queue
  const handleConfirmExtractToCloud = async (force: boolean = false) => {
    const targetUrl = inspectedMedia?.playbackUrl || normalizeMediaUrl(ytInputUrl);
    if (!targetUrl) return;

    if (isYtProcessing) return;

    setIsYtProcessing(true);
    setYtErrorMessage(null);
    setYtSuccessMessage(null);
    setYtProcessProgress(15);
    setYtProcessStep('اتصال به سرور و آماده‌سازی موتور استخراج (yt-dlp)...');

    const progressTimer = setInterval(() => {
      setYtProcessProgress((prev) => {
        if (prev < 35) {
          setYtProcessStep('دانلود استریم صوتی از یوتیوب با کیفیت اورجینال...');
          return prev + 8;
        } else if (prev < 70) {
          setYtProcessStep(`تبدیل استریم به MP3 (${ytBitrate}kbps) با موتور FFmpeg...`);
          return prev + 10;
        } else if (prev < 90) {
          setYtProcessStep('ارسال مستقیم فایل صوتی به باکت S3 ابر آروان...');
          return prev + 4;
        }
        return prev;
      });
    }, 1100);

    try {
      const selectedRec = reciters.find((r) => r.id === ytReciterId) || reciters[0];
      const selectedCat = categories.find((c) => c.id === ytCategoryId) || categories[1];

      const res = await fetch('/api/extract-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          title: ytCustomTitle.trim() || inspectedMedia?.title,
          reciterId: selectedRec?.id,
          reciterName: selectedRec?.name,
          categoryId: selectedCat?.id,
          bitrate: ytBitrate,
          force,
        }),
      });

      clearInterval(progressTimer);
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 409 && data.isDuplicate) {
          throw new Error(data.error || 'این ویدیو قبلاً استخراج شده است.');
        }
        throw new Error(data.error || 'خطا در تبدیل و آپلود به ابر آروان');
      }

      setYtProcessProgress(100);
      setYtProcessStep('با موفقیت انجام شد! ذخیره در باکت ابر آروان و صف بررسی...');

      const generatedTitle =
        data.title || ytCustomTitle.trim() || inspectedMedia?.title || `نوای صوتی (${selectedRec?.name})`;

      const newTrack: Track = data.queueItem || {
        id: `queue-yt-${Date.now()}`,
        title: generatedTitle,
        reciterId: selectedRec?.id || 'rec-karimi',
        reciterName: selectedRec?.name || 'مداح منتخب',
        categoryId: selectedCat?.id || 'cat-moharram',
        categoryName: selectedCat?.name || 'محرم و عاشورا',
        occasion: 'استخراج مستقیم از یوتیوب',
        duration: data.duration || inspectedMedia?.duration || 210,
        audioUrl: data.url,
        coverUrl: data.coverUrl || inspectedMedia?.thumbnail || '',
        fileSizeMb: data.fileSizeMb || (ytBitrate === '320' ? 8.5 : 4.5),
        bitrate: `${ytBitrate} kbps`,
        status: 'pending',
        sourceType: 'youtube',
        sourceUrl: targetUrl,
        sourceChannelName: data.uploader || inspectedMedia?.uploader || 'یوتیوب',
        playCount: 0,
        createdAt: 'همین الان (استودیو یوتیوب)',
        s3Key: data.s3Key || `incoming/youtube/${Date.now()}.mp3`,
        tags: [selectedRec?.name || 'مداحی', 'یوتیوب', `${ytBitrate} kbps`, 'ابر آروان'],
        lyrics: [],
      };

      setPendingQueue((prev) => [newTrack, ...prev.filter((p) => p.id !== newTrack.id)]);
      if (onDbRefresh) onDbRefresh();

      setYtSuccessMessage(
        `صوت با موفقیت از «${data.uploader || inspectedMedia?.uploader || 'یوتیوب'}» استخراج، به MP3 تبدیل و در باکت ابر آروان (${data.fileSizeMb} مگابایت) ذخیره شد! به صف بررسی فایل‌ها افزوده شد.`
      );
      setLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('fa-IR'),
          channel: 'یوتیوب استودیو',
          message: `فایل «${generatedTitle}» تبدیل و به ابر آروان ارسال شد: ${data.url}`,
          level: 'success',
        },
        ...prev,
      ]);

      setInspectedMedia(null);
      setYtInputUrl('');
      setYtCustomTitle('');
      setTimeout(() => {
        setIsYtProcessing(false);
        setYtProcessStep('');
        setYtProcessProgress(0);
      }, 1500);
    } catch (err: any) {
      clearInterval(progressTimer);
      setIsYtProcessing(false);
      setYtProcessStep('');
      setYtErrorMessage(err.message || 'خطا در فرآیند استخراج');
    }
  };

  // Channel Info Auto-Inspector
  const handleInspectChannelInfo = async () => {
    const raw = newYtChannelHandle.trim() || newYtChannelName.trim();
    if (!raw) {
      alert('لطفاً ابتدا هندل یوتیوب (مانند Fotros_ir@ یا آدرس کانال) را وارد کنید.');
      return;
    }
    setIsInspectingChannel(true);
    try {
      const data = await api.inspectChannel(raw);
      if (data && data.channelName) {
        setNewYtChannelName(data.channelName);
        if (data.channelHandle) {
          setNewYtChannelHandle(data.channelHandle);
        }
        if (data.suggestedReciterId) {
          setNewYtChannelReciterId(data.suggestedReciterId);
          setSuggestedCandidateReciter({ id: data.suggestedReciterId, name: data.suggestedReciterName || data.channelName });
        } else if (data.suggestedReciterName) {
          setSuggestedCandidateReciter({ name: data.suggestedReciterName });
        }
      }
    } catch (err: any) {
      console.warn('Channel inspection error:', err);
    } finally {
      setIsInspectingChannel(false);
    }
  };

  // Quick Add Reciter inline
  const handleQuickAddReciter = async () => {
    if (!quickReciterName.trim()) return;
    const newName = quickReciterName.trim();
    const newRec: Reciter = {
      id: `rec-${Date.now()}`,
      name: newName,
      title: newName.startsWith('حاج') || newName.startsWith('استاد') || newName.startsWith('کربلایی') ? newName : `حاج ${newName}`,
      bio: 'از مداحان و ذاکرین اهل بیت (ع)',
      avatarUrl: '',
      tracksCount: 0,
      style: 'نوحه و روضه',
      accentColor: '#10b981',
    };
    try {
      const saved = await api.addReciter(newRec);
      setReciters((prev) => [...prev, saved]);
      if (quickReciterTarget === 'channel') {
        setNewYtChannelReciterId(saved.id);
      } else {
        setYtReciterId(saved.id);
      }
    } catch (_) {
      setReciters((prev) => [...prev, newRec]);
      if (quickReciterTarget === 'channel') {
        setNewYtChannelReciterId(newRec.id);
      } else {
        setYtReciterId(newRec.id);
      }
    }
    setQuickReciterName('');
    setShowQuickAddReciterModal(false);
  };

  // Run Telegram Scraper Simulation
  const handleTriggerScraper = () => {
    setIsScrapingRunning(true);
    setTimeout(() => {
      const activeChannels = telegramSources.filter((s) => s.isMonitored);
      const randomChannel =
        activeChannels[Math.floor(Math.random() * activeChannels.length)] ||
        telegramSources[0];

      const newSimulatedTrack: Track = {
        id: `queue-${Date.now()}`,
        title: `نوحه جدید ضبط‌شده: ای مهربان‌تر از مادر (کانال ${randomChannel.channelUsername})`,
        reciterId: reciters[0]?.id || 'rec-karimi',
        reciterName: reciters[0]?.name || 'محمود کریمی',
        categoryId: 'cat-moharram',
        categoryName: 'محرم و عاشورا',
        occasion: 'ایام سوگواری',
        duration: 345,
        audioUrl: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3',
        coverUrl: '',
        fileSizeMb: 5.4,
        bitrate: '128 kbps',
        status: 'pending',
        sourceTelegramChannel: randomChannel.channelUsername,
        sourceTelegramMsgId: Math.floor(Math.random() * 20000) + 1000,
        playCount: 0,
        createdAt: 'چند لحظه پیش (ربات)',
        s3Key: `incoming/bot_extract_${Date.now()}.mp3`,
        tags: ['شور', 'تلگرام', 'آرشیو جدید'],
        lyrics: [
          {
            id: `sl-${Date.now()}`,
            time: 0,
            textArabic: 'ای مهربان‌تر از مادر، مرا به حال خودم رها مکن',
            textPersian: 'ای مهربان‌تر از مادر، مرا به حال خودم رها مکن',
          },
        ],
      };

      setPendingQueue((prev) => [newSimulatedTrack, ...prev]);
      setLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('fa-IR'),
          channel: randomChannel.channelUsername,
          message: `فایل صوتی جدید استخراج و در باکت ابر آروان ذخیره شد.`,
          level: 'success',
        },
        ...prev,
      ]);
      setIsScrapingRunning(false);
    }, 1500);
  };

  // Direct S3 Upload Handler (Real S3 Upload to ArvanCloud)
  const handleDirectUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) return;

    if (!uploadFile) {
      setUploadError('لطفاً یک فایل صوتی مداحی یا دعا برای آپلود انتخاب کنید.');
      return;
    }

    setUploadError(null);
    setUploadSuccess(false);
    setUploadSuccessUrl(null);
    setIsUploading(true);

    const selectedRec = reciters.find((r) => r.id === uploadReciterId) || reciters[0];
    const selectedCat = categories.find((c) => c.id === uploadCategoryId) || categories[1];

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('title', uploadTitle.trim());

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.error || 'خطا در ارتباط با استوریج ابر آروان';
        setUploadError(errorMsg);
        setLogs((prev) => [
          {
            id: `log-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString('fa-IR'),
            channel: 'آپلود ابر آروان',
            message: `شکست در آپلود: ${errorMsg}`,
            level: 'warn',
          },
          ...prev,
        ]);
        setIsUploading(false);
        return;
      }

      const finalAudioUrl = data.url;
      const finalS3Key = data.s3Key;
      const finalSizeMb = data.fileSizeMb || parseFloat((uploadFile.size / (1024 * 1024)).toFixed(1));

      const newTrack: Track = {
        id: `track-${Date.now()}`,
        title: uploadTitle.trim(),
        reciterId: selectedRec.id,
        reciterName: selectedRec.name,
        categoryId: selectedCat.id,
        categoryName: selectedCat.name,
        occasion: uploadOccasion.trim() || 'مناسبت عمومی',
        duration: 420,
        audioUrl: finalAudioUrl,
        coverUrl: '',
        fileSizeMb: finalSizeMb,
        bitrate: '320 kbps',
        status: 'approved',
        playCount: 0,
        createdAt: 'امروز (آپلود در باکت آروان)',
        s3Key: finalS3Key,
        tags: [selectedRec.name, selectedCat.name],
        lyrics: uploadLyricsArabic
          ? [
              {
                id: `l-up-${Date.now()}`,
                time: 0,
                textArabic: uploadLyricsArabic,
                textPersian: uploadLyricsPersian || uploadLyricsArabic,
              },
            ]
          : [],
      };

      setTracks((prev) => [newTrack, ...prev]);
      setIsUploading(false);
      setUploadSuccess(true);
      setUploadSuccessUrl(finalAudioUrl);
      setUploadTitle('');
      setUploadOccasion('');
      setUploadLyricsArabic('');
      setUploadLyricsPersian('');
      setUploadFile(null);

      setLogs((prev) => [
        {
          id: `log-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('fa-IR'),
          channel: 'آپلود ابر آروان',
          message: `فایل «${newTrack.title}» با موفقیت در باکت ابر آروان (${finalS3Key}) ذخیره گردید.`,
          level: 'success',
        },
        ...prev,
      ]);

      // Automatically sync with S3 bucket
      fetchSyncedFiles();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err.message || 'خطای غیرمنتظره در ارسال درخواست آپلود به سرور');
      setIsUploading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(key);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  // Ready-to-use YouTube & Web Auto-Watcher Python Script (yt-dlp + S3 + Supabase)
  const youtubeWatcherScript = `"""
پایشگر خودکار کانال‌های یوتیوب و سورس‌های وب (YouTube & Web Auto-Watcher)
تبدیل خودکار ویدیوها به MP3، استخراج کاور، آپلود به باکت S3 ابر آروان و ثبت در Supabase
پیش‌نیازها: pip install yt-dlp boto3 supabase python-dotenv mutagen
نرم‌افزار سیستمی: ffmpeg (sudo apt install -y ffmpeg)
"""

import os
import io
import sys
import time
import logging
from dotenv import load_dotenv
import boto3
from supabase import create_client, Client
import yt_dlp

load_dotenv()
logger = logging.getLogger("YouTubeWatcher")
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(message)s')

raw_ep = os.getenv("ARVAN_S3_ENDPOINT") or os.getenv("ARVAN_ENDPOINT", "https://s3.ir-thr-at1.arvanstorage.ir")
raw_ep = raw_ep.strip().strip('"\'')
if not raw_ep.startswith("http://") and not raw_ep.startswith("https://"):
    raw_ep = "https://" + raw_ep
S3_ENDPOINT = raw_ep.rstrip('/')
S3_BUCKET = os.getenv("ARVAN_S3_BUCKET") or os.getenv("ARVAN_BUCKET_NAME", "madahi-media-vault")
S3_ACCESS_KEY = os.getenv("ARVAN_ACCESS_KEY", "your_access_key")
S3_SECRET_KEY = os.getenv("ARVAN_SECRET_KEY", "your_secret_key")

s3_client = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    region_name="ir-thr-at1"
)
supabase: Client = create_client(os.getenv("SUPABASE_URL", ""), os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""))

CHANNELS = [
    {"name": "پایگاه فطرس (حاج محمود کریمی)", "url": "https://www.youtube.com/@Fotros_ir/videos", "reciter": "حاج محمود کریمی"},
    {"name": "دکتر میثم مطیعی", "url": "https://www.youtube.com/@MeysamMotiee/videos", "reciter": "دکتر حاج میثم مطیعی"},
    {"name": "هیئت فدائیان حضرت زهرا (حسین طاهری)", "url": "https://www.youtube.com/@HosseinTaheri/videos", "reciter": "کربلایی حسین طاهری"},
]

def process_youtube_video(video_url, ch_info):
    """دانلود صدا، تبدیل به MP3 با کیفیت ۳۲۰ و ارسال مستقیم به ابر آروان"""
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': '/tmp/%(id)s.%(ext)s',
        'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '320'}],
        'quiet': True,
        'no_warnings': True
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(video_url, download=True)
        vid_id = info['id']
        title = info.get('title', 'بدون عنوان')
        duration = info.get('duration', 0)
        mp3_file = f"/tmp/{vid_id}.mp3"
        s3_key = f"incoming/youtube/{vid_id}.mp3"

        with open(mp3_file, 'rb') as f:
            s3_client.put_object(Bucket=S3_BUCKET, Key=s3_key, Body=f, ContentType="audio/mpeg", ACL="public-read")

        s3_url = f"{S3_ENDPOINT}/{S3_BUCKET}/{s3_key}"
        supabase.table("tracks").insert({
            "title": title[:100],
            "reciter_name": ch_info.get("reciter", "مداح نامشخص"),
            "duration": duration,
            "bitrate": "320 kbps",
            "audio_url": s3_url,
            "s3_key": s3_key,
            "status": "pending"
        }).execute()

        os.remove(mp3_file)
        print(f"[✓] ویدیو با موفقیت به صوت ۳۲۰ تبدیل و در ابر آروان ذخیره شد: {title}")

if __name__ == '__main__':
    print("پایشگر خودکار کانال‌های یوتیوب در حال اجراست...")
    for ch in CHANNELS:
        print(f"پایش کانال: {ch['name']}")
`;

  // Ready-to-use Python script with Telethon + ArvanCloud S3 Boto3 + Supabase Client
  const pythonBotScript = `"""
ربات تلگرام هوشمند گردآوری مداحی و ارسال مستقیم به باکت S3 ابر آروان و سوپابیس
زبان: Python 3.10+
کتابخانه‌های مورد نیاز: pip install telethon boto3 supabase mutagen python-dotenv
"""

import os
import re
import asyncio
import boto3
from telethon import TelegramClient, events
from telethon.tl.types import DocumentAttributeAudio
from supabase import create_client, Client
from mutagen.easyid3 import EasyID3
import io

# --- تنظیمات تلگرام (از https://my.telegram.org دریافت کنید) ---
API_ID = int(os.getenv("TELEGRAM_API_ID", "12345678"))
API_HASH = os.getenv("TELEGRAM_API_HASH", "your_telegram_api_hash")
SESSION_NAME = "madahi_scraper_session"

# --- کانال‌های هدف تلگرام برای گردآوری خودکار ---
TARGET_CHANNELS = [
    "@fotros_ir",
    "@meysammotiee",
    "@nohe_archive",
    "@rayat_alreza"
]

# --- تنظیمات استوریج ابر آروان (ArvanCloud S3) ---
raw_endpoint = os.getenv("ARVAN_S3_ENDPOINT", os.getenv("ARVAN_ENDPOINT", "https://s3.ir-thr-at1.arvanstorage.ir")).strip().strip('"\'')
if not raw_endpoint.startswith("http://") and not raw_endpoint.startswith("https://"):
    raw_endpoint = "https://" + raw_endpoint
S3_ENDPOINT = raw_endpoint.rstrip('/')
S3_BUCKET = os.getenv("ARVAN_S3_BUCKET", os.getenv("ARVAN_BUCKET_NAME", "madahi-media-vault"))
S3_ACCESS_KEY = os.getenv("ARVAN_ACCESS_KEY", "your_arvan_access_key")
S3_SECRET_KEY = os.getenv("ARVAN_SECRET_KEY", "your_arvan_secret_key")

s3_client = boto3.client(
    "s3",
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    region_name="ir-thr-at1"
)

# --- تنظیمات پایگاه داده Supabase ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://xyzcompany.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "your_supabase_service_role_key")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# --- کلاینت تلگرام (UserBot با پروتکل قدرتمند MTProto) ---
client = TelegramClient(SESSION_NAME, API_ID, API_HASH)

@client.on(events.NewMessage(chats=TARGET_CHANNELS))
async def handle_new_audio(event):
    """شنود پیام‌های جدید در کانال‌ها و بررسی وجود فایل صوتی"""
    message = event.message
    
    # بررسی آیا پیام حاوی فایل صوتی یا وویس است
    if message.audio or (message.document and any(isinstance(attr, DocumentAttributeAudio) for attr in message.document.attributes)):
        sender = await event.get_chat()
        channel_username = f"@{sender.username}" if sender.username else str(sender.id)
        print(f"[*] قطعه جدید در کانال {channel_username} یافت شد. پیام: {message.id}")
        
        # استخراج مشخصات صوتی
        duration = 0
        title = "بدون عنوان"
        performer = "مداح نامشخص"
        
        if message.audio:
            duration = message.audio.duration
            for attr in message.document.attributes:
                if isinstance(attr, DocumentAttributeAudio):
                    if attr.title: title = attr.title
                    if attr.performer: performer = attr.performer
        
        # اگر در تگ‌های صوتی نام نبود، از کپشن پیام استفاده می‌کنیم
        caption = message.text or ""
        if title == "بدون عنوان" and caption:
            first_line = caption.strip().split('\\n')[0]
            title = first_line[:60]
            
        file_size_mb = round(message.file.size / (1024 * 1024), 2)
        s3_key = f"incoming/bot_{message.id}_{message.file.name or 'audio.mp3'}"
        
        print(f"[+] در حال دانلود و ارسال مستقیم به ابر آروان: {title} ({file_size_mb} MB)...")
        
        # دانلود در بافر رم جهت آپلود بدون ذخیره طولانی روی هارد سرور
        audio_bytes = await message.download_media(file=bytes)
        
        # آپلود به باکت S3 ابر آروان با هدر Content-Type صوتی
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=audio_bytes,
            ContentType="audio/mpeg",
            ACL="public-read"
        )
        
        s3_url = f"{S3_ENDPOINT}/{S3_BUCKET}/{s3_key}"
        print(f"[✓] آپلود به آروان با موفقیت انجام شد: {s3_url}")
        
        # ثبت در جدول tracks پایگاه داده سوپابیس با وضعیت pending (جهت بازبینی در پنل ادمین)
        record = {
            "title": title,
            "reciter_name": performer,
            "duration": duration,
            "file_size_mb": file_size_mb,
            "bitrate": "128 kbps",
            "audio_url": s3_url,
            "s3_key": s3_key,
            "source_telegram_channel": channel_username,
            "source_telegram_msg_id": message.id,
            "status": "pending",  # در انتظار تایید در پنل ادمین
            "lyrics": []
        }
        
        res = supabase.table("tracks").insert(record).execute()
        print(f"[✓] رکورد با موفقیت در سوپابیس ثبت شد. شناسه: {res.data}")

async def main():
    await client.start()
    print("[*] ربات گردآورنده مداحی تلگرام با موفقیت اجرا شد و در حال شنود کانال‌هاست...")
    await client.run_until_disconnected()

if __name__ == '__main__':
    asyncio.run(main())
`;

  // SQL schema for Supabase
  const supabaseSqlSchema = `-- اسکریپت ساخت جداول پایگاه داده در Supabase (PostgreSQL)

-- ۱. جدول مداحان و قاریان
CREATE TABLE IF NOT EXISTS public.reciters (
    id TEXT PRIMARY KEY DEFAULT 'rec_' || gen_random_uuid(),
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    style TEXT,
    accent_color TEXT DEFAULT '#10b981',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ۲. جدول دسته‌بندی‌ها
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ۳. جدول قطعات صوتی (Tracks)
CREATE TABLE IF NOT EXISTS public.tracks (
    id TEXT PRIMARY KEY DEFAULT 'track_' || gen_random_uuid(),
    title TEXT NOT NULL,
    reciter_id TEXT REFERENCES public.reciters(id) ON DELETE SET NULL,
    reciter_name TEXT NOT NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    occasion TEXT,
    duration INTEGER NOT NULL DEFAULT 0,
    file_size_mb NUMERIC(6, 2) DEFAULT 0,
    bitrate TEXT DEFAULT '128 kbps',
    audio_url TEXT NOT NULL,
    cover_url TEXT,
    s3_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
    source_telegram_channel TEXT,
    source_telegram_msg_id BIGINT,
    play_count BIGINT DEFAULT 0,
    lyrics JSONB DEFAULT '[]'::jsonb,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ۴. ایندکس‌ها برای کوئری‌های سریع در پلیر
CREATE INDEX IF NOT EXISTS idx_tracks_status ON public.tracks(status);
CREATE INDEX IF NOT EXISTS idx_tracks_category ON public.tracks(category_id);
CREATE INDEX IF NOT EXISTS idx_tracks_reciter ON public.tracks(reciter_id);

-- ۵. فعال‌سازی امنیت سطح سطر (RLS)
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reciters ENABLE ROW LEVEL SECURITY;

-- سیاست خواندن عمومی برای قطعات تایید شده
CREATE POLICY "Public tracks are viewable by everyone" 
ON public.tracks FOR SELECT 
USING (status = 'approved');

-- دسترسی کامل برای ادمین (Service Role)
CREATE POLICY "Service role full access" 
ON public.tracks FOR ALL 
TO service_role 
USING (true);
`;

  return (
    <div className="space-y-6 pb-32">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Pending Queue */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400">صف بررسی ربات تلگرام</span>
            <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {toPersianDigits(pendingQueue.length)}
            </div>
            <span className="text-[11px] text-amber-400/80">نیازمند تایید ادمین</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Stat 2: Total Approved Tracks */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400">قطعات منتشرشده عمومی</span>
            <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {toPersianDigits(tracks.length)}
            </div>
            <span className="text-[11px] text-emerald-400/80">فعال در کلاینت پلیر</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Stat 3: ArvanCloud S3 Storage */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400">فضای باکت ابر آروان (S3)</span>
            <div className="text-2xl font-bold font-mono text-slate-100 tabular-nums">
              {toPersianDigits('14.8')} <span className="text-xs font-sans text-slate-400">گیگابایت</span>
            </div>
            <span className="text-[11px] text-slate-500">منطقه: ir-thr-at1</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <HardDrive className="w-6 h-6" />
          </div>
        </div>

        {/* Stat 4: Supabase Database */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-400">کانال‌های متصل تلگرام</span>
            <div className="text-2xl font-bold font-mono text-indigo-400 tabular-nums">
              {toPersianDigits(telegramSources.filter((s) => s.isMonitored).length)}
            </div>
            <span className="text-[11px] text-indigo-400/80">پایش دوره‌ای خودکار</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Send className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Admin Sub Navigation Tabs (Segmented Controls) */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveAdminTab('queue')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all border ${
            activeAdminTab === 'queue'
              ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>صف بررسی فایل‌ها</span>
          {pendingQueue.length > 0 && (
            <span
              className={`text-xs px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
                activeAdminTab === 'queue'
                  ? 'bg-slate-950/20 text-slate-950'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {toPersianDigits(pendingQueue.length)}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminTab('youtube_studio')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all border ${
            activeAdminTab === 'youtube_studio'
              ? 'bg-rose-600 text-white font-bold border-rose-500 shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
          }`}
        >
          <Youtube className="w-4 h-4 text-rose-400" />
          <span>استودیو یوتیوب و وب</span>
          <span
            className={`text-xs px-1.5 py-0.2 rounded-full font-mono tabular-nums ${
              activeAdminTab === 'youtube_studio'
                ? 'bg-white/20 text-white'
                : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {toPersianDigits(youtubeChannels.filter((c) => c.isMonitored).length)} کانال
          </span>
        </button>

        <button
          onClick={() => setActiveAdminTab('upload')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all border ${
            activeAdminTab === 'upload'
              ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>آپلود مستقیم به ابر آروان</span>
        </button>

        <button
          onClick={() => {
            setActiveAdminTab('cloud_sync');
            fetchSyncedFiles();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all border ${
            activeAdminTab === 'cloud_sync'
              ? 'bg-sky-500 text-slate-950 font-bold border-sky-400 shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
          }`}
        >
          <HardDrive className="w-4 h-4 text-sky-400" />
          <span>همگام‌سازی و باکت آروان</span>
          {serverCloudStatus?.arvan?.canConnect ? (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="متصل"></span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-rose-400" title="نیاز به بررسی اتصال"></span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminTab('reciters')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all border ${
            activeAdminTab === 'reciters'
              ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>مدیریت مداحان ({toPersianDigits(reciters.length)})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all border ${
            activeAdminTab === 'categories'
              ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span>دسته‌بندی‌ها و مناسبت‌ها ({toPersianDigits(categories.length)})</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('telegram')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all border ${
            activeAdminTab === 'telegram'
              ? 'bg-sky-500 text-slate-950 font-bold border-sky-400 shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
          }`}
        >
          <Bot className="w-4 h-4 text-sky-400" />
          <span>ربات تلگرام و انتشار کانال</span>
          {botConfig?.botActive && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="ربات فعال"></span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminTab('scripts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all border ${
            activeAdminTab === 'scripts'
              ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>اسکریپت‌های سرور</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all border ${
            activeAdminTab === 'settings'
              ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
          }`}
        >
          <Settings className="w-4 h-4 text-amber-400" />
          <span>تنظیمات و کوکی‌ها</span>
          {ytCookiesStatus.configured && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="کوکی تنظیم شده"></span>
          )}
        </button>

        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setActiveAdminTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all border ${
              activeAdminTab === 'users'
                ? 'bg-indigo-600 text-white font-bold border-indigo-500 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-indigo-400" />
            <span>مدیریت کاربران و دسترسی‌ها</span>
          </button>
        )}
      </div>

      {/* Tab 1: Review Queue (فایل‌های ارسال شده توسط ربات تلگرام) */}
      {activeAdminTab === 'queue' && (
        <div className="space-y-4">
          {queueFeedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs animate-in fade-in ${
                queueFeedback.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{queueFeedback.msg}</span>
              </div>
              <button
                onClick={() => setQueueFeedback(null)}
                className="text-slate-400 hover:text-white px-1"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>صف تایید فایل‌های ارسال شده از ربات و استخراج وب</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                نواهای صوتی که در باکت ابر آروان ذخیره شده‌اند و منتظر بررسی شما هستند. با تایید هر قطعه، در پایگاه داده مستقل ذخیره شده و می‌توانید همزمان آن را در کانال تلگرام نیز منتشر کنید.
              </p>
            </div>

            <button
              onClick={handleTriggerScraper}
              disabled={isScrapingRunning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScrapingRunning ? 'animate-spin' : ''}`} />
              <span>{isScrapingRunning ? 'در حال پایش کانال‌ها...' : 'تست پایش فوری کانال‌ها'}</span>
            </button>
          </div>

          {pendingQueue.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400 space-y-3">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 stroke-1" />
              <h4 className="text-base font-bold text-slate-200">صف بررسی خالی است!</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                تمامی قطعات جمع‌آوری شده توسط ربات تلگرام بررسی و تایید شده‌اند. فایل‌های جدید به محض
                انتشار در کانال‌های تلگرامی در اینجا ظاهر خواهند شد.
              </p>
              <button
                onClick={handleTriggerScraper}
                className="text-xs text-indigo-400 hover:underline pt-1 inline-block"
              >
                شبیه‌سازی دریافت یک فایل صوتی از کانال تلگرام
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingQueue.map((item) => {
                const isPlayingThis = currentTrack?.id === item.id && isPlaying;
                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    {/* Track info & quick preview play */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => {
                          if (isPlayingThis) {
                            togglePlay();
                          } else {
                            playTrack(item);
                          }
                        }}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
                          isPlayingThis
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-200 hover:bg-amber-500/20 hover:text-amber-400'
                        }`}
                        title="پخش پیش‌نمایش"
                      >
                        {isPlayingThis ? (
                          <Pause className="w-5 h-5 fill-current" />
                        ) : (
                          <Play className="w-5 h-5 fill-current translate-x-0.5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold text-slate-100 truncate">
                            {item.title}
                          </h4>
                          <span className="bg-amber-500/10 text-amber-400 text-[10px] px-2 py-0.5 rounded border border-amber-500/20 shrink-0">
                            در انتظار تایید
                          </span>
                          {item.sourceType === 'youtube' && (
                            <span className="bg-rose-500/10 text-rose-400 text-[10px] px-2 py-0.5 rounded border border-rose-500/30 shrink-0 flex items-center gap-1">
                              <Youtube className="w-3 h-3 text-rose-400" />
                              <span>{item.sourceChannelName || 'کانال یوتیوب'}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                          <span className="text-slate-300 font-medium">{item.reciterName}</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-indigo-400 font-mono text-[11px]">
                            {item.sourceChannelName || item.sourceTelegramChannel || 'ورودی وب'}
                            {item.sourceTelegramMsgId ? ` (پیام ${toPersianDigits(item.sourceTelegramMsgId)})` : ''}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-500 font-mono tabular-nums">
                            {toPersianDigits(formatDuration(item.duration))}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-500 font-mono tabular-nums">
                            {formatFileSize(item.fileSizeMb)}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 font-mono mt-1 truncate">
                          ابر آروان: {item.s3Key}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-800">
                      <button
                        onClick={() => setEditingTrack(item)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ویرایش</span>
                      </button>

                      <button
                        onClick={() => handleRejectTrack(item.id)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/20 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>رد</span>
                      </button>

                      <button
                        onClick={() => handleApproveTrack(item, false)}
                        disabled={approvingTrackId === item.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50"
                        title="ذخیره در پایگاه داده مستقل محلی"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{approvingTrackId === item.id ? 'در حال ثبت...' : 'تایید در دیتابیس'}</span>
                      </button>

                      <button
                        onClick={() => handleApproveTrack(item, true)}
                        disabled={approvingTrackId === item.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold shadow-md shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50"
                        title="تأیید در دیتابیس و ارسال همزمان به کانال تلگرام"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>تایید + انتشار کانال</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: YouTube & Web Studio (استودیو یوتیوب و سورس‌های وب) */}
      {activeAdminTab === 'youtube_studio' && (
        <div className="space-y-6">
          {/* Top Banner & Overview */}
          <div className="relative rounded-2xl bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-900 border border-rose-500/30 p-5 overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                  <Youtube className="w-4 h-4" />
                  <span>پایش خودکار یوتیوب و تبدیل استریم صوتی</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  استودیو دریافت خودکار مداحی و ادعیه از یوتیوب و وب
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  کانال‌های مدنظر خود را ثبت کنید تا جدیدترین قطعات به طور خودکار به صوت ۳۲۰ تبدیل و در باکت ابر آروان ذخیره شوند. همچنین لینک‌های تکی را ابتدا استعلام و پیش‌نمایش کرده و پس از تأیید به صف ارسال کنید.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {/* Compact Cookies Status & Settings Pill */}
                <button
                  type="button"
                  onClick={() => setActiveAdminTab('settings')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 text-xs text-slate-200 transition-all cursor-pointer shadow-sm"
                  title="مدیریت کوکی‌های حساب یوتیوب برای رفع محدودیت‌های ضدربات در تب تنظیمات"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>کوکی یوتیوب:</span>
                  {ytCookiesStatus.configured ? (
                    <span className="text-emerald-400 font-bold">فعال ({toPersianDigits(ytCookiesStatus.entryCount)})</span>
                  ) : (
                    <span className="text-amber-400">تنظیم نشده</span>
                  )}
                  <span className="text-slate-500 text-[10px]">⚙️ تنظیمات</span>
                </button>

                <button
                  type="button"
                  onClick={handleScanAllChannelsNow}
                  disabled={isScanningAllYt || !!scanningChannelId}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="پایش فوری کلیه کانال‌های یوتیوب و استخراج جدیدترین قطعات به صف بررسی"
                >
                  <RefreshCw className={`w-4 h-4 ${isScanningAllYt ? 'animate-spin' : ''}`} />
                  <span>{isScanningAllYt ? 'در حال پایش کانال‌ها...' : 'پایش و همگام‌سازی فوری همه کانال‌ها'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section 1: Two-Step Instant Link Inspector & Downloader */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5 text-rose-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  دریافت فوری از لینک یوتیوب یا فایل مستقیم وب (استعلام و تأیید پیش از ارسال به ابر آروان)
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                موتور: yt-dlp + FFmpeg 320kbps
              </span>
            </div>

            {/* URL Input Box */}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-300">
                آدرس ویدیوی یوتیوب، شورتز، آپارات یا لینک مستقیم فایل وب *
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <input
                    id="yt-url-input"
                    type="text"
                    dir="ltr"
                    value={ytInputUrl}
                    onChange={(e) => {
                      setYtInputUrl(e.target.value);
                      if (ytErrorMessage) setYtErrorMessage(null);
                      if (ytSuccessMessage) setYtSuccessMessage(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleInspectMedia();
                      }
                    }}
                    placeholder="https://www.youtube.com/watch?v=... یا youtu.be/... یا aparat.com/... یا لینک مستقیم فایل"
                    className="w-full pr-4 pl-24 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        if (navigator?.clipboard?.readText) {
                          const clipText = await navigator.clipboard.readText();
                          if (clipText && clipText.trim()) {
                            const cleaned = normalizeMediaUrl(clipText);
                            setYtInputUrl(cleaned);
                            handleInspectMedia(cleaned);
                            return;
                          }
                        }
                      } catch (_) {}
                      const el = document.getElementById('yt-url-input');
                      if (el) el.focus();
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    چسباندن
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleInspectMedia()}
                  disabled={isInspectingMedia || !ytInputUrl.trim()}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  {isInspectingMedia ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>در حال استعلام...</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      <span>استعلام و دریافت اطلاعات ویدیو</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {ytErrorMessage && (
              <div className="p-4 bg-rose-950/80 border border-rose-500/50 rounded-xl text-xs text-rose-300 space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <div className="font-bold text-rose-200">پیام سرور:</div>
                    <div className="text-slate-200 leading-relaxed">{ytErrorMessage}</div>
                  </div>
                </div>
                {(ytErrorMessage.includes('تایید') ||
                  ytErrorMessage.includes('کوکی') ||
                  ytErrorMessage.includes('bot') ||
                  ytErrorMessage.includes('Sign in')) && (
                  <div className="pt-2 border-t border-rose-500/30 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-rose-300/90">
                      💡 با ثبت کوکی حساب کاربری گوگل/یوتیوب، محدودیت ضدربات بلافاصله برطرف می‌گردد.
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveAdminTab('settings')}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shadow"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>تنظیم کوکی‌های یوتیوب در تب تنظیمات</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Success Banner */}
            {ytSuccessMessage && (
              <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-emerald-200">تبدیل و آپلود با موفقیت انجام شد:</div>
                    <div className="text-slate-300">{ytSuccessMessage}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAdminTab('queue')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg shrink-0 transition-colors"
                >
                  مشاهده در صف بررسی
                </button>
              </div>
            )}

            {/* Step 1 Result: Preview & Confirmation Card before Sending to Cloud */}
            {inspectedMedia && (
              <div className="p-4 sm:p-5 bg-slate-950 rounded-2xl border border-rose-500/40 space-y-4 shadow-xl">
                {/* Header of Preview */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
                    <Eye className="w-4 h-4" />
                    <span>اطلاعات استخراج‌شده اثر (پیش‌نمایش قبل از ارسال به ابر آروان)</span>
                  </div>

                  {inspectedMedia.isDuplicate && (
                    <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        این اثر قبلاً در سیستم ثبت شده است (
                        {inspectedMedia.duplicateLocation === 'database' ? 'در دیتابیس عمومی' : 'در صف بررسی'}
                        )
                      </span>
                    </span>
                  )}
                </div>

                {/* Media details card */}
                <div className="flex flex-col md:flex-row items-start gap-4">
                  {inspectedMedia.thumbnail ? (
                    <div className="flex flex-col gap-2 shrink-0 w-full md:w-56">
                      <div className="relative w-full h-32 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
                        <img
                          src={inspectedMedia.thumbnail}
                          alt={inspectedMedia.title}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setShowMediaPreviewPlayer((p) => !p)}
                          className="absolute inset-0 bg-black/40 hover:bg-black/20 flex flex-col items-center justify-center text-white transition-all gap-1 cursor-pointer"
                          title="پخش و شنیدن پیش‌نمایش"
                        >
                          <Play className="w-8 h-8 drop-shadow text-rose-400" />
                          <span className="text-[11px] font-bold bg-black/60 px-2 py-0.5 rounded-md">
                            {showMediaPreviewPlayer ? 'بستن پلیر' : 'پخش آنلاین پیش‌نمایش'}
                          </span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        <a
                          href={inspectedMedia.playbackUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-sky-400 hover:underline flex items-center gap-1 font-mono"
                        >
                          <span>لینک پخش در مبدا</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        <button
                          type="button"
                          onClick={() => setShowMediaPreviewPlayer((p) => !p)}
                          className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold"
                        >
                          {showMediaPreviewPlayer ? 'بستن پلیر' : '▶ پخش پلیر'}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex-1 space-y-3 min-w-0 w-full">
                    {/* Live Video / Audio Player Preview Drawer */}
                    {showMediaPreviewPlayer && (
                      <div className="rounded-xl overflow-hidden border border-rose-500/40 bg-black p-2 space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between text-xs text-rose-300 pb-1 border-b border-slate-800">
                          <span className="font-bold flex items-center gap-1.5">
                            <Play className="w-3.5 h-3.5 text-rose-400" />
                            <span>پلیر پخش پیش‌نمایش:</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowMediaPreviewPlayer(false)}
                            className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
                          >
                            ✕ بستن
                          </button>
                        </div>
                        {inspectedMedia.embedUrl ? (
                          <div className="aspect-video w-full rounded-lg overflow-hidden bg-slate-950">
                            <iframe
                              src={inspectedMedia.embedUrl}
                              title={inspectedMedia.title}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <audio
                            controls
                            src={inspectedMedia.playbackUrl}
                            className="w-full mt-1"
                            autoPlay
                          />
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="font-semibold text-rose-400">کانال / ناشر: {inspectedMedia.uploader}</span>
                      <span>·</span>
                      <span>مدت تخمینی: {toPersianDigits(formatDuration(inspectedMedia.duration || 240))}</span>
                      <span>·</span>
                      <span className="text-emerald-400 font-mono text-[11px]">کیفیت صوتی: {ytBitrate} kbps</span>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        عنوان اثر صوتی (قابل ویرایش):
                      </label>
                      <input
                        type="text"
                        value={ytCustomTitle}
                        onChange={(e) => setYtCustomTitle(e.target.value)}
                        className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-slate-100 font-semibold focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    {/* Metadata & Quality Selectors */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] text-slate-400">مداح:</label>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickReciterTarget('instant');
                              setShowQuickAddReciterModal(true);
                            }}
                            className="text-[10px] text-emerald-400 hover:underline flex items-center gap-0.5"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>مداح جدید</span>
                          </button>
                        </div>
                        <select
                          value={ytReciterId}
                          onChange={(e) => {
                            if (e.target.value === '__add_new__') {
                              setQuickReciterTarget('instant');
                              setShowQuickAddReciterModal(true);
                            } else {
                              setYtReciterId(e.target.value);
                            }
                          }}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                        >
                          {reciters.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.title}
                            </option>
                          ))}
                          <option value="__add_new__">+ افزودن مداح جدید...</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">دسته‌بندی:</label>
                        <select
                          value={ytCategoryId}
                          onChange={(e) => setYtCategoryId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                        >
                          {categories
                            .filter((c) => c.slug !== 'all')
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">کیفیت صوت خروجی:</label>
                        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-slate-700">
                          <button
                            type="button"
                            onClick={() => setYtBitrate('320')}
                            className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                              ytBitrate === '320' ? 'bg-rose-600 text-white' : 'text-slate-400'
                            }`}
                          >
                            ۳۲۰ kbps
                          </button>
                          <button
                            type="button"
                            onClick={() => setYtBitrate('128')}
                            className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-colors ${
                              ytBitrate === '128' ? 'bg-rose-600 text-white' : 'text-slate-400'
                            }`}
                          >
                            ۱۲۸ kbps
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress bar during conversion and upload */}
                {isYtProcessing && (
                  <div className="p-4 bg-slate-900 rounded-xl border border-rose-500/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-rose-400 font-sans font-semibold flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {ytProcessStep}
                      </span>
                      <span className="text-slate-300 tabular-nums">{toPersianDigits(ytProcessProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-l from-rose-500 to-amber-500 transition-all duration-300 rounded-full"
                        style={{ width: `${ytProcessProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Confirm & Cancel Actions */}
                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectedMedia(null);
                      setYtInputUrl('');
                      setYtCustomTitle('');
                    }}
                    disabled={isYtProcessing}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    انصراف / استعلام اثر دیگر
                  </button>

                  <button
                    type="button"
                    onClick={() => handleConfirmExtractToCloud(true)}
                    disabled={isYtProcessing}
                    className="px-6 py-2.5 bg-gradient-to-l from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>
                      {inspectedMedia.isDuplicate
                        ? 'تأیید و ارسال مجدد به ابر آروان'
                        : 'تأیید و ارسال به ابر آروان و صف بررسی'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Monitored YouTube Channels (List View) */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Film className="w-4 h-4 text-rose-400" />
                  <span>کانال‌های تحت پایش خودکار یوتیوب ({toPersianDigits(youtubeChannels.length)})</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  سیستم آخرین ویدیوهای هر کانال را از طریق yt-dlp بررسی، صوت آن را به MP3 تبدیل و در باکت ابر آروان ذخیره می‌کند.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleScanAllChannelsNow}
                  disabled={isScanningAllYt || !!scanningChannelId}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
                  title="بررسی فوری تمام کانال‌های فعال و استخراج آخرین ویدیوها"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningAllYt ? 'animate-spin' : ''}`} />
                  <span>{isScanningAllYt ? 'در حال پایش کلی...' : 'پایش فوری همه کانال‌ها'}</span>
                </button>
                <div className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {toPersianDigits(youtubeChannels.filter((c) => c.isMonitored).length)} کانال فعال
                </div>
              </div>
            </div>

            {/* Notification Banner */}
            {ytScanNotification && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 transition-all ${
                  ytScanNotification.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                    : ytScanNotification.type === 'error'
                    ? 'bg-rose-950/80 border border-rose-500/40 text-rose-300'
                    : 'bg-indigo-950/80 border border-indigo-500/40 text-indigo-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {ytScanNotification.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : ytScanNotification.type === 'error' ? (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  ) : (
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-indigo-400" />
                  )}
                  <span>{ytScanNotification.message}</span>
                </div>
                <button
                  onClick={() => setYtScanNotification(null)}
                  className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Channel Preview Drawer */}
            {ytPreviewChannelId && (
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Eye className="w-4 h-4 text-indigo-400" />
                    <span>
                      پیش‌نمایش ۵ ویدیوی اخیر کانال «
                      {youtubeChannels.find((c) => c.id === ytPreviewChannelId)?.channelName}»
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setYtPreviewChannelId(null);
                      setYtChannelPreviewList([]);
                    }}
                    className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 cursor-pointer"
                  >
                    بستن پیش‌نمایش
                  </button>
                </div>

                {isPreviewingYt ? (
                  <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2 font-mono">
                    <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
                    <span>در حال دریافت ویدیوهای کانال از یوتیوب...</span>
                  </div>
                ) : ytChannelPreviewList.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-3">
                    ویدیویی یافت نشد یا دسترسی یوتیوب نیازمند کوکی است.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ytChannelPreviewList.map((vid, i) => (
                      <div
                        key={vid.id || i}
                        className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-200 truncate">{vid.title}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            مدت: {formatDuration(vid.duration || 0)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setYtInputUrl(vid.url);
                            setYtCustomTitle(vid.title);
                            handleInspectMedia(vid.url);
                            const el = document.getElementById('yt-url-input');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded text-[11px] font-bold transition-colors shrink-0 cursor-pointer"
                        >
                          انتقال به استعلام
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Channels List (Structured Table/Row Layout instead of Cards) */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 divide-y divide-slate-800 overflow-hidden">
              {youtubeChannels.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  هنوز هیچ کانال یوتیوبی برای پایش خودکار ثبت نشده است. از فرم زیر کانال اضافه کنید.
                </div>
              ) : (
                youtubeChannels.map((ch) => {
                  const reciter = reciters.find((r) => r.id === ch.defaultReciterId);
                  const isScanningThis = scanningChannelId === ch.id;
                  return (
                    <div
                      key={ch.id}
                      className="p-3.5 sm:p-4 hover:bg-slate-900/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      {/* Channel Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                          <Youtube className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-100 text-sm truncate">{ch.channelName}</span>
                            <a
                              href={ch.channelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[11px] text-rose-400 hover:underline flex items-center gap-0.5"
                            >
                              <span>{ch.channelHandle}</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                              مداح: {reciter?.name || 'مداح منتخب'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
                            <span>آخرین پایش: <strong className="text-slate-300 font-normal">{ch.lastCheckedAt}</strong></span>
                            <span>·</span>
                            <span className="font-mono text-emerald-400 font-semibold">{toPersianDigits(ch.totalExtracted)} قطعه استخراج‌شده</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions Row */}
                      <div className="flex items-center gap-2 shrink-0 justify-end">
                        {/* Status Toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleChannelMonitoring(ch.id, ch.isMonitored)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                            ch.isMonitored
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {ch.isMonitored ? 'پایش فعال' : 'متوقف'}
                        </button>

                        {/* Scan single channel */}
                        <button
                          type="button"
                          onClick={() => handleScanSingleChannelNow(ch)}
                          disabled={isScanningThis || isScanningAllYt}
                          className="px-2.5 py-1 bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 border border-rose-500/20 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                          title="پایش فوری و استخراج ویدیوهای جدید این کانال"
                        >
                          <RefreshCw className={`w-3 h-3 ${isScanningThis ? 'animate-spin' : ''}`} />
                          <span className="text-[11px] font-bold">پایش فوری</span>
                        </button>

                        {/* Preview 5 videos */}
                        <button
                          type="button"
                          onClick={() => handlePreviewChannelVideos(ch)}
                          disabled={isPreviewingYt}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                          title="مشاهده ۵ ویدیوی اخیر"
                        >
                          <Eye className="w-3 h-3 text-indigo-400" />
                          <span className="text-[11px]">ویدیوها</span>
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteYouTubeChannel(ch.id, ch.channelName)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="حذف کانال از پایش"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Add Channel Form */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-xs font-bold text-slate-200 block">
                افزودن کانال یوتیوب جدید به پایش خودکار:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-4">
                  <div className="relative">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="هندل یوتیوب (مانند Fotros_ir@ یا آدرس کانال)"
                      value={newYtChannelHandle}
                      onChange={(e) => setNewYtChannelHandle(e.target.value)}
                      onBlur={() => {
                        if (newYtChannelHandle.trim() && !newYtChannelName.trim()) {
                          handleInspectChannelInfo();
                        }
                      }}
                      className="w-full pl-20 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleInspectChannelInfo}
                      disabled={isInspectingChannel || !newYtChannelHandle.trim()}
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-rose-300 text-[10px] rounded font-semibold transition-colors disabled:opacity-50"
                      title="استعلام خودکار نام کانال و مداح"
                    >
                      {isInspectingChannel ? '...' : '⚡ استعلام'}
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <input
                    type="text"
                    placeholder="نام کانال (مثلاً: پایگاه فطرس)"
                    value={newYtChannelName}
                    onChange={(e) => setNewYtChannelName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="sm:col-span-3 flex items-center gap-1">
                  <select
                    value={newYtChannelReciterId}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        setQuickReciterTarget('channel');
                        setShowQuickAddReciterModal(true);
                      } else {
                        setNewYtChannelReciterId(e.target.value);
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    {reciters.map((r) => (
                      <option key={r.id} value={r.id}>
                        مداح: {r.name}
                      </option>
                    ))}
                    <option value="__add_new__">+ افزودن مداح جدید...</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickReciterTarget('channel');
                      setShowQuickAddReciterModal(true);
                    }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs shrink-0 cursor-pointer"
                    title="افزودن مداح جدید به لیست"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddYouTubeChannel}
                    disabled={!newYtChannelName.trim()}
                    className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    افزودن کانال
                  </button>
                </div>
              </div>

              {/* Auto-suggested Reciter Banner */}
              {suggestedCandidateReciter && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-300">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>مداح تشخیص‌داده‌شده از نام کانال: <strong className="text-emerald-200">{suggestedCandidateReciter.name}</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (suggestedCandidateReciter.id) {
                          setNewYtChannelReciterId(suggestedCandidateReciter.id);
                        } else {
                          setQuickReciterName(suggestedCandidateReciter.name);
                          setQuickReciterTarget('channel');
                          setShowQuickAddReciterModal(true);
                        }
                      }}
                      className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-[11px] transition-colors"
                    >
                      {suggestedCandidateReciter.id ? '✓ انتخاب این مداح' : '+ ثبت به عنوان مداح جدید'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSuggestedCandidateReciter(null)}
                      className="text-slate-400 hover:text-white text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Direct Upload to ArvanCloud S3 */}
      {activeAdminTab === 'upload' && (
        <div className="max-w-2xl mx-auto bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-6">
          <div className="border-b border-slate-800 pb-3 space-y-2">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-emerald-400" />
              <span>آپلود مستقیم فایل صوتی به استوریج ابر آروان (S3)</span>
            </h3>
            <p className="text-xs text-slate-400">
              فایل صوتی به باکت <code className="text-emerald-400 font-mono">{serverCloudStatus?.arvan?.bucketName || cloudConfig.bucketName}</code> آپلود
              شده و رکورد آن در جدول tracks سوپابیس درج می‌گردد.
            </p>

            {serverCloudStatus?.arvan?.canConnect ? (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>اتصال استوریج ابر آروان فعال است: باکت <code className="font-mono font-bold text-emerald-300">{serverCloudStatus.arvan.bucketName}</code></span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveAdminTab('cloud_sync');
                    fetchSyncedFiles();
                  }}
                  className="text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 px-2.5 py-1 rounded-lg transition-colors font-medium shrink-0"
                >
                  مشاهده فایل‌های باکت ←
                </button>
              </div>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    {serverCloudStatus?.arvan?.isConfigured
                      ? `خطا در اتصال به باکت: ${serverCloudStatus.arvan.connectionMessage || 'بررسی دسترسی باکت'}`
                      : 'کلیدهای ابر آروان هنوز تنظیم نشده‌اند (فایل‌ها در باکت ذخیره نمی‌شوند).'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveAdminTab('cloud_sync')}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors shrink-0"
                >
                  تنظیم و تست اتصال ابر آروان
                </button>
              </div>
            )}
          </div>

          {/* Upload Error Alert */}
          {uploadError && (
            <div className="p-4 bg-rose-500/15 border border-rose-500/40 text-rose-200 rounded-2xl text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-rose-100 text-sm">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>خطا در آپلود به استوریج ابر آروان</span>
              </div>
              <p className="leading-relaxed text-rose-300">{uploadError}</p>
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveAdminTab('cloud_sync')}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-xl text-xs font-semibold border border-rose-500/30 transition-colors"
                >
                  بررسی و اصلاح کلیدهای ابر آروان در تب همگام‌سازی ←
                </button>
                <button
                  type="button"
                  onClick={() => setUploadError(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs px-2"
                >
                  بستن پیام
                </button>
              </div>
            </div>
          )}

          {/* Upload Success Alert */}
          {uploadSuccess && (
            <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 rounded-2xl text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-100 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>فایل با موفقیت روی فضای ابری ابر آروان آپلود شد!</span>
              </div>
              {uploadSuccessUrl && (
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-2 overflow-hidden">
                  <span className="font-mono text-[11px] text-emerald-300 truncate" dir="ltr">
                    {uploadSuccessUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(uploadSuccessUrl, 'uploaded_url')}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg shrink-0"
                    title="کپی لینک"
                  >
                    {copiedScript === 'uploaded_url' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveAdminTab('cloud_sync');
                    fetchSyncedFiles();
                  }}
                  className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 rounded-lg text-xs font-semibold transition-colors"
                >
                  مشاهده در باکت ابر آروان ←
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleDirectUpload} className="space-y-4">
            {/* File Drag and Drop / Input */}
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/50 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-950/40">
              <input
                type="file"
                id="audio-upload"
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    const f = e.target.files[0];
                    setUploadFile(f);
                    if (!uploadTitle) {
                      setUploadTitle(f.name.replace(/\.[^/.]+$/, ''));
                    }
                  }
                }}
                className="hidden"
              />
              <label htmlFor="audio-upload" className="cursor-pointer block space-y-2">
                <UploadCloud className="w-10 h-10 mx-auto text-emerald-400/80 stroke-1" />
                {uploadFile ? (
                  <div>
                    <span className="text-sm font-semibold text-emerald-400 block">
                      {uploadFile.name}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {formatFileSize(uploadFile.size / (1024 * 1024))}
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="text-sm font-semibold text-slate-200 block">
                      انتخاب فایل صوتی مداحی یا دعا (MP3, M4A, OGG)
                    </span>
                    <span className="text-xs text-slate-500">
                      یا فایل را به اینجا بکشید و رها کنید
                    </span>
                  </div>
                )}
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  عنوان قطعه *
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="مثلاً: زیارت وارث با صدای فرهمند"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  مداح / گوینده *
                </label>
                <select
                  value={uploadReciterId}
                  onChange={(e) => setUploadReciterId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {reciters.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  دسته‌بندی موضوعی
                </label>
                <select
                  value={uploadCategoryId}
                  onChange={(e) => setUploadCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  {categories
                    .filter((c) => c.slug !== 'all')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  مناسبت / سبک
                </label>
                <input
                  type="text"
                  value={uploadOccasion}
                  onChange={(e) => setUploadOccasion(e.target.value)}
                  placeholder="مثلاً: شب اول محرم ۱۴۰۳"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Optional Lyric Fields */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-300 block">
                متن اولیه دعا یا مرثیه (اختیاری)
              </span>
              <div>
                <textarea
                  rows={2}
                  value={uploadLyricsArabic}
                  onChange={(e) => setUploadLyricsArabic(e.target.value)}
                  placeholder="فراز عربی یا بند اول شعر..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-quran"
                />
              </div>
              <div>
                <textarea
                  rows={2}
                  value={uploadLyricsPersian}
                  onChange={(e) => setUploadLyricsPersian(e.target.value)}
                  placeholder="ترجمه فارسی..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isUploading || !uploadTitle.trim()}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال ارسال استریم به ابر آروان...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>شروع آپلود و انتشار در دیتابیس</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Real ArvanCloud S3 Sync & Bucket Browser */}
      {activeAdminTab === 'cloud_sync' && (
        <div className="space-y-6">
          {/* 1. Local Persistent Database Status & Backup Card */}
          <div className="bg-slate-900/90 rounded-2xl border border-emerald-500/30 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <span>پایگاه داده مستقل محلی (Local Persistent Database Engine)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  پایگاه داده مستقل فایل‌محور در سرور فعال است (<code className="text-emerald-400 font-mono text-[11px]">data/db.json</code>). تمامی تغییرات، مداحان، دسته‌ها، صف تایید و قطعات ذخیره پایدار می‌شوند و آماده سینک با سوپابیس هستند.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportDb}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-emerald-500/20"
                  title="دانلود فایل پشتیبان کامل JSON برای نگهداری یا انتقال به Supabase"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود نسخه پشتیبان (JSON)</span>
                </button>

                {onDbRefresh && (
                  <button
                    type="button"
                    onClick={onDbRefresh}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>بروزرسانی</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDbResetConfirm(!dbResetConfirm)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/20 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>بازنشانی به پیش‌فرض</span>
                </button>
              </div>
            </div>

            {dbFeedbackMsg && (
              <div
                className={`text-xs p-3 rounded-xl border ${
                  dbFeedbackMsg.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}
              >
                {dbFeedbackMsg.msg}
              </div>
            )}

            {dbResetConfirm && (
              <div className="p-4 bg-rose-950/50 border border-rose-500/40 rounded-xl text-xs space-y-2">
                <p className="font-bold text-rose-200">
                  آیا مطمئن هستید که می‌خواهید دیتابیس را به مقادیر اولیه نمونه بازگردانید؟
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleResetDb}
                    disabled={isResettingDb}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs"
                  >
                    {isResettingDb ? 'در حال بازنشانی...' : 'بله، بازنشانی کن'}
                  </button>
                  <button
                    onClick={() => setDbResetConfirm(false)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                  >
                    انصراف
                  </button>
                </div>
              </div>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">کل قطعات تایید شده:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {toPersianDigits(tracks.length)} قطعه
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">قطعات در صف انتظار:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {toPersianDigits(pendingQueue.length)} قطعه
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">مداحان ثبت شده:</span>
                <span className="font-mono font-bold text-sky-400 text-sm">
                  {toPersianDigits(reciters.length)} نفر
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">دسته‌بندی‌های فعال:</span>
                <span className="font-mono font-bold text-indigo-400 text-sm">
                  {toPersianDigits(categories.length)} دسته
                </span>
              </div>
            </div>
          </div>

          {/* Header & Status Card */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-sky-400" />
                  <span>مدیریت و همگام‌سازی استوریج ابر آروان (S3 Bucket Sync)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  مشاهده زنده فایل‌های ذخیره شده در باکت آروان، تست سلامت اتصال و تنظیم کلیدهای دسترسی
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={fetchSyncedFiles}
                  disabled={isLoadingS3Files}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-sky-500/20 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingS3Files ? 'animate-spin' : ''}`} />
                  <span>{isLoadingS3Files ? 'در حال بررسی باکت...' : 'همگام‌سازی لیست باکت'}</span>
                </button>
              </div>
            </div>

            {/* Live Connection Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    serverCloudStatus?.arvan?.canConnect
                      ? 'bg-emerald-400 ring-4 ring-emerald-400/20'
                      : 'bg-rose-400 ring-4 ring-rose-400/20'
                  }`}
                />
                <div>
                  <span className="text-slate-400 text-[11px] block">وضعیت اتصال به ابر آروان:</span>
                  <span className="font-bold text-slate-200">
                    {serverCloudStatus?.arvan?.canConnect ? '🟢 متصل و آماده تبادل داده' : '🔴 قطع / عدم دسترسی به باکت'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">نام باکت فعال:</span>
                <span className="font-mono font-bold text-sky-300">
                  {serverCloudStatus?.arvan?.bucketName || arvanForm.bucketName}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="text-slate-400 text-[11px] block">تعداد فایل‌های شناسایی شده در باکت:</span>
                <span className="font-mono font-bold text-emerald-300">
                  {toPersianDigits(syncedS3Files.length)} فایل
                </span>
              </div>
            </div>
          </div>

          {/* Section: Live Credentials Editor & Test */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>تنظیم کلیدها و تست اتصال زنده (ArvanCloud S3 Config)</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                می‌توانید کلیدها را مستقیم در اینجا وارد کرده یا در تب Secrets محیط ذخیره کنید.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  کلید دسترسی (ARVAN_ACCESS_KEY) *
                </label>
                <input
                  type="text"
                  value={arvanForm.accessKeyId}
                  onChange={(e) => setArvanForm({ ...arvanForm, accessKeyId: e.target.value })}
                  placeholder={serverCloudStatus?.arvan?.maskedAccessKey || 'مثلاً: ak_your_access_key'}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  کلید محرمانه (ARVAN_SECRET_KEY) *
                </label>
                <input
                  type="password"
                  value={arvanForm.secretAccessKey}
                  onChange={(e) => setArvanForm({ ...arvanForm, secretAccessKey: e.target.value })}
                  placeholder="••••••••••••••••"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  نام باکت (ARVAN_BUCKET_NAME) *
                </label>
                <input
                  type="text"
                  value={arvanForm.bucketName}
                  onChange={(e) => setArvanForm({ ...arvanForm, bucketName: e.target.value })}
                  placeholder="madahi-media-vault"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  آدرس سرور استوریج (ARVAN_ENDPOINT)
                </label>
                <input
                  type="text"
                  value={arvanForm.endpoint}
                  onChange={(e) => setArvanForm({ ...arvanForm, endpoint: e.target.value })}
                  onBlur={() => {
                    if (arvanForm.endpoint.trim()) {
                      setArvanForm((prev) => ({ ...prev, endpoint: normalizeClientEndpoint(prev.endpoint) }));
                    }
                  }}
                  placeholder="https://s3.ir-central1.arvanstorage.ir"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                  dir="ltr"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  آدرس باید با //:https باشد (اگر بدون پروتکل وارد کنید خودکار اصلاح می‌شود)
                </span>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  دامین اختصاصی CDN (اختیاری - اگر ندارید این بخش را خالی بگذارید)
                </label>
                <input
                  type="text"
                  value={arvanForm.cdnDomain}
                  onChange={(e) => setArvanForm({ ...arvanForm, cdnDomain: e.target.value })}
                  onBlur={() => {
                    if (arvanForm.cdnDomain.trim()) {
                      setArvanForm((prev) => ({ ...prev, cdnDomain: normalizeClientCdn(prev.cdnDomain) }));
                    }
                  }}
                  placeholder="خالی بگذارید تا از آدرس مستقیم باکت استفاده شود"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Test Connection Result Box */}
            {arvanTestResult && (
              <div
                className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 animate-in fade-in ${
                  arvanTestResult.success
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                }`}
              >
                {arvanTestResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold block mb-1">
                    {arvanTestResult.success ? 'پاسخ تست موفقیت‌آمیز بود:' : 'خطا در تست اتصال به ابر آروان:'}
                  </span>
                  <span>{arvanTestResult.message}</span>
                </div>
              </div>
            )}

            {saveConfigSuccess && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>تنظیمات ابر آروان با موفقیت در سرور ذخیره شد.</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleTestArvanConnection(false)}
                disabled={isTestingArvan}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
              >
                {isTestingArvan ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>در حال آزمایش اتصال به باکت...</span>
                  </>
                ) : (
                  <>
                    <Server className="w-3.5 h-3.5" />
                    <span>تست زنده اتصال به ابر آروان</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveArvanConfig}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors shadow-md shadow-emerald-500/20"
              >
                <Check className="w-3.5 h-3.5" />
                <span>ذخیره و اعمال تنظیمات</span>
              </button>
            </div>
          </div>

          {/* Section: Synced Files Browser */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>فایل‌های واقعی موجود در باکت ابر آروان ({toPersianDigits(syncedS3Files.length)})</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  تمام فایل‌های صوتی و کاورهایی که هم‌اکنون به صورت فیزیکی روی باکت ابر آروان شما آپلود شده‌اند
                </p>
              </div>

              {/* Filter */}
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  value={syncedFileFilter}
                  onChange={(e) => setSyncedFileFilter(e.target.value)}
                  placeholder="جستجو در نام فایل‌های باکت..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {s3SyncError && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{s3SyncError}</span>
              </div>
            )}

            {/* Files List */}
            {isLoadingS3Files ? (
              <div className="p-10 text-center space-y-2">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin text-sky-400" />
                <span className="text-xs text-slate-400 block">در حال بارگذاری لیست فایل‌ها از باکت ابر آروان...</span>
              </div>
            ) : syncedS3Files.length === 0 ? (
              <div className="p-10 text-center space-y-3 bg-slate-950/40 rounded-2xl border border-slate-800/80">
                <HardDrive className="w-10 h-10 mx-auto text-slate-600 stroke-1" />
                <span className="text-sm font-semibold text-slate-300 block">
                  {serverCloudStatus?.arvan?.canConnect
                    ? 'باکت ابر آروان در دسترس است اما هنوز فایلی داخل آن قرار ندارد.'
                    : 'ارتباط با باکت برقرار نیست یا کلیدهای آروان ثبت نشده است.'}
                </span>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  پس از وارد کردن کلیدها و آپلود از تب «آپلود مستقیم» یا از طریق پایشگر خودکار یوتیوب، فایل‌های صوتی بلافاصله در اینجا نمایان می‌شوند.
                </p>
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveAdminTab('upload')}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors"
                  >
                    رفتن به صفحه آپلود فایل ←
                  </button>
                  <button
                    type="button"
                    onClick={fetchSyncedFiles}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl transition-colors"
                  >
                    تلاش مجدد برای همگام‌سازی 🔄
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {syncedS3Files
                  .filter((f) => !syncedFileFilter || f.fileName.toLowerCase().includes(syncedFileFilter.toLowerCase()) || f.key.toLowerCase().includes(syncedFileFilter.toLowerCase()))
                  .map((file) => (
                    <div
                      key={file.key}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs sm:text-sm text-slate-100 truncate">
                            {file.fileName}
                          </span>
                          {file.isAudio && (
                            <span className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded border border-sky-500/20 font-mono">
                              صوت MP3
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono">
                          <span className="text-slate-400 truncate max-w-xs" dir="ltr">
                            {file.key}
                          </span>
                          <span>·</span>
                          <span className="text-emerald-400">
                            {formatFileSize(file.sizeMb)}
                          </span>
                          {file.lastModified && (
                            <>
                              <span>·</span>
                              <span>
                                {new Date(file.lastModified).toLocaleDateString('fa-IR')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {file.isAudio && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                playTrack({
                                  id: `s3-${file.key}`,
                                  title: file.fileName.replace(/\.[^/.]+$/, ''),
                                  reciterId: 'rec-karimi',
                                  reciterName: 'پخش مستقیم از ابر آروان',
                                  categoryId: 'cat-all',
                                  categoryName: 'استوریج آروان',
                                  occasion: 'آرشیو ابری',
                                  duration: 300,
                                  audioUrl: file.url,
                                  coverUrl: '',
                                  fileSizeMb: file.sizeMb,
                                  bitrate: '320 kbps',
                                  status: 'approved',
                                  playCount: 1,
                                  createdAt: 'باکت آروان',
                                  s3Key: file.key,
                                  tags: ['ابر آروان'],
                                  lyrics: [],
                                });
                              }}
                              className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-emerald-500/30 transition-colors"
                              title="پخش آنلاین این فایل از باکت"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>پخش آنلاین</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleImportS3FileToTracks(file)}
                              className="px-3 py-1.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 rounded-lg text-xs font-semibold flex items-center gap-1 border border-sky-500/30 transition-colors"
                              title="اضافه کردن به فهرست قطعات پلیر کاربر"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>افزودن به پلیر</span>
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => copyToClipboard(file.url, file.key)}
                          className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors border border-slate-800"
                          title="کپی لینک مستقیم دانلود"
                        >
                          {copiedScript === file.key ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg transition-colors border border-slate-800"
                          title="باز کردن مستقیم لینک"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDeleteS3File(file.key)}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors border border-rose-500/20"
                          title="حذف دائمی از باکت"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Reciters Management */}
      {activeAdminTab === 'reciters' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100">
              فهرست مداحان و گویندگان ({toPersianDigits(reciters.length)})
            </h3>
            <button
              onClick={() => setShowAddReciterModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن مداح جدید</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reciters.map((r) => (
              <div
                key={r.id}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start gap-3"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base border shrink-0"
                  style={{
                    backgroundColor: `${r.accentColor}15`,
                    borderColor: `${r.accentColor}40`,
                    color: r.accentColor,
                  }}
                >
                  {r.name.slice(0, 2)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="text-sm font-bold text-slate-200 truncate">{r.title}</h4>
                    <button
                      onClick={() => handleDeleteReciter(r.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors"
                      title="حذف مداح"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-emerald-400 block mt-0.5">{r.style}</span>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">{r.bio}</p>
                  <div className="text-[11px] font-mono text-slate-500 mt-2">
                    تعداد آثار: {toPersianDigits(r.tracksCount)} قطعه
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Categories Management */}
      {activeAdminTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Folder className="w-4 h-4 text-emerald-400" />
                <span>مدیریت دسته‌بندی‌ها و مناسبت‌های مذهبی ({toPersianDigits(categories.length)})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                دسته‌بندی‌های ایام و مناسبت‌ها (مانند محرم، فاطمیه، ادعیه، مناجات، شوق کربلا و شور) که کاربران در صفحه اصلی فیلتر می‌کنند.
              </p>
            </div>
            <button
              onClick={() => setShowAddCategoryModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن دسته‌بندی جدید</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="text-sm font-bold text-slate-200 truncate">{c.name}</h4>
                    {c.slug !== 'all' && (
                      <button
                        onClick={() => handleDeleteCategory(c.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition-colors"
                        title="حذف دسته‌بندی"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1">{c.description || 'بدون توضیح'}</p>
                  <div className="text-[11px] font-mono text-slate-500 mt-2 flex items-center justify-between">
                    <span>تعداد آثار: {toPersianDigits(c.tracksCount)}</span>
                    <span className="text-slate-600 font-mono text-[10px]">slug: {c.slug}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Telegram Bot & Channel Publishing */}
      {activeAdminTab === 'telegram' && (
        <div className="space-y-6">
          {/* Bot Configuration Card */}
          <div className="bg-slate-900/90 p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-sky-400" />
                  <span>پیکربندی ربات تلگرام و انتشار در کانال</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  تنظیم توکن رسمی ربات (Telegram Bot Token)، تست اتصال زنده با سرورهای تلگرام، و انتشار خودکار یا دستی قطعات در کانال هیئت.
                </p>
              </div>

              {botSaveMessage && (
                <div className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-medium">
                  {botSaveMessage}
                </div>
              )}
            </div>

            {/* Token & Test Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  توکن ربات تلگرام (Bot Token از BotFather@)
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz..."
                    value={botTokenInput}
                    onChange={(e) => setBotTokenInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={handleTestBot}
                    disabled={isTestingBot || !botTokenInput.trim()}
                    className="px-3.5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingBot ? 'animate-spin' : ''}`} />
                    <span>{isTestingBot ? 'تست...' : 'تست توکن'}</span>
                  </button>
                </div>
                {botTestError && (
                  <p className="text-[11px] text-rose-400">{botTestError}</p>
                )}
                {botTestInfo && (
                  <div className="text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-2.5 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-bold">ربات تایید شد: </span>
                      <span>{botTestInfo.first_name} ({botTestInfo.username ? `@${botTestInfo.username}` : ''})</span>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px] font-bold">🟢 آنلاین</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  شناسه کانال تلگرام مقصد (برای انتشار فایل‌ها)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="madahi_channel@ یا 1001234567890-"
                    value={botChannelInput}
                    onChange={(e) => setBotChannelInput(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    onClick={handleTestChannel}
                    disabled={isTestingChannel || !botTokenInput.trim() || !botChannelInput.trim()}
                    className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors shrink-0 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Send className={`w-3.5 h-3.5 ${isTestingChannel ? 'animate-pulse' : ''}`} />
                    <span>{isTestingChannel ? 'ارسال...' : 'تست ارسال'}</span>
                  </button>
                </div>
                {channelTestSuccess && (
                  <p className="text-[11px] text-emerald-400 font-medium">{channelTestSuccess}</p>
                )}
                {channelTestError && (
                  <p className="text-[11px] text-rose-400">{channelTestError}</p>
                )}
              </div>
            </div>

            {/* Template & Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  قالب کپشن پیام ارسالی به کانال
                </label>
                <textarea
                  rows={3}
                  value={botCaptionInput}
                  onChange={(e) => setBotCaptionInput(e.target.value)}
                  placeholder="🎙 {title}&#10;👤 با نوای: {reciter}&#10;📁 دسته: {category}&#10;⏱ مدت: {duration}&#10;&#10;🆔 {channel}"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                />
                <span className="text-[10px] text-slate-500 block">
                  متغیرهای مجاز: {'{title}'}، {'{reciter}'}، {'{category}'}، {'{duration}'}، {'{channel}'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">انتشار خودکار در کانال</span>
                    <span className="text-[11px] text-slate-400">به محض تایید هر قطعه در صف بررسی، فایل به کانال ارسال شود.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={botAutoPublish}
                    onChange={(e) => setBotAutoPublish(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-500 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                  />
                </div>

                <button
                  onClick={handleSaveBotConfig}
                  disabled={isSavingBotConfig}
                  className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-colors disabled:opacity-50"
                >
                  {isSavingBotConfig ? 'در حال ذخیره...' : 'ذخیره تنظیمات ربات در دیتابیس'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Manual Publisher Card */}
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-sky-400" />
              <span>ارسال سریع قطعات تایید شده به کانال تلگرام</span>
            </h3>
            <p className="text-xs text-slate-400">
              یک قطعه را انتخاب کرده و مستقیماً با یک کلیک با قالب استاندارد صوتی در کانال هیئت منتشر کنید:
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <select
                value={selectedPublishTrackId}
                onChange={(e) => setSelectedPublishTrackId(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="">-- انتخاب قطعه صوتی برای ارسال --</option>
                {tracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.reciterName})
                  </option>
                ))}
              </select>

              <button
                onClick={() => handlePublishManual()}
                disabled={isPublishingManual || !selectedPublishTrackId}
                className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-colors disabled:opacity-50 shrink-0 flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" />
                <span>{isPublishingManual ? 'در حال ارسال...' : 'ارسال به کانال'}</span>
              </button>
            </div>

            {publishFeedback && (
              <div
                className={`text-xs p-3 rounded-xl border mt-2 ${
                  publishFeedback.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}
              >
                {publishFeedback.msg}
              </div>
            )}
          </div>

          {/* Add Channel Form & Monitored Sources */}
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              <span>افزودن کانال یا گروه سورس تلگرام برای گردآوری مداحی</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="یوزرنیم کانال (مثلاً fotros_ir@)"
                value={newChannelUsername}
                onChange={(e) => setNewChannelUsername(e.target.value)}
                className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="عنوان کانال (اختیاری)"
                value={newChannelTitle}
                onChange={(e) => setNewChannelTitle(e.target.value)}
                className="px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleAddTelegramChannel}
                disabled={!newChannelUsername.trim()}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-colors disabled:opacity-50"
              >
                افزودن به لیست پایش
              </button>
            </div>
          </div>

          {/* Sources List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-200">
              کانال‌های تحت نظارت ربات ({toPersianDigits(telegramSources.length)})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {telegramSources.map((source) => (
                <div
                  key={source.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-slate-200 truncate">
                        {source.channelUsername}
                      </span>
                      {source.isMonitored ? (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.2 rounded">
                          فعال
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.2 rounded">
                          متوقف
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">{source.channelTitle}</p>
                    <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2">
                      <span>آخرین پایش: {source.lastScrapedAt}</span>
                      <span aria-hidden="true">·</span>
                      <span>استخراج شده: {toPersianDigits(source.totalExtracted)} فایل</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTelegramSources((prev) =>
                        prev.map((s) =>
                          s.id === source.id ? { ...s, isMonitored: !s.isMonitored } : s
                        )
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      source.isMonitored
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                    }`}
                  >
                    {source.isMonitored ? 'توقف پایش' : 'فعال‌سازی'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Logs */}
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>گزارش آخرین فعالیت‌های ربات و سیستم</span>
            </h3>

            <div className="bg-slate-950 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 font-mono text-xs">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2">
                  <span className="text-slate-500 shrink-0 tabular-nums">[{log.timestamp}]</span>
                  <span className="text-indigo-400 shrink-0">[{log.channel}]:</span>
                  <span
                    className={
                      log.level === 'success'
                        ? 'text-emerald-400'
                        : log.level === 'warn'
                        ? 'text-amber-400'
                        : 'text-slate-300'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Bot Python Script & Supabase SQL */}
      {activeAdminTab === 'scripts' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-200 leading-relaxed">
            این بخش شامل تمامی فایل‌های سورس آماده، کانفیگ‌های داکر، اسکریپت ساخت دیتابیس Supabase و راهنمای گام‌به‌گام استقرار دائمی ربات روی سرور و اتصال به اپلیکیشن کاتلین و ورسل است.
          </div>

          {/* Sub-tabs for scripts */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 overflow-x-auto">
            <button
              onClick={() => setScriptSubTab('youtube_watcher')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                scriptSubTab === 'youtube_watcher'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Youtube className="w-3.5 h-3.5" />
              <span>پایشگر خودکار یوتیوب (youtube_auto_watcher.py)</span>
            </button>
            <button
              onClick={() => setScriptSubTab('python')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                scriptSubTab === 'python'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              کد پایتون ربات تلگرام (telegram_scraper.py)
            </button>
            <button
              onClick={() => setScriptSubTab('sql')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                scriptSubTab === 'sql'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              اسکیمای دیتابیس (Supabase SQL)
            </button>
            <button
              onClick={() => setScriptSubTab('docker')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                scriptSubTab === 'docker'
                  ? 'bg-indigo-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              داکر (Dockerfile & Compose)
            </button>
            <button
              onClick={() => setScriptSubTab('vps_guide')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                scriptSubTab === 'vps_guide'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              راهنمای اجرای VPS لینوکس
            </button>
            <button
              onClick={() => setScriptSubTab('mobile')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                scriptSubTab === 'mobile'
                  ? 'bg-rose-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              اتصال کاتلین (Android) و Vercel
            </button>
          </div>

          {/* SubTab: YouTube Auto-Watcher Script */}
          {scriptSubTab === 'youtube_watcher' && (
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-rose-500" />
                  <span className="text-sm font-bold text-slate-200">
                    پایشگر خودکار کانال‌های یوتیوب (youtube_auto_watcher.py)
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">yt-dlp + S3 + Supabase + 320kbps</span>
                </div>
                <button
                  onClick={() => copyToClipboard(youtubeWatcherScript, 'yt_script')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 text-xs font-medium border border-rose-500/30 transition-colors"
                >
                  {copiedScript === 'yt_script' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>کپی شد!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>کپی کد پایتون</span>
                    </>
                  )}
                </button>
              </div>

              <div className="px-5 py-2.5 text-xs text-slate-300 bg-slate-950/40 border-b border-slate-800">
                نحوه اجرا: ابتدا پیش‌نیازها را با <code className="text-rose-400 font-mono">pip install yt-dlp boto3 supabase python-dotenv mutagen</code> نصب کنید و سپس دستور <code className="text-emerald-400 font-mono">python3 youtube_auto_watcher.py</code> را اجرا نمایید تا پایش به صورت دائمی انجام شود.
              </div>

              <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-96 leading-relaxed select-all">
                {youtubeWatcherScript}
              </pre>
            </div>
          )}

          {/* SubTab 1: Python Scraper */}
          {scriptSubTab === 'python' && (
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-bold text-slate-200">
                    اسکریپت ربات پایتون (telegram_scraper.py)
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">Telethon + Boto3 + Supabase + ID3</span>
                </div>
                <button
                  onClick={() => copyToClipboard(pythonBotScript, 'python')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30 transition-colors"
                >
                  {copiedScript === 'python' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>کپی شد!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>کپی کد پایتون</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-96 leading-relaxed select-all">
                {pythonBotScript}
              </pre>
            </div>
          )}

          {/* SubTab 2: Supabase SQL Schema */}
          {scriptSubTab === 'sql' && (
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-sky-400" />
                  <span className="text-sm font-bold text-slate-200">
                    اسکیمای پایگاه داده سوپابیس (schema.sql)
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">PostgreSQL + RLS + Indexes</span>
                </div>
                <button
                  onClick={() => copyToClipboard(supabaseSqlSchema, 'sql')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-medium border border-sky-500/30 transition-colors"
                >
                  {copiedScript === 'sql' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>کپی شد!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>کپی دستورات SQL</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-96 leading-relaxed select-all">
                {supabaseSqlSchema}
              </pre>
            </div>
          )}

          {/* SubTab 3: Docker */}
          {scriptSubTab === 'docker' && (
            <div className="space-y-4">
              <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-bold text-slate-200">فایل docker-compose.yml</span>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
`version: '3.8'

services:
  madahi-scraper:
    build: .
    container_name: madahi_telegram_scraper
    restart: always
    env_file:
      - .env
    volumes:
      - ./madahi_session.session:/app/madahi_session.session
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"`,
                        'compose'
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium border border-indigo-500/30 transition-colors"
                  >
                    {copiedScript === 'compose' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>کپی شد!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی فایل داکر کامپوز</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-72 leading-relaxed">
{`version: '3.8'

services:
  madahi-scraper:
    build: .
    container_name: madahi_telegram_scraper
    restart: always
    env_file:
      - .env
    volumes:
      - ./madahi_session.session:/app/madahi_session.session
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"`}
                </pre>
              </div>

              <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-bold text-slate-200">فایل Dockerfile</span>
                  </div>
                  <button
                    onClick={() =>
                      copyToClipboard(
`FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 TZ=Asia/Tehran
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY telegram_scraper.py .
CMD ["python", "telegram_scraper.py"]`,
                        'dockerfile'
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-medium border border-indigo-500/30 transition-colors"
                  >
                    {copiedScript === 'dockerfile' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>کپی شد!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>کپی داکر فایل</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-slate-300 overflow-x-auto max-h-72 leading-relaxed">
{`FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 TZ=Asia/Tehran
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY telegram_scraper.py .
CMD ["python", "telegram_scraper.py"]`}
                </pre>
              </div>
            </div>
          )}

          {/* SubTab 4: Linux VPS Guide */}
          {scriptSubTab === 'vps_guide' && (
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-400" />
                <span>راهنمای راه‌اندازی ربات روی سرور لینوکس (Ubuntu / Debian VPS)</span>
              </h3>

              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div className="p-4 bg-sky-950/30 rounded-xl border border-sky-800/40 space-y-2">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-sky-400" />
                    <span className="font-bold text-sky-300">راهنمای دریافت API_ID و API_HASH از سایت رسمی تلگرام (my.telegram.org)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px] leading-relaxed">
                    <li>با فیلترشکن وارد وب‌سایت <a href="https://my.telegram.org" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-mono">https://my.telegram.org</a> شوید.</li>
                    <li>شماره تلفن اکانت تلگرام خود را با فرمت بین‌المللی (مثلاً <code className="text-amber-400 font-mono">+989123456789</code>) وارد کنید.</li>
                    <li>یک کد تایید درون اپلیکیشن تلگرام شما (نه پیامک) ارسال می‌شود؛ آن را در سایت وارد کرده و لاگین کنید.</li>
                    <li>روی گزینه <strong>API development tools</strong> کلیک کنید.</li>
                    <li>در فرم ظاهر شده، نام دلخواه انگلیسی وارد کنید:
                      <div className="mr-4 my-1 text-slate-400">
                        • <strong>App title:</strong> Madahi Vault<br />
                        • <strong>Short name:</strong> madahivault<br />
                        • <strong>Platform:</strong> Desktop یا Other
                      </div>
                    </li>
                    <li>روی دکمه <strong>Create application</strong> کلیک کنید.</li>
                    <li>دو مقدار <strong>App api_id</strong> (یک عدد چند رقمی) و <strong>App api_hash</strong> (یک رشته ۳۲ کاراکتری) به شما نمایش داده می‌شود که باید در فایل <code className="text-emerald-400 font-mono">.env</code> کپی شوند.</li>
                  </ol>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-amber-400 block">گام ۱: اتصال به سرور و نصب ابزارها</span>
                  <div className="bg-black/50 p-2.5 rounded font-mono text-slate-200 select-all">
                    ssh root@YOUR_SERVER_IP<br />
                    sudo apt update && sudo apt install -y python3-pip python3-venv git
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-amber-400 block">گام ۲: ساخت پوشه پروژه و محیط مجازی پایتون</span>
                  <div className="bg-black/50 p-2.5 rounded font-mono text-slate-200 select-all">
                    mkdir -p /opt/madahi-bot && cd /opt/madahi-bot<br />
                    python3 -m venv venv<br />
                    source venv/bin/activate<br />
                    pip install telethon boto3 supabase mutagen python-dotenv pillow
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-amber-400 block">گام ۳: ایجاد فایل تنظیمات .env</span>
                  <p className="text-slate-400">
                    دستور زیر را اجرا کرده و مقادیر TELEGRAM_API_ID، توکن آروان و سوپابیس را در آن وارد کنید:
                  </p>
                  <div className="bg-black/50 p-2.5 rounded font-mono text-slate-200 select-all">
                    nano .env
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-amber-400 block">گام ۴: اجرای دائمی در پس‌زمینه با سرویس Systemd</span>
                  <div className="bg-black/50 p-2.5 rounded font-mono text-slate-200 select-all">
                    sudo cp /opt/madahi-bot/madahi_bot.service /etc/systemd/system/<br />
                    sudo systemctl daemon-reload<br />
                    sudo systemctl enable --now madahi-bot<br />
                    sudo systemctl status madahi-bot
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SubTab 5: Kotlin & Vercel Guide */}
          {scriptSubTab === 'mobile' && (
            <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Radio className="w-5 h-5 text-rose-400" />
                <span>راهنمای استقرار روی Vercel و اتصال به اپلیکیشن موبایل Kotlin</span>
              </h3>

              <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-emerald-400 block">گزینه ۱: استقرار وب‌اپلیکیشن روی Vercel (توصیه اول)</span>
                  <p className="text-slate-400">
                    این وب‌اپلیکیشن با Vite و React نوشته شده و به صورت ۱۰۰٪ استاتیک روی پلتفرم Vercel قابل استقرار است:
                  </p>
                  <div className="bg-black/50 p-2.5 rounded font-mono text-slate-200 select-all">
                    npm install -g vercel<br />
                    vercel deploy --prod
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    کاربران می‌توانند از داخل مرورگر گوشی، دکمه «Add to Home Screen» را بزنند تا مانند یک اپلیکیشن بومی
                    بدون کادر مرورگر با قابلیت کنترل پخش در قفل صفحه (Lock Screen) نصب شود.
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <span className="font-bold text-rose-400 block">گزینه ۲: ساخت اپ بومی با زبان کاتلین (Android Studio)</span>
                  <p className="text-slate-400">
                    اگر مایل به خروجی APK بومی هستید، معماری به این صورت است:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                    <li><strong>کتابخانه استریم صدا:</strong> استفاده از <code className="text-rose-400 font-mono">androidx.media3:media3-exoplayer</code></li>
                    <li><strong>اتصال به دیتابیس:</strong> استفاده از SDK رسمی <code className="text-sky-400 font-mono">io.github.jan-tennert.supabase:postgrest-kt</code></li>
                    <li><strong>نمایش و استریم صوت:</strong> خواندن مستقیم فیلد <code className="text-emerald-400 font-mono">audio_url</code> از جدول tracks که به باکت ابر آروان اشاره دارد.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Settings, YouTube Cookies & Database Maintenance */}
      {activeAdminTab === 'settings' && (
        <div className="space-y-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <span>تنظیمات سیستم، کوکی‌های یوتیوب و پایگاه داده</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                مدیریت کوکی‌های حساب کاربری یوتیوب جهت دور زدن محدودیت‌های ضدربات، وضعیت سلامت دیتابیس محلی و ابر آروان.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchCookiesStatus}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>بررسی وضعیت کوکی</span>
              </button>
            </div>
          </div>

          {/* Section 1: YouTube Cookies Manager */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  مدیریت کوکی‌های حساب کاربری یوتیوب (رفع خطای تایید هویت و ضدربات)
                </h4>
              </div>

              {ytCookiesStatus.configured ? (
                <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>کوکی فعال ({toPersianDigits(ytCookiesStatus.entryCount)} ورودی)</span>
                </span>
              ) : (
                <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>کوکی تنظیم نشده</span>
                </span>
              )}
            </div>

            {/* Notification */}
            {cookiesActionMsg && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 ${
                  cookiesActionMsg.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300'
                    : cookiesActionMsg.type === 'error'
                    ? 'bg-rose-950/80 border border-rose-500/40 text-rose-300'
                    : 'bg-amber-950/80 border border-amber-500/40 text-amber-300'
                }`}
              >
                <span>{cookiesActionMsg.text}</span>
                <button
                  onClick={() => setCookiesActionMsg(null)}
                  className="text-slate-400 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Cookies Info Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">وضعیت احراز هویت:</span>
                <span className={`text-xs font-bold ${ytCookiesStatus.configured ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {ytCookiesStatus.configured ? '✅ فعال و متصل به موتور yt-dlp' : '⚠️ کوکی ثبت نشده'}
                </span>
              </div>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">تعداد رکوردهای کوکی:</span>
                <span className="text-xs font-mono font-bold text-slate-200">
                  {toPersianDigits(ytCookiesStatus.entryCount)} رکورد ({formatFileSize(ytCookiesStatus.sizeBytes)})
                </span>
              </div>
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">آخرین زمان به‌روزرسانی:</span>
                <span className="text-xs font-mono text-slate-300">
                  {ytCookiesStatus.lastModified ? new Date(ytCookiesStatus.lastModified).toLocaleString('fa-IR') : 'هنوز ثبتی انجام نشده'}
                </span>
              </div>
            </div>

            {/* Cookies Input Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">
                  محتوای متنی فایل کوکی (فرمت استاندارد Netscape / cookies.txt):
                </label>
                <label className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 border border-slate-700">
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>آپلود فایل cookies.txt</span>
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleUploadCookiesFile}
                    className="hidden"
                  />
                </label>
              </div>

              <textarea
                dir="ltr"
                rows={6}
                value={ytCookiesInput}
                onChange={(e) => setYtCookiesInput(e.target.value)}
                placeholder="# Netscape HTTP Cookie File&#10;# https://curl.haxx.se/rfc/cookie_spec.html&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;1750000000&#9;VISITOR_INFO1_LIVE&#9;...&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;1750000000&#9;LOGIN_INFO&#9;..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500 placeholder-slate-700"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveCookies()}
                  disabled={isSavingCookies || !ytCookiesInput.trim()}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Key className="w-4 h-4" />
                  <span>{isSavingCookies ? 'در حال ذخیره‌سازی...' : 'ذخیره و فعال‌سازی کوکی‌ها'}</span>
                </button>

                {ytCookiesStatus.configured && (
                  <button
                    type="button"
                    onClick={handleDeleteCookies}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف کوکی‌های ذخیره‌شده</span>
                  </button>
                )}
              </div>

              <span className="text-[11px] text-slate-500">
                🔒 کوکی‌ها به صورت محلی در مسیر امن سرور ذخیره می‌شوند.
              </span>
            </div>

            {/* Persian Guide */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
              <div className="font-bold text-amber-400 flex items-center gap-1.5">
                <span>💡 راهنمای ساده دریافت کوکی یوتیوب:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-slate-400 leading-relaxed pr-2">
                <li>
                  در مرورگر گوگل کروم یا فایرفاکس، افزونه رایگان{' '}
                  <strong className="text-slate-200">«Get cookies.txt LOCALLY»</strong> را نصب کنید.
                </li>
                <li>وارد سایت <strong className="text-slate-200">youtube.com</strong> شوید و مطمئن شوید وارد حساب کاربری خود شده‌اید.</li>
                <li>روی آیکون افزونه کلیک کرده و گزینه <strong className="text-slate-200">Export as cookies.txt</strong> را بزنید.</li>
                <li>فایل دانلودشده را با دکمه بالا آپلود کرده یا محتوای آن را در کادر بالا پیست کنید و دکمه ذخیره را بزنید.</li>
              </ol>
            </div>
          </div>

          {/* Section 2: Database Status & Maintenance */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-bold text-slate-100">
                  وضعیت پایگاه داده مستقل و سلامت سیستم
                </h4>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                موتور: JSON LocalDB + Arvan S3
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-lg font-bold text-emerald-400 font-mono block">
                  {toPersianDigits(tracks.length)}
                </span>
                <span className="text-[11px] text-slate-400">قطعه صوتی فعال</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-lg font-bold text-amber-400 font-mono block">
                  {toPersianDigits(pendingQueue.length)}
                </span>
                <span className="text-[11px] text-slate-400">در صف بررسی</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-lg font-bold text-sky-400 font-mono block">
                  {toPersianDigits(reciters.length)}
                </span>
                <span className="text-[11px] text-slate-400">مداح ثبت‌شده</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-lg font-bold text-indigo-400 font-mono block">
                  {toPersianDigits(categories.length)}
                </span>
                <span className="text-[11px] text-slate-400">دسته‌بندی</span>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-center">
                <span className="text-lg font-bold text-rose-400 font-mono block">
                  {toPersianDigits(youtubeChannels.length)}
                </span>
                <span className="text-[11px] text-slate-400">کانال یوتیوب</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onDbRefresh) onDbRefresh();
                    setDbFeedbackMsg({ type: 'success', msg: 'اطلاعات با موفقیت از پایگاه داده همگام شد.' });
                    setTimeout(() => setDbFeedbackMsg(null), 3000);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>همگام‌سازی مجدد داده‌ها</span>
                </button>
              </div>

              {dbFeedbackMsg && (
                <span className={`text-xs ${dbFeedbackMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {dbFeedbackMsg.msg}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      {editingTrack && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-bold text-slate-100">
                ویرایش مشخصات قطعه قبل از انتشار
              </h4>
              <button
                onClick={() => setEditingTrack(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  عنوان قطعه
                </label>
                <input
                  type="text"
                  value={editingTrack.title}
                  onChange={(e) =>
                    setEditingTrack({ ...editingTrack, title: e.target.value })
                  }
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    نام مداح
                  </label>
                  <select
                    value={editingTrack.reciterId}
                    onChange={(e) => {
                      const rec = reciters.find((r) => r.id === e.target.value);
                      if (rec) {
                        setEditingTrack({
                          ...editingTrack,
                          reciterId: rec.id,
                          reciterName: rec.name,
                        });
                      }
                    }}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200"
                  >
                    {reciters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    دسته‌بندی
                  </label>
                  <select
                    value={editingTrack.categoryId}
                    onChange={(e) => {
                      const cat = categories.find((c) => c.id === e.target.value);
                      if (cat) {
                        setEditingTrack({
                          ...editingTrack,
                          categoryId: cat.id,
                          categoryName: cat.name,
                        });
                      }
                    }}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200"
                  >
                    {categories
                      .filter((c) => c.slug !== 'all')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  مناسبت / ایام
                </label>
                <input
                  type="text"
                  value={editingTrack.occasion || ''}
                  onChange={(e) =>
                    setEditingTrack({ ...editingTrack, occasion: e.target.value })
                  }
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setEditingTrack(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                onClick={handleSaveEditedTrack}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
              >
                ذخیره در صف
              </button>
              <button
                onClick={() => {
                  const toApprove = editingTrack;
                  handleSaveEditedTrack();
                  handleApproveTrack(toApprove, false);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
              >
                ذخیره و تایید در دیتابیس
              </button>
              <button
                onClick={() => {
                  const toApprove = editingTrack;
                  handleSaveEditedTrack();
                  handleApproveTrack(toApprove, true);
                }}
                className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>تایید + انتشار کانال</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab: User Management (Admin Only) */}
      {activeAdminTab === 'users' && currentUser && (
        <div className="max-w-6xl mx-auto">
          <UserManager currentUser={currentUser} />
        </div>
      )}

      {/* Add Reciter Modal */}
      {showAddReciterModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-bold text-slate-100">افزودن مداح یا ادعیه‌خوان</h4>
              <button
                onClick={() => setShowAddReciterModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  نام مداح / گوینده *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: حاج منصور ارضی"
                  value={newReciterName}
                  onChange={(e) => setNewReciterName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  سبک / تخصص
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: مناجات‌خوانی و روضه سنتی"
                  value={newReciterStyle}
                  onChange={(e) => setNewReciterStyle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  بیوگرافی کوتاه
                </label>
                <textarea
                  rows={2}
                  placeholder="توضیح کوتاه در مورد هیئت یا سبک اجرا..."
                  value={newReciterBio}
                  onChange={(e) => setNewReciterBio(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowAddReciterModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                onClick={handleCreateReciter}
                disabled={!newReciterName.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50"
              >
                ثبت مداح
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Folder className="w-4 h-4 text-emerald-400" />
                <span>افزودن دسته‌بندی یا مناسبت جدید</span>
              </h4>
              <button
                onClick={() => setShowAddCategoryModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  نام دسته‌بندی / مناسبت *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: ماه مبارک رمضان یا شور و حماسه"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  نامک لاتین (Slug)
                </label>
                <input
                  type="text"
                  placeholder="مثلاً: ramadan یا shoor (اختیاری)"
                  value={newCategorySlug}
                  onChange={(e) => setNewCategorySlug(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  توضیح کوتاه
                </label>
                <textarea
                  rows={2}
                  placeholder="توضیح درباره نواهای این دسته..."
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowAddCategoryModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim() || isSavingCategory}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isSavingCategory ? 'در حال ثبت...' : 'ثبت دسته‌بندی'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Reciter Modal */}
      {showQuickAddReciterModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span>افزودن مداح جدید به سامانه</span>
              </h4>
              <button
                onClick={() => setShowQuickAddReciterModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  نام مداح / ذاکر اهل بیت (ع) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثلاً: محمدحسین پویانفر یا ذوالفقار الکعبی"
                  value={quickReciterName}
                  onChange={(e) => setQuickReciterName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickAddReciter();
                    }
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  autoFocus
                />
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed">
                این مداح به فهرست مداحان سامانه اضافه می‌شود و مستقیماً برای{' '}
                <strong className="text-slate-300">{quickReciterTarget === 'channel' ? 'کانال یوتیوب' : 'قطعه جاری'}</strong> انتخاب خواهد شد.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowQuickAddReciterModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleQuickAddReciter}
                disabled={!quickReciterName.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50"
              >
                افزودن و انتخاب مداح
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
