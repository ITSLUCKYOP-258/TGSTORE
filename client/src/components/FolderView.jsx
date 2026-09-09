import MediaGrid from './MediaGrid.jsx';

export default function FolderView({ loading, folderId, folder, folders, files, categoryId, navigate, onUploadFromComputer, onUploadFromSaved, onPreview, onDownload, onDelete, onDeleteFolder }) {
  const name = folder?.name || folders.find(f => f.id === folderId)?.name || 'Folder';
  return (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => navigate(`/app/category/${categoryId}`)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">← Back to category</button>
            <h2 className="text-lg font-semibold text-slate-800">📂 {name}</h2>
            <p className="text-sm text-slate-500">{files.length} items</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onDeleteFolder(folderId, name)}
              title="Delete this folder and everything inside (files purged from Telegram too)"
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              🗑 Delete Folder
            </button>
            <button onClick={onUploadFromSaved} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">📨 From Saved</button>
            <label className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer">📤 Upload<input type="file" multiple accept="image/*,video/*,audio/*,application/*" className="hidden" onChange={(e) => e.target.files?.length && onUploadFromComputer(e.target.files)} /></label>
          </div>
        </div>
      </div>
      <div className="p-6">{loading ? <div className="flex items-center justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" /></div> : files.length === 0 ? (<div className="flex flex-col items-center justify-center py-24 text-center"><div className="text-6xl mb-4">📭</div><h3 className="text-lg font-medium text-slate-700">Folder is empty</h3><p className="text-sm text-slate-500 mt-1">Upload media from your computer or Saved Messages</p></div>) : <MediaGrid media={files} onPreview={onPreview} onDownload={onDownload} onDelete={onDelete} />}</div>
    </div>
  );
}