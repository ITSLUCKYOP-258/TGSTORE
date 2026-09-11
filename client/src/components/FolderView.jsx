import MediaGrid from './MediaGrid.jsx';

export default function FolderView({ loading, folderId, folder, folders, files, categoryId, navigate, onUploadFromComputer, onUploadFromSaved, onPreview, onDownload, onDelete, onDeleteFolder, onOpenMenu }) {
  const name = folder?.name || folders.find((f) => f.id === folderId)?.name || 'Folder';
  return (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Title + back link */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenMenu}
              aria-label="Open menu"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
            >
              ☰
            </button>
            <div>
              <button onClick={() => navigate(`/app/category/${categoryId}`)} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">← Back to category</button>
              <h2 className="text-lg font-semibold text-slate-800">📂 {name}</h2>
              <p className="text-sm text-slate-500">{files.length} items</p>
            </div>
          </div>

          {/* Action buttons — wrap on small screens */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onDeleteFolder(folderId, name)}
              title="Delete this folder and everything inside (files purged from Telegram too)"
              className="min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              🗑 Delete Folder
            </button>
            <button onClick={onUploadFromSaved} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">📨 From Saved</button>
            <label className="min-h-11 cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              📤 Upload
              <input type="file" multiple accept="image/*,video/*,audio/*,application/*" className="hidden" onChange={(e) => e.target.files?.length && onUploadFromComputer(e.target.files)} />
            </label>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 text-6xl">📭</div>
            <h3 className="text-lg font-medium text-slate-700">Folder is empty</h3>
            <p className="mt-1 text-sm text-slate-500">Upload media from your computer or Saved Messages</p>
          </div>
        ) : (
          <MediaGrid media={files} onPreview={onPreview} onDownload={onDownload} onDelete={onDelete} />
        )}
      </div>
    </div>
  );
}