export default function NewFolderModal({
  name,
  setName,
  onCreate,
  onClose,
  error = null,
  submitting = false,
  success = null,
  hasCategories = true,
  categoryName = '',
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-800">Create New Folder</h3>
        <p className="text-sm text-slate-500 mt-1">A marker post will be made in the category channel</p>

        {!hasCategories && (
          <div className="mt-3 rounded-lg bg-amber-50 border border-amber-300 p-3 text-sm text-amber-800">
            ⚠️ You don't have any categories yet. A folder is stored as a marker message inside a
            category&apos;s Telegram channel — create a category first.
          </div>
        )}

        {categoryName && (
          <p className="text-xs text-slate-400 mt-2">Category: 📁 {categoryName}</p>
        )}

        {success && (
          <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-300 p-3 text-sm text-emerald-700">
            ✅ {success}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-300 p-3 text-sm text-red-700">
            ❌ {error}
          </div>
        )}

        <input
          type="text"
          value={name}
          disabled={submitting}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Goa Trip 2024"
          className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && !submitting && onCreate()}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onCreate}
            disabled={submitting || !hasCategories}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}