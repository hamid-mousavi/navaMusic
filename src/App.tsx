/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlayerProvider } from './context/PlayerContext';
import { Header } from './components/Header';
import { UserView } from './components/user/UserView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { MiniPlayer } from './components/player/MiniPlayer';
import { FullPlayerModal } from './components/player/FullPlayerModal';
import { CarModeModal } from './components/player/CarModeModal';
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
} from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'player' | 'admin'>('player');
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [pendingQueue, setPendingQueue] = useState<Track[]>(INITIAL_PENDING_QUEUE);
  const [reciters, setReciters] = useState<Reciter[]>(INITIAL_RECITERS);
  const [categories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [telegramSources, setTelegramSources] = useState<TelegramSource[]>(INITIAL_TELEGRAM_SOURCES);
  const [youtubeChannels, setYoutubeChannels] = useState<YouTubeChannelSource[]>(INITIAL_YOUTUBE_CHANNELS);
  const [cloudConfig] = useState<CloudStorageConfig>(INITIAL_CLOUD_CONFIG);
  const [supabaseConfig] = useState<SupabaseConfig>(INITIAL_SUPABASE_CONFIG);
  const [logs, setLogs] = useState<ScraperLog[]>(INITIAL_SCRAPER_LOGS);

  return (
    <PlayerProvider>
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
        {/* Top Navigation */}
        <Header
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          pendingCount={pendingQueue.length}
        />

        {/* Main Workspace Viewport */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6">
          {currentTab === 'player' ? (
            <UserView
              tracks={tracks}
              categories={categories}
              reciters={reciters}
            />
          ) : (
            <AdminDashboard
              tracks={tracks}
              setTracks={setTracks}
              pendingQueue={pendingQueue}
              setPendingQueue={setPendingQueue}
              reciters={reciters}
              setReciters={setReciters}
              categories={categories}
              telegramSources={telegramSources}
              setTelegramSources={setTelegramSources}
              youtubeChannels={youtubeChannels}
              setYoutubeChannels={setYoutubeChannels}
              cloudConfig={cloudConfig}
              supabaseConfig={supabaseConfig}
              logs={logs}
              setLogs={setLogs}
            />
          )}
        </main>

        {/* Persistent Bottom Floating Audio Dock */}
        <MiniPlayer />

        {/* Full-Screen Synced Prayer Player & Visualizer Modal */}
        <FullPlayerModal />

        {/* Giant Tactile Car Mode Modal for Safe Driving */}
        <CarModeModal />
      </div>
    </PlayerProvider>
  );
}
