export default function UploadProgress({ uploads }) {
  if (!uploads || uploads.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 space-y-2 rounded-2xl bg-white p-4 shadow-2xl">
      <p className="text-sm font-semibold text-slate-700">Uploading…</p>
      {uploads.map(u => (
        <div key={u.id}>
          <div className="flex justify-between text-xs text-slate-500">
            <span className="truncate">{u.name}</span>
            <span>{u.error ? 'Failed' : `${u.progress}%`}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full rounded-full transition-all ${u.error ? 'bg-red-500' : 'bg-indigo-600'}`} style={{ width: `${u.error ? 100 : u.progress}%` }} />
          </div>
          {u.error && <p className="mt-1 text-[11px] text-red-500">{u.error}</p>}
        </div>
      ))}
    </div>
  );
}