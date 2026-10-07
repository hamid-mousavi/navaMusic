import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Maximize2, Bookmark, Car, Clock } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { formatDuration, toPersianDigits } from '../../utils/formatters';

export const MiniPlayer: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    seek,
    nextTrack,
    prevTrack,
    volume,
    setVolume,
    isMuted,
    toggleMute,
    setIsFullPlayerOpen,
    isCarMode,
    setIsCarMode,
    activeLyricIndex,
    favorites,
    toggleFavorite,
  } = usePlayer();

  if (!currentTrack) return null;

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const currentLyric = activeLyricIndex >= 0 && currentTrack.lyrics?.[activeLyricIndex];
  const isFav = favorites.includes(currentTrack.id);

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 shadow-2xl">
      {/* Top scrubber progress bar */}
      <div
        className="w-full h-1.5 bg-slate-800 hover:h-2.5 transition-all cursor-pointer relative group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          // RTL inverted calculation or LTR depending on rect
          // Let's calculate based on click X from right or left:
          // In RTL, left is 100% and right is 0%
          const clickX = e.clientX - rect.left;
          const pct = 1 - (clickX / rect.width);
          seek(Math.max(0, Math.min(pct * duration, duration)));
        }}
      >
        <div
          className="h-full bg-gradient-to-l from-emerald-400 to-teal-500 relative transition-all"
          style={{ width: `${progressPercentage}%` }}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Track Info & Artwork */}
        <div
          className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial cursor-pointer"
          onClick={() => setIsFullPlayerOpen(true)}
        >
          {/* Cover Art / Islamic Graphic Monogram */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-900/60 to-slate-900 border border-emerald-500/20 flex items-center justify-center shrink-0 overflow-hidden relative group">
            <span className="text-emerald-400 font-bold text-sm tracking-wider">
              {currentTrack.reciterName.slice(0, 2)}
            </span>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Maximize2 className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-100 truncate hover:text-emerald-400 transition-colors">
                {currentTrack.title}
              </h4>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="truncate">{currentTrack.reciterName}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="hidden md:inline text-slate-500">{currentTrack.categoryName}</span>
              {currentLyric && (
                <>
                  <span aria-hidden="true" className="hidden lg:inline text-slate-600">·</span>
                  <span className="hidden lg:inline text-emerald-400/90 font-quran text-xs truncate max-w-xs">
                    {currentLyric.textArabic}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={prevTrack}
              title="قطعه قبلی"
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button
              onClick={togglePlay}
              title={isPlaying ? 'توقف' : 'پخش'}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-transform active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current translate-x-0.5" />
              )}
            </button>

            <button
              onClick={nextTrack}
              title="قطعه بعدی"
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Timecode Indicators */}
          <div className="text-[11px] text-slate-400 font-mono tabular-nums flex items-center gap-1">
            <span>{toPersianDigits(formatDuration(currentTime))}</span>
            <span className="text-slate-600">/</span>
            <span>{toPersianDigits(formatDuration(duration))}</span>
          </div>
        </div>

        {/* Left Side: Volume, Mode & Full View Actions */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <button
            onClick={() => toggleFavorite(currentTrack.id)}
            title="افزودن به علاقه‌مندی‌ها"
            className={`p-2 rounded-lg transition-colors ${
              isFav ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={() => setIsCarMode(!isCarMode)}
            title="حالت رانندگی / خودرو"
            className={`p-2 rounded-lg transition-colors ${
              isCarMode ? 'text-amber-400 bg-amber-400/10' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Car className="w-4 h-4" />
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-slate-400 hover:text-slate-200 p-1"
            >
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
              className="w-16 h-1 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          <button
            onClick={() => setIsFullPlayerOpen(true)}
            title="نمایش تمام صفحه و متن دعا"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>متن</span>
          </button>
        </div>
      </div>
    </div>
  );
};
