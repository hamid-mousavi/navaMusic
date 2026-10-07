import React from 'react';
import { Play, Pause, SkipForward, SkipBack, X, RotateCcw, RotateCw, Volume2 } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { formatDuration, toPersianDigits } from '../../utils/formatters';

export const CarModeModal: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    nextTrack,
    prevTrack,
    skipForward,
    skipBackward,
    isCarMode,
    setIsCarMode,
  } = usePlayer();

  if (!isCarMode || !currentTrack) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-6 select-none animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
          <span className="text-amber-400 font-bold tracking-wider text-sm">
            حالت رانندگی (دسترسی سریع)
          </span>
        </div>
        <button
          onClick={() => setIsCarMode(false)}
          className="p-3 bg-neutral-900 text-white rounded-2xl border border-neutral-800 flex items-center gap-2"
        >
          <X className="w-6 h-6" />
          <span className="text-sm font-bold">خروج</span>
        </button>
      </div>

      {/* Main Track Display */}
      <div className="text-center my-auto space-y-4">
        <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-base font-semibold">
          {currentTrack.reciterName}
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-snug max-w-2xl mx-auto">
          {currentTrack.title}
        </h1>
        <div className="text-lg text-neutral-400 font-mono tabular-nums">
          {toPersianDigits(formatDuration(currentTime))} / {toPersianDigits(formatDuration(duration))}
        </div>
      </div>

      {/* Huge Touch Controls */}
      <div className="space-y-6">
        {/* Quick skip 15s */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => skipBackward(15)}
            className="py-5 bg-neutral-900 active:bg-neutral-800 text-neutral-200 rounded-3xl flex items-center justify-center gap-3 border border-neutral-800 text-xl font-bold"
          >
            <RotateCcw className="w-8 h-8 text-neutral-400" />
            <span>۱۵- ثانیه</span>
          </button>
          <button
            onClick={() => skipForward(15)}
            className="py-5 bg-neutral-900 active:bg-neutral-800 text-neutral-200 rounded-3xl flex items-center justify-center gap-3 border border-neutral-800 text-xl font-bold"
          >
            <span>۱۵+ ثانیه</span>
            <RotateCw className="w-8 h-8 text-neutral-400" />
          </button>
        </div>

        {/* Primary Row: Prev, Play, Next */}
        <div className="grid grid-cols-3 gap-4 items-center">
          <button
            onClick={prevTrack}
            className="h-28 bg-neutral-900 active:bg-neutral-800 text-white rounded-3xl flex items-center justify-center border border-neutral-800"
          >
            <SkipBack className="w-12 h-12" />
          </button>

          <button
            onClick={togglePlay}
            className="h-28 bg-emerald-500 active:bg-emerald-600 text-slate-950 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/40"
          >
            {isPlaying ? (
              <Pause className="w-14 h-14 fill-current" />
            ) : (
              <Play className="w-14 h-14 fill-current translate-x-1" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="h-28 bg-neutral-900 active:bg-neutral-800 text-white rounded-3xl flex items-center justify-center border border-neutral-800"
          >
            <SkipForward className="w-12 h-12" />
          </button>
        </div>
      </div>
    </div>
  );
};
