/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { PlayerProvider } from './context/PlayerContext';
import { Header } from './components/Header';
import { UserView } from './components/user/UserView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { MiniPlayer } from './components/player/MiniPlayer';
import { FullPlayerModal } from './components/player/FullPlayerModal';
import { CarModeModal } from './components/player/CarModeModal';
import { LoginModal } from './components/admin/LoginModal';
import {
  INITIAL_TRACKS,
  INITIAL_PENDING_QUEUE,
  INITIAL_RECITERS,
  INITIAL_CATEGORIES,
  INITIAL_TELEGRAM_SOURCES,
  INITIAL_YOUTUBE_CHANNELS,
  INITIAL_CLOUD_CONFIG,
  INITIAL_SUPABASE_CONFIG,
  INITIAL_SCRAPER_LOGS,
} from './data/initialData';
import {
  Track,
  Reciter,
  Category,
  TelegramSource,
  YouTubeChannelSource,
  CloudStorageConfig,
  SupabaseConfig,
  ScraperLog,
  BotConfig,
  AuthUser,
} from './types';
import { api } from './services/api';

const DEFAULT_BOT_CONFIG: BotConfig = {
  token: '',
  username: '',
  name: 'ربات مداحی و ادعیه',
  targetChannel: '@madahi_channel',
  adminIds: '',
  welcomeMessage: 'سلام و درود! به سامانه جامع مداحی، مراثی و ادعیه خوش آمدید.\nجهت دریافت صوت، نام اثر یا مداح را ارسال نمایید.',
  channelCaptionTemplate: '🎙 {title}\n👤 با نوای: {reciter}\n📁 دسته: {category}\n⏱ مدت زمان: {duration}\n\n🆔 {channel}',
  autoPublishApproved: false,
  botActive: false,
  lastTestedAt: null,
};

export default function App() {
  const [currentTab, setCurrentTab] = useState<'player' | 'admin'>('player');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [pendingQueue, setPendingQueue] = useState<Track[]>(INITIAL_PENDING_QUEUE);
  const [reciterList, setReciterList] = useState<Reciter[]>(INITIAL_RECITERS);
  const [categoryList, setCategoryList] = useState<Category[]>(INITIAL_CATEGORIES);
  const [telegramSources, setTelegramSources] = useState<TelegramSource[]>(INITIAL_TELEGRAM_SOURCES);
  const [youtubeChannels, setYoutubeChannels] = useState<YouTubeChannelSource[]>(INITIAL_YOUTUBE_CHANNELS);
  const [cloudConfig] = useState<CloudStorageConfig>(INITIAL_CLOUD_CONFIG);
  const [supabaseConfig] = useState<SupabaseConfig>(INITIAL_SUPABASE_CONFIG);
  const [logs, setLogs] = useState<ScraperLog[]>(INITIAL_SCRAPER_LOGS);
  const [botConfig, setBotConfig] = useState<BotConfig>(DEFAULT_BOT_CONFIG);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // بررسی احراز هویت اولیه کاربر هنگام بارگذاری برنامه
  useEffect(() => {
    api.getMe().then((user) => {
      if (user) {
        setCurrentUser(user);
      }
    });
  }, []);

  // همگام‌سازی با پایگاه داده برخط
  const refreshFromDb = useCallback(async () => {
    try {
      const db = await api.getFullDatabase();
      if (db) {
        if (Array.isArray(db.tracks)) setTracks(db.tracks);
        if (Array.isArray(db.pendingQueue)) setPendingQueue(db.pendingQueue);
        if (Array.isArray(db.reciters)) setReciterList(db.reciters);
        if (Array.isArray(db.categories)) setCategoryList(db.categories);
        if (Array.isArray(db.youtubeChannels)) setYoutubeChannels(db.youtubeChannels);
        if (Array.isArray(db.telegramSources)) setTelegramSources(db.telegramSources);
        if (db.botConfig) setBotConfig(db.botConfig);
        if (Array.isArray(db.logs)) setLogs(db.logs);
      }
    } catch (e) {
      console.warn('Initial DB fetch notice:', e);
    } finally {
      setIsDbLoaded(true);
    }
  }, []);

  useEffect(() => {
    refreshFromDb();
  }, [refreshFromDb]);

  const handleTabChange = (tab: 'player' | 'admin') => {
    if (tab === 'admin' && !currentUser) {
      setIsLoginModalOpen(true);
      return;
    }
    setCurrentTab(tab);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (_) {}
    setCurrentUser(null);
    setCurrentTab('player');
  };

  return (
    <PlayerProvider>
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
        {/* نوار ناوبری بالا با وضعیت ورود کاربر */}
        <Header
          currentTab={currentTab}
          setCurrentTab={handleTabChange}
          pendingCount={pendingQueue.length}
          currentUser={currentUser}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* محتوای اصلی بر اساس تب انتخاب شده */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6">
          {currentTab === 'player' || !currentUser ? (
            <UserView
              tracks={tracks}
              categories={categoryList}
              reciters={reciterList}
            />
          ) : (
            <AdminDashboard
              currentUser={currentUser}
              tracks={tracks}
              setTracks={setTracks}
              pendingQueue={pendingQueue}
              setPendingQueue={setPendingQueue}
              reciters={reciterList}
              setReciters={setReciterList}
              categories={categoryList}
              setCategories={setCategoryList}
              telegramSources={telegramSources}
              setTelegramSources={setTelegramSources}
              youtubeChannels={youtubeChannels}
              setYoutubeChannels={setYoutubeChannels}
              cloudConfig={cloudConfig}
              supabaseConfig={supabaseConfig}
              botConfig={botConfig}
              setBotConfig={setBotConfig}
              logs={logs}
              setLogs={setLogs}
              onDbRefresh={refreshFromDb}
            />
          )}
        </main>

        {/* پلیر شناور پایین صفحه */}
        <MiniPlayer />

        {/* مدال تمام‌صفحه پلیر و فرازهای دعا */}
        <FullPlayerModal />

        {/* مدال حالت رانندگی (Car Mode) */}
        <CarModeModal />

        {/* دیالوگ ورود مدیران و بررسی‌کنندگان */}
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setCurrentTab('admin');
          }}
        />
      </div>
    </PlayerProvider>
  );
}
