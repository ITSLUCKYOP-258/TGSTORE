export default function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl px-5 py-3 text-sm font-medium text-white shadow-xl ${toast.isError ? 'bg-red-600' : 'bg-slate-900'}`}>
      {toast.msg}
    </div>
  );
}