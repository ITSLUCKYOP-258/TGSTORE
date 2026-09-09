export default function NewFolderModal({ name, setName, onCreate, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-800">Create New Folder</h3>
        <p className="text-sm text-slate-500 mt-1">A post will be made in the category channel</p>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Goa Trip 2024" className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" autoFocus onKeyDown={(e) => e.key === 'Enter' && onCreate()} />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button onClick={onCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Create</button>
        </div>
      </div>
    </div>
  );
}