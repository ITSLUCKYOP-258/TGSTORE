/** Small JSON API wrapper — cookies are sent automatically (same-origin / proxied). */
const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export const api = {
  // Auth
  devLogin: () => request('/auth/dev', { method: 'POST', body: '{}' }),
  me: () => request('/auth/me'),

  // MTProto
  mtConfig: () => request('/mt/config'),
  sendCode: (phone) => request('/mt/send-code', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyCode: (flowId, code) => request('/mt/verify-code', { method: 'POST', body: JSON.stringify({ flowId, code }) }),
  verifyPassword: (flowId, password) => request('/mt/verify-password', { method: 'POST', body: JSON.stringify({ flowId, password }) }),
  mtStatus: () => request('/mt/status'),

  // Saved Messages
  savedMessages: (filter = 'all') => request(`/mt/saved-messages?filter=${filter}`),
  copySavedToChannel: (savedMessageId, channelId, caption) => request('/mt/saved-messages/copy', { method: 'POST', body: JSON.stringify({ savedMessageId, channelId, caption }) }),

  // Categories
  listCategories: () => request('/categories'),
  createCategory: (name) => request('/categories', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  // Folders
  listFolders: (categoryId, parentId) => request(`/folders?categoryId=${categoryId}&parentId=${parentId || ''}`),
  createFolder: (name, categoryId, parentId) => request('/folders', { method: 'POST', body: JSON.stringify({ name, categoryId, parentId }) }),
  deleteFolder: (id) => request(`/folders/${id}`, { method: 'DELETE' }),

  // Files
  listFiles: (categoryId, folderId) => request(`/drive?categoryId=${categoryId || ''}&folder=${folderId || ''}`),
  uploadFromSaved: (savedMessageId, categoryId, folderId, name, mime, size) => request('/files/upload-from-saved', { method: 'POST', body: JSON.stringify({ savedMessageId, categoryId, folderId, name, mime, size }) }),
  deleteFile: (id) => request(`/files/${id}`, { method: 'DELETE' }),
};

/**
 * Upload with progress via XHR (fetch has no upload progress).
 * Returns a promise resolving to { file }.
 */
export function uploadFile(file, folderId, onProgress, signal, categoryId) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', BASE + '/files/upload');
    xhr.responseType = 'json';
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('name', file.name);
    form.append('mime', file.type || 'application/octet-stream');
    if (categoryId != null) form.append('categoryId', String(categoryId));
    if (folderId != null) form.append('folderId', String(folderId));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
      else reject(new Error(xhr.response?.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    signal?.addEventListener('abort', () => {
      xhr.abort();
      reject(new Error('Upload cancelled'));
    });
    xhr.send(form);
  });
}

export const downloadUrl = (id) => `${BASE}/files/${id}/download`;
export const rawUrl = (id) => `${BASE}/files/${id}/raw`;
