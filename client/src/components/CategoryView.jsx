import MediaGrid from './MediaGrid.jsx';

function fmtBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

export default function CategoryView({ loading, category, folders, files, navigate, onNewFolder, categoryId, onUploadFromComputer, onUploadFromSaved, onPreview, onDownload, onDelete, onDeleteCategory, onOpenMenu }) {
  const channelReady = category?.channelActive;
  return (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Title row */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenMenu}
              aria-label="Open menu"
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
            >
              ☰
            </button>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">📁 {category?.name || 'Category'}</h2>
              <p className="text-sm text-slate-500">
                Channel: {channelReady ? 'Active — folders become marker posts' : '⚠️ Not linked'}
              </p>
            </div>
          </div>
          {/* Action buttons — wrap on mobile */}
          <div className="flex flex-wrap items-center gap-2">
            {channelReady ? (
              <>
                <button onClick={onUploadFromSaved} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">📨 From Saved</button>
                <label className="min-h-11 cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">📤 Upload<input type="file" multiple accept="image/*,video/*,audio/*,application/*" className="hidden" onChange={(e) => e.target.files?.length && onUploadFromComputer(e.target.files)} /></label>
                <button onClick={onNewFolder} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">+ New Folder</button>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-amber-50 px-2 py-1 text-sm text-amber-600">⚠️ Channel not linked</span>
                <button
                  onClick={() => onDeleteCategory(category.id, category.name)}
                  className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                  title="Delete this broken category so you can recreate it with your real Telegram session"
                >
                  Delete &amp; Recreate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : (
          <div>
            {folders.length > 0 ? (
              <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => navigate(`/app/category/${categoryId}/folder/${folder.id}`)}
                    className="flex flex-col items-center rounded-xl border border-slate-200 p-3 text-center transition hover:border-indigo-300 hover:bg-indigo-50 sm:p-4"
                  >
                    <div className="mb-2 text-4xl">📁</div>
                    <p className="w-full truncate text-sm font-medium text-slate-700">{folder.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                        {folder.itemCount || 0} {folder.itemCount === 1 ? 'file' : 'files'}
                        {folder.totalSize > 0 ? ` · ${fmtBytes(folder.totalSize)}` : ''}
                      </p>
                  </button>
                ))}
              </div>
            ) : (
              channelReady && (
                <div className="mb-6 py-8 text-center">
                  <div className="mb-2 text-4xl">📂</div>
                  <h3 className="text-base font-medium text-slate-700">No folders yet</h3>
                  <p className="mt-1 text-sm text-slate-500">Create a folder to organize, or upload files directly below</p>
                </div>
              )
            )}

            {files.length > 0 && (
              <div className="mt-2">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Files</h3>
                <MediaGrid media={files} onPreview={onPreview} onDownload={onDownload} onDelete={onDelete} />
              </div>
            )}

            {folders.length === 0 && files.length === 0 && channelReady && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button onClick={onUploadFromSaved} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">📨 From Saved</button>
                <label className="min-h-11 cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">📤 Upload<input type="file" multiple accept="image/*,video/*,audio/*,application/*" className="hidden" onChange={(e) => e.target.files?.length && onUploadFromComputer(e.target.files)} /></label>
                <button onClick={onNewFolder} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">+ New Folder</button>
              </div>
            )}
            {folders.length === 0 && files.length === 0 && !channelReady && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => onDeleteCategory(category.id, category.name)}
                  className="min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Delete &amp; Recreate category
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}