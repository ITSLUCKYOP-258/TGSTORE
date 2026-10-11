import MediaGrid from '../components/MediaGrid.jsx';

export default function SavedMessagesView({ loading, savedMedia, savedFilter, setSavedFilter, onPreview, onOpenMenu }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 dark:border-white/5 dark:bg-[#17212b] sm:px-6 sm:py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {/* Hamburger — mobile only */}
            <button
              onClick={onOpenMenu}
              aria-label="Open menu"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 md:hidden"
            >
              ☰
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Saved Messages</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Your photos and videos from Telegram</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', 'photos', 'videos'].map((f) => (
              <button
                key={f}
                onClick={() => setSavedFilter(f)}
                className={`min-h-9 rounded-full px-3.5 py-1 text-sm font-semibold transition ${
                  savedFilter === f
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 dark:bg-[#3390ec] dark:shadow-none'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 dark:border-white/10 dark:border-t-sky-400" />
          </div>
        ) : (
          <MediaGrid
            media={savedMedia}
            onPreview={onPreview}
            onDownload={(m) => window.open(m.downloadUrl || `/api/mt/media/${m.chatId}/${m.id}/download`, '_blank')}
            showSavedBadge
          />
        )}
      </div>
    </div>
  );
}