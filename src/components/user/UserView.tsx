import React, { useState, useMemo } from 'react';
import {
  Search,
  Play,
  Pause,
  Bookmark,
  Sparkles,
  BookOpen,
  Moon,
  Flame,
  HeartHandshake,
  Compass,
  Music,
  Share2,
  Check,
  Layers,
  Clock,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';
import { Track, Category, Reciter } from '../../types';
import { usePlayer } from '../../context/PlayerContext';
import { formatDuration, toPersianDigits, formatFileSize } from '../../utils/formatters';

interface UserViewProps {
  tracks: Track[];
  categories: Category[];
  reciters: Reciter[];
}

export const UserView: React.FC<UserViewProps> = ({
  tracks,
  categories,
  reciters,
}) => {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    favorites,
    toggleFavorite,
    setIsFullPlayerOpen,
  } = usePlayer();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedReciterId, setSelectedReciterId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState<boolean>(false);

  // Filtered tracks
  const filteredTracks = useMemo(() => {
    return tracks.filter((track) => {
      // Must be approved for public client view
      if (track.status !== 'approved') return false;

      // Category filter
      if (selectedCategory !== 'all' && track.categoryId !== selectedCategory) {
        return false;
      }

      // Reciter filter
      if (selectedReciterId && track.reciterId !== selectedReciterId) {
        return false;
      }

      // Favorites filter
      if (showOnlyFavorites && !favorites.includes(track.id)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = track.title.toLowerCase().includes(query);
        const matchesReciter = track.reciterName.toLowerCase().includes(query);
        const matchesOccasion = track.occasion?.toLowerCase().includes(query);
        const matchesTags = track.tags?.some((t) => t.toLowerCase().includes(query));
        const matchesLyrics = track.lyrics?.some(
          (l) =>
            l.textArabic.toLowerCase().includes(query) ||
            l.textPersian.toLowerCase().includes(query)
        );
        if (!matchesTitle && !matchesReciter && !matchesOccasion && !matchesTags && !matchesLyrics) {
          return false;
        }
      }

      return true;
    });
  }, [tracks, selectedCategory, selectedReciterId, showOnlyFavorites, searchQuery, favorites]);

  // Featured track for Hero spotlight
  const featuredTrack = tracks[0] || null;

  return (
    <div className="space-y-8 pb-32">
      {/* Featured Hero Banner */}
      {featuredTrack && selectedCategory === 'all' && !searchQuery && (
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 border border-emerald-500/20 p-6 sm:p-8 shadow-2xl">
          <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span>نوای برگزیده و پیشنهادی امروز</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">{featuredTrack.occasion}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                {featuredTrack.title}
              </h1>

              <div className="flex items-center gap-3 text-sm text-slate-300">
                <span className="font-medium text-emerald-300">{featuredTrack.reciterName}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-slate-400 font-mono tabular-nums">
                  مدت زمان: {toPersianDigits(formatDuration(featuredTrack.duration))}
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-slate-400 text-xs">کیفیت {featuredTrack.bitrate}</span>
              </div>

              <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 leading-relaxed">
                قرائت سوزناک و گوش‌نواز با متن عربی و ترجمه فارسی همگام. قابل استریم مستقیم از سرورهای
                داخلی ابر آروان با ترافیک نیم‌بها.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    if (currentTrack?.id === featuredTrack.id) {
                      togglePlay();
                    } else {
                      playTrack(featuredTrack);
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                >
                  {currentTrack?.id === featuredTrack.id && isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>توقف پخش</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current translate-x-0.5" />
                      <span>پخش زیارت</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    playTrack(featuredTrack);
                    setIsFullPlayerOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-sm font-medium transition-colors"
                >
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>مشاهده همراه با متن</span>
                </button>
              </div>
            </div>

            {/* Quick Arabic prayer teaser badge */}
            <div className="hidden md:flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-950/60 border border-emerald-500/20 backdrop-blur-md text-center max-w-xs shadow-inner">
              <span className="text-xs text-emerald-400 font-semibold mb-2">فراز آغازین:</span>
              <p className="font-quran text-slate-200 text-base leading-relaxed mb-2">
                «اَلسَّلامُ عَلَيْكَ يا اَبا عَبْدِاللهِ، اَلسَّلامُ عَلَيْكَ يَابْنَ رَسُولِ اللهِ»
              </p>
              <span className="text-[11px] text-slate-400">
                همراه با ترجمه روان و تغییر خودکار خطوط
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در عنوان، مداح، مناسبت یا متن دعا..."
            className="w-full pr-10 pl-4 py-2.5 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
            >
              پاک کردن
            </button>
          )}
        </div>

        {/* Favorite toggle and active filters */}
        <div className="flex items-center gap-2">
          {selectedReciterId && (
            <button
              onClick={() => setSelectedReciterId(null)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium"
            >
              <span>مداح: {reciters.find((r) => r.id === selectedReciterId)?.name}</span>
              <span className="hover:text-white">×</span>
            </button>
          )}

          <button
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium border transition-colors ${
              showOnlyFavorites
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${showOnlyFavorites ? 'fill-current text-amber-400' : ''}`} />
            <span>نشانه‌گذاری‌ها</span>
            {favorites.length > 0 && (
              <span className="bg-slate-800 px-1.5 py-0.2 rounded font-mono text-[11px]">
                {toPersianDigits(favorites.length)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Category Tabs (Segmented Button Controls) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {categories.map((cat) => {
          const isActive = (cat.slug === 'all' && selectedCategory === 'all') || selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug === 'all' ? 'all' : cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              <span>{cat.name}</span>
              <span
                className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-500'
                }`}
              >
                {toPersianDigits(cat.tracksCount)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Reciters Horizontal Carousel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>مداحان و اساتید ادعیه</span>
          </h3>
          {selectedReciterId && (
            <button
              onClick={() => setSelectedReciterId(null)}
              className="text-xs text-emerald-400 hover:underline"
            >
              نمایش همه مداحان
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {reciters.map((reciter) => {
            const isSelected = selectedReciterId === reciter.id;
            return (
              <div
                key={reciter.id}
                onClick={() => setSelectedReciterId(isSelected ? null : reciter.id)}
                className={`p-3 rounded-2xl cursor-pointer border transition-all flex flex-col items-center text-center ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                {/* Styled Monogram Reciter Avatar */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-base mb-2 border shadow-inner transition-transform active:scale-95"
                  style={{
                    backgroundColor: `${reciter.accentColor}15`,
                    borderColor: `${reciter.accentColor}40`,
                    color: reciter.accentColor,
                  }}
                >
                  {reciter.name.slice(0, 2)}
                </div>

                <span className="text-xs font-bold text-slate-200 truncate w-full">
                  {reciter.title}
                </span>

                <span className="text-[10px] text-slate-400 truncate w-full mt-0.5">
                  {reciter.style}
                </span>

                <span className="text-[10px] font-mono text-slate-500 mt-1">
                  {toPersianDigits(reciter.tracksCount)} قطعه
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tracks Listing */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Music className="w-4 h-4 text-emerald-400" />
            <span>فهرست نواها و ادعیه ({toPersianDigits(filteredTracks.length)})</span>
          </h3>
          <span className="text-xs text-slate-500">
            میزبانی ابری: باکت S3 ابر آروان
          </span>
        </div>

        {filteredTracks.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-500 space-y-2">
            <Music className="w-8 h-8 mx-auto text-slate-600 stroke-1" />
            <p className="text-sm font-medium">هیچ قطعه‌ای مطابق فیلترهای انتخابی یافت نشد.</p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedReciterId(null);
                setSearchQuery('');
                setShowOnlyFavorites(false);
              }}
              className="text-xs text-emerald-400 hover:underline pt-2 inline-block"
            >
              حذف فیلترها و مشاهده همه
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredTracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              const isFav = favorites.includes(track.id);

              return (
                <div
                  key={track.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 group ${
                    isCurrent
                      ? 'bg-slate-900 border-emerald-500/60 shadow-lg shadow-emerald-500/5'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Play/Pause Button */}
                    <button
                      onClick={() => {
                        if (isCurrent) {
                          togglePlay();
                        } else {
                          playTrack(track, filteredTracks);
                        }
                      }}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform active:scale-90 ${
                        isCurrent && isPlaying
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                          : 'bg-slate-800 group-hover:bg-emerald-500/20 text-slate-300 group-hover:text-emerald-400'
                      }`}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause className="w-5 h-5 fill-current" />
                      ) : (
                        <Play className="w-5 h-5 fill-current translate-x-0.5" />
                      )}
                    </button>

                    {/* Track info */}
                    <div className="min-w-0 flex-1">
                      <h4
                        onClick={() => {
                          playTrack(track, filteredTracks);
                          setIsFullPlayerOpen(true);
                        }}
                        className={`text-sm font-semibold truncate cursor-pointer transition-colors ${
                          isCurrent ? 'text-emerald-400' : 'text-slate-200 hover:text-emerald-400'
                        }`}
                      >
                        {track.title}
                      </h4>

                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="truncate">{track.reciterName}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="truncate text-slate-500">{track.occasion || track.categoryName}</span>
                      </div>

                      {/* Technical metadata: Bitrate & Size */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-1">
                        <span>{toPersianDigits(formatDuration(track.duration))}</span>
                        <span aria-hidden="true">·</span>
                        <span>{track.bitrate}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatFileSize(track.fileSizeMb)}</span>
                        {track.lyrics && track.lyrics.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-500/80 font-sans">متن همگام</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions right */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleFavorite(track.id)}
                      title={isFav ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}
                      className={`p-2 rounded-lg transition-colors ${
                        isFav
                          ? 'text-amber-400 bg-amber-400/10'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      onClick={() => {
                        playTrack(track, filteredTracks);
                        setIsFullPlayerOpen(true);
                      }}
                      title="مشاهده تمام صفحه و متن"
                      className="p-2 text-slate-500 hover:text-emerald-400 rounded-lg transition-colors"
                    >
                      <Layers className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
