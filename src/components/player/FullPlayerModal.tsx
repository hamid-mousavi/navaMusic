import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  RotateCw,
  Repeat,
  Shuffle,
  Volume2,
  VolumeX,
  Bookmark,
  Share2,
  Download,
  Moon,
  Clock,
  Sparkles,
  Link,
  Check,
  Music,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { formatDuration, toPersianDigits, formatFileSize } from '../../utils/formatters';

export const FullPlayerModal: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    seek,
    skipForward,
    skipBackward,
    nextTrack,
    prevTrack,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    playbackRate,
    setPlaybackRate,
    repeatMode,
    toggleRepeat,
    isShuffled,
    toggleShuffle,
    activeLyricIndex,
    sleepTimerMinutes,
    setSleepTimer,
    sleepTimerRemaining,
    isFullPlayerOpen,
    setIsFullPlayerOpen,
    favorites,
    toggleFavorite,
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<'lyrics' | 'info'>('lyrics');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('large');

  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLyricRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to active lyric line smoothly
  useEffect(() => {
    if (activeLyricRef.current && lyricsContainerRef.current) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeLyricIndex]);

  if (!isFullPlayerOpen || !currentTrack) return null;

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isFav = favorites.includes(currentTrack.id);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentTrack.audioUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Bar Header */}
      <header className="h-16 px-4 sm:px-8 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        <button
          onClick={() => setIsFullPlayerOpen(false)}
          className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 transition-colors"
          title="بستن پنجره"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center max-w-md truncate px-2">
          <h3 className="text-sm font-semibold text-slate-100 truncate">
            {currentTrack.title}
          </h3>
          <p className="text-xs text-emerald-400 font-medium truncate">
            {currentTrack.reciterName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSleepModal(true)}
            title="تایمر خواب"
            className={`p-2 rounded-xl transition-colors border ${
              sleepTimerMinutes !== null
                ? 'bg-indigo-950 border-indigo-700 text-indigo-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
          </button>

          <button
            onClick={() => toggleFavorite(currentTrack.id)}
            title="نشانه‌گذاری و علاقه‌مندی"
            className={`p-2 rounded-xl border transition-colors ${
              isFav
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
        {/* Left Column (Desktop) / Visualizer & Metadata */}
        <div className="lg:col-span-5 flex flex-col justify-center items-center gap-6 text-center">
          {/* Cover & Audio Visualizer */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl bg-gradient-to-tr from-slate-900 via-slate-900 to-emerald-950/60 border border-emerald-500/20 shadow-2xl flex flex-col items-center justify-center p-6 overflow-hidden">
            {/* Ambient light circle */}
            <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl" />

            <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-inner">
              <Music className="w-10 h-10" />
            </div>

            <span className="text-xl font-bold text-slate-100 tracking-tight mb-1">
              {currentTrack.reciterName}
            </span>
            <span className="text-xs text-slate-400 mb-4">
              {currentTrack.occasion || currentTrack.categoryName}
            </span>

            {/* Audio Wave Bars Simulation */}
            <div className="flex items-end gap-1.5 h-8">
              {[40, 75, 95, 60, 85, 100, 70, 90, 45, 65, 80, 50].map((h, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full bg-emerald-400/80 transition-all duration-300 ${
                    isPlaying ? 'animate-pulse' : 'opacity-40'
                  }`}
                  style={{
                    height: isPlaying ? `${Math.max(20, (h * (i % 2 === 0 ? 1 : 0.7)))}%` : '20%',
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              ))}
            </div>

            {/* Storage source badge */}
            <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>ابر آروان S3</span>
              <span className="text-slate-600">·</span>
              <span className="font-mono tabular-nums">{currentTrack.bitrate}</span>
              <span className="text-slate-600">·</span>
              <span className="font-mono tabular-nums">{formatFileSize(currentTrack.fileSizeMb)}</span>
            </div>
          </div>

          {/* Quick link & download actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition-colors"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">لینک کپی شد</span>
                </>
              ) : (
                <>
                  <Link className="w-3.5 h-3.5 text-slate-400" />
                  <span>کپی لینک مستقیم S3</span>
                </>
              )}
            </button>

            <a
              href={currentTrack.audioUrl}
              download={`${currentTrack.title}.mp3`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>دانلود فایل</span>
            </a>
          </div>
        </div>

        {/* Right Column: Synced Prayer Lyrics / Texts View */}
        <div className="lg:col-span-7 flex flex-col min-h-0 bg-slate-900/50 rounded-2xl border border-slate-800/80 p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-slate-200">
                متن هماهنگ دعا و مرثیه
              </span>
            </div>

            {/* Font size controller */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              <button
                onClick={() => setFontSize('normal')}
                className={`px-2 py-0.5 rounded ${
                  fontSize === 'normal' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500'
                }`}
              >
                کوچک
              </button>
              <button
                onClick={() => setFontSize('large')}
                className={`px-2 py-0.5 rounded ${
                  fontSize === 'large' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500'
                }`}
              >
                متوسط
              </button>
              <button
                onClick={() => setFontSize('xlarge')}
                className={`px-2 py-0.5 rounded ${
                  fontSize === 'xlarge' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500'
                }`}
              >
                بزرگ
              </button>
            </div>
          </div>

          {/* Scrolling lyrics list */}
          <div
            ref={lyricsContainerRef}
            className="flex-1 overflow-y-auto space-y-4 pr-1 pl-2 select-text"
          >
            {currentTrack.lyrics && currentTrack.lyrics.length > 0 ? (
              currentTrack.lyrics.map((lyric, idx) => {
                const isActive = idx === activeLyricIndex;
                return (
                  <div
                    key={lyric.id}
                    ref={isActive ? activeLyricRef : null}
                    onClick={() => seek(lyric.time)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all duration-300 ${
                      isActive
                        ? 'bg-emerald-950/40 border border-emerald-500/40 shadow-lg text-slate-50 translate-x-1'
                        : 'hover:bg-slate-800/40 text-slate-400 opacity-60 hover:opacity-90'
                    }`}
                  >
                    {/* Arabic text with specialized font */}
                    <p
                      className={`font-quran leading-loose mb-1 text-right transition-all ${
                        fontSize === 'normal'
                          ? 'text-base'
                          : fontSize === 'large'
                          ? 'text-lg sm:text-xl'
                          : 'text-xl sm:text-2xl'
                      } ${isActive ? 'text-emerald-300 font-bold' : 'text-slate-300'}`}
                    >
                      {lyric.textArabic}
                    </p>

                    {/* Persian translation */}
                    <p
                      className={`leading-relaxed text-right ${
                        fontSize === 'normal'
                          ? 'text-xs'
                          : fontSize === 'large'
                          ? 'text-xs sm:text-sm'
                          : 'text-sm sm:text-base'
                      } ${isActive ? 'text-slate-200 font-medium' : 'text-slate-500'}`}
                    >
                      {lyric.textPersian}
                    </p>

                    <div className="mt-1 text-[10px] font-mono text-slate-500">
                      {toPersianDigits(formatDuration(lyric.time))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-6">
                <Music className="w-12 h-12 stroke-1 mb-2 text-slate-600" />
                <p className="text-sm">متن سینک‌شده برای این قطعه هنوز ثبت نشده است.</p>
                <p className="text-xs text-slate-600 mt-1">
                  می‌توانید در پنل مدیریت لیریک همگام را برای این قطعه اضافه کنید.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Sticky Control Console */}
      <footer className="shrink-0 bg-slate-950 border-t border-slate-800 p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Scrubber slider and time display */}
          <div className="space-y-1">
            <div
              className="w-full h-2 bg-slate-800 hover:h-3 rounded-full cursor-pointer relative transition-all"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const pct = 1 - (clickX / rect.width);
                seek(Math.max(0, Math.min(pct * duration, duration)));
              }}
            >
              <div
                className="h-full bg-gradient-to-l from-emerald-400 to-teal-500 rounded-full relative"
                style={{ width: `${progressPercentage}%` }}
              >
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow" />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-slate-400 tabular-nums">
              <span>{toPersianDigits(formatDuration(currentTime))}</span>
              <span>{toPersianDigits(formatDuration(duration))}</span>
            </div>
          </div>

          {/* Primary Controls Row */}
          <div className="flex items-center justify-between">
            {/* Speed & Repeat left */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleRepeat}
                title="حالت تکرار"
                className={`p-2 rounded-lg transition-colors ${
                  repeatMode !== 'off'
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Repeat className="w-4 h-4" />
                {repeatMode === 'one' && (
                  <span className="text-[10px] font-mono absolute -top-1 -right-1 bg-emerald-500 text-slate-950 rounded-full px-1">
                    ۱
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  const rates = [0.75, 1, 1.25, 1.5];
                  const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
                  setPlaybackRate(rates[nextIdx]);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white"
                title="تغییر سرعت پخش"
              >
                {toPersianDigits(playbackRate)}x
              </button>
            </div>

            {/* Central playback cluster */}
            <div className="flex items-center gap-3 sm:gap-6">
              <button
                onClick={() => skipBackward(10)}
                title="۱۰ ثانیه به عقب"
                className="p-2 text-slate-400 hover:text-white transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                onClick={prevTrack}
                title="قطعه قبلی"
                className="p-2 text-slate-300 hover:text-white transition-colors"
              >
                <SkipBack className="w-6 h-6" />
              </button>

              <button
                onClick={togglePlay}
                title={isPlaying ? 'توقف' : 'پخش'}
                className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-xl shadow-emerald-500/30 transition-transform active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="w-7 h-7 fill-current" />
                ) : (
                  <Play className="w-7 h-7 fill-current translate-x-0.5" />
                )}
              </button>

              <button
                onClick={nextTrack}
                title="قطعه بعدی"
                className="p-2 text-slate-300 hover:text-white transition-colors"
              >
                <SkipForward className="w-6 h-6" />
              </button>

              <button
                onClick={() => skipForward(10)}
                title="۱۰ ثانیه به جلو"
                className="p-2 text-slate-400 hover:text-white transition-colors"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            </div>

            {/* Shuffle & Volume right */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleShuffle}
                title="پخش تصادفی (شافل)"
                className={`p-2 rounded-lg transition-colors ${
                  isShuffled ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shuffle className="w-4 h-4" />
              </button>

              <div className="hidden sm:flex items-center gap-2">
                <button onClick={toggleMute} className="text-slate-400 hover:text-white">
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Sleep Timer Selector Modal */}
      {showSleepModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                <h4 className="text-base font-bold text-slate-100">تنظیم تایمر خواب</h4>
              </div>
              <button
                onClick={() => setShowSleepModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              پس از اتمام زمان تعیین‌شده، پخش صوت به صورت خودکار و آرام متوقف خواهد شد.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {[5, 15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => {
                    setSleepTimer(mins);
                    setShowSleepModal(false);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border transition-colors ${
                    sleepTimerMinutes === mins
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {toPersianDigits(mins)} دقیقه
                </button>
              ))}
              <button
                onClick={() => {
                  setSleepTimer(null);
                  setShowSleepModal(false);
                }}
                className="py-2 px-3 rounded-xl text-xs font-medium bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 col-span-2"
              >
                غیرفعال کردن تایمر
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
