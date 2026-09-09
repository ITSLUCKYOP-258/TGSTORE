import MediaGrid from './MediaGrid.jsx';

export default function CategoryView({ loading, category, folders, files, navigate, onNewFolder, categoryId, onUploadFromComputer, onUploadFromSaved, onPreview, onDownload, onDelete, onDeleteCategory }) {
  const channelReady = category?.channelActive;
  return (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">📁 {category?.name || 'Category'}</h2>
            <p className="text-sm text-slate-500">
              Channel: {channelReady ? 'Active — folders become marker posts' : '⚠️ Not linked'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {channelReady ? (
              <>
                <button onClick={onUploadFromSaved} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">📨 From Saved</button>
                <label className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer">📤 Upload<input type="file" multiple accept="image/*,video/*,audio/*,application/*" className="hidden" onChange={(e) => e.target.files?.length && onUploadFromComputer(e.target.files)} /></label>
                <button onClick={onNewFolder} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">+ New Folder</button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-amber-600 bg-amber-50 px-2 py-1 rounded">⚠️ Channel not linked</span>
                <button
                  onClick={() => onDeleteCategory(category.id, category.name)}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                  title="Delete this broken category so you can recreate it with your real Telegram session"
                >
                  Delete &amp; Recreate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : (
          <div>
            {folders.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
                {folders.map(folder => (
                  <button key={folder.id} onClick={() => navigate(`/app/category/${categoryId}/folder/${folder.id}`)} className="flex flex-col items-center p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition text-center">
                    <div className="text-4xl mb-2">📁</div>
                    <p className="text-sm font-medium text-slate-700 truncate w-full">{folder.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{folder.itemCount || 0} items</p>
                  </button>
                ))}
              </div>
            ) : (
              channelReady && (
                <div className="mb-6 text-center py-8">
                  <div className="text-4xl mb-2">📂</div>
                  <h3 className="text-base font-medium text-slate-700">No folders yet</h3>
                  <p className="text-sm text-slate-500 mt-1">Create a folder to organize, or upload files directly below</p>
                </div>
              )
            )}

            {files.length > 0 && (
              <div className="mt-2">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Files</h3>
                <MediaGrid media={files} onPreview={onPreview} onDownload={onDownload} onDelete={onDelete} />
              </div>
            )}

            {folders.length === 0 && files.length === 0 && channelReady && (
              <div className="flex justify-center gap-2 mt-6">
                <button onClick={onUploadFromSaved} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">📨 From Saved</button>
                <label className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer">📤 Upload<input type="file" multiple accept="image/*,video/*,audio/*,application/*" className="hidden" onChange={(e) => e.target.files?.length && onUploadFromComputer(e.target.files)} /></label>
                <button onClick={onNewFolder} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">+ New Folder</button>
              </div>
            )}
            {folders.length === 0 && files.length === 0 && !channelReady && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => onDeleteCategory(category.id, category.name)}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
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