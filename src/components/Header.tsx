import React from 'react';
import { Radio, Car, ShieldCheck, Headphones, Layers, Sparkles, Clock } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { toPersianDigits } from '../utils/formatters';

interface HeaderProps {
  currentTab: 'player' | 'admin';
  setCurrentTab: (tab: 'player' | 'admin') => void;
  pendingCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  pendingCount,
}) => {
  const { isCarMode, setIsCarMode, setIsFullPlayerOpen, sleepTimerRemaining } = usePlayer();

  return (
    <header className="sticky top-0 z-30 w-full bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single-element Brand Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
            <Radio className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
            نوای آسمانی
          </span>
        </div>

        {/* Zone 2: Navigation Links / Segmented Mode Switcher */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setCurrentTab('player')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              currentTab === 'player'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Headphones className="w-4 h-4" />
            <span>پلیر صوتی</span>
          </button>

          <button
            onClick={() => setCurrentTab('admin')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              currentTab === 'admin'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>پنل مدیریت و ربات</span>
            {pendingCount > 0 && (
              <span className="bg-amber-500/20 text-amber-300 text-xs px-1.5 py-0.2 rounded font-mono tabular-nums">
                {toPersianDigits(pendingCount)}
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-2">
          {sleepTimerRemaining !== null && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/40 text-indigo-300 text-xs font-mono">
              <Clock className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
              <span>{toPersianDigits(Math.ceil(sleepTimerRemaining / 60))} دقیقه</span>
            </div>
          )}

          <button
            onClick={() => setIsCarMode(!isCarMode)}
            title="حالت خودرو / رانندگی"
            className={`p-2 rounded-lg transition-colors border ${
              isCarMode
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
            }`}
          >
            <Car className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsFullPlayerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors whitespace-nowrap"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">متن و لیریک</span>
          </button>
        </div>
      </div>
    </header>
  );
};
