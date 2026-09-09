export default function Sidebar({ user, categories, categoryId, navigate, onNewCategory, onLogout, onDeleteCategory }) {
  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
      <div className="p-4"><h1 className="text-xl font-bold text-indigo-600">TGStore</h1><p className="text-xs text-slate-500 mt-1">Telegram-powered storage</p></div>
      <nav className="px-2 pb-4">
        <button onClick={() => navigate('/app')} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition ${!categoryId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>📨 Saved Messages</button>
        <div className="mt-4"><div className="flex items-center justify-between px-3 py-1"><span className="text-xs font-semibold text-slate-400 uppercase">Categories</span><button onClick={onNewCategory} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">+ New</button></div>
          {categories.map(cat => (
            <div
              key={cat.id}
              onClick={() => navigate(`/app/category/${cat.id}`)}
              className={`group w-full text-left px-3 py-2 rounded-lg text-sm transition cursor-pointer flex items-center justify-between ${categoryId === cat.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span className="truncate">📁 {cat.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteCategory?.(cat.id, cat.name); }}
                title={`Delete category "${cat.name}" (files inside are also purged from Telegram)`}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition flex-shrink-0"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </nav>
      <div className="border-t border-slate-200 p-4 mt-auto">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-600">{user?.name?.[0] || 'U'}</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-700 truncate">{user?.name}</p><p className="text-xs text-slate-500">{user?.phone || 'Logged in'}</p></div>
          <button
            onClick={onLogout}
            title="Log out"
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition"
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
