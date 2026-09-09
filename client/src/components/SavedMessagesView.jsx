import MediaGrid from '../components/MediaGrid.jsx';

export default function SavedMessagesView({ loading, savedMedia, savedFilter, setSavedFilter, onPreview }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-slate-800">Saved Messages</h2><p className="text-sm text-slate-500">Your photos and videos from Telegram</p></div><div className="flex gap-2">{['all', 'photos', 'videos'].map(f => (<button key={f} onClick={() => setSavedFilter(f)} className={`px-3 py-1 rounded-full text-sm transition ${savedFilter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>))}</div></div></div>
      <div className="p-6">{loading ? <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" /></div> : <MediaGrid media={savedMedia} onPreview={onPreview} onDownload={(m) => window.open(m.downloadUrl || `/api/mt/media/${m.chatId}/${m.id}/download`, '_blank')} showSavedBadge />}</div>
    </div>
  );
}