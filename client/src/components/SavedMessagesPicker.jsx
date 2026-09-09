import { useState } from 'react';
import { api } from '../api.js';

export default function SavedMessagesPicker({ onSelect, onClose }) {
  const [media, setMedia] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useState(() => {
    api.savedMessages(filter).then(({ media }) => {
      setMedia(media || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [filter]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Select from Saved Messages</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <div className="flex gap-2 p-4 border-b border-slate-200">
          {['all', 'photos', 'videos'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm ${
                filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            </div>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {media.map(m => (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                    selected.has(m.id) ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-transparent'
                  }`}
                >
                  {m.thumbnail ? (
                    <img src={m.thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-2xl">
                      {m.mime?.startsWith('video') ? '🎬' : '🖼'}
                    </div>
                  )}
                  {selected.has(m.id) && (
                    <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs">✓</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between p-4 border-t border-slate-200">
          <p className="text-sm text-slate-500">{selected.size} selected</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              onClick={() => onSelect(media.filter(m => selected.has(m.id)))}
              disabled={selected.size === 0}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Upload Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}