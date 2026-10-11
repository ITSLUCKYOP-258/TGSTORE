import { useCallback, useRef } from 'react';
import { api, uploadFile, clearToken } from '../api.js';
import { useVault } from './useVault';
import { withDecryptedMeta } from '../lib/vault.js';

export function useDashboardHandlers({
  categoryId, folderId, navigate, setUser, setCategories, setCurrentCategory, setCurrentFolder, setFolders, setFiles, setSavedMedia, setLoading, setToast, setUploads, setShowSavedPicker
}) {
  // Vault context — safe to call: invoked during Dashboard's render.
  // Methods read a module-level key, so closures stay stable across renders.
  const vault = useVault();
  // Stable ref so useCallback deps don't trigger re-creation on every render
  const setToastRef = useRef(setToast);
  setToastRef.current = setToast;
  const showToast = useCallback((msg, isError = false) => {
    setToastRef.current({ msg, isError });
    setTimeout(() => setToastRef.current(null), 3500);
  }, []);
  
  const loadCategories = useCallback(async () => { try { const { categories } = await api.listCategories(); setCategories(categories || []); } catch (e) { showToast(e.message, true); } }, []);
  const loadSavedMessages = useCallback(async (filter = 'all') => { try { setLoading(true); const { media } = await api.savedMessages(filter); setSavedMedia(media || []); } catch (e) { showToast(e.message, true); } finally { setLoading(false); } }, []);
  const loadCategoryContents = useCallback(async () => { if (!categoryId) return; try { setLoading(true); const cats = await api.listCategories(); setCurrentCategory(cats?.categories?.find(c => String(c.id) === String(categoryId)) || null); const { folders, currentFolder } = await api.listFolders(categoryId, folderId || null); setFolders(folders || []); setCurrentFolder(currentFolder || null); const { files } = await api.listFiles(categoryId, folderId || null); setFiles(await withDecryptedMeta(files || [], vault.getKey())); } catch (e) { showToast(e.message, true); } finally { setLoading(false); } }, [categoryId, folderId]);

  const handleCreateCategory = useCallback(async (name) => {
    if (!name?.trim()) { showToast('Category name is required', true); return; }
    try {
      const { category } = await api.createCategory(name.trim());
      showToast(`Category '${category.name}' created!`);
      setCategories(prev => [...prev, category]);
      navigate(`/app/category/${category.id}`);
    } catch (e) {
      showToast(e.message, true);
    }
  }, [navigate]);
  const handleCreateFolder = useCallback(async (name, targetCategoryId) => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'Folder name is required' };
    // The drawer lets the user pick any category; fall back to the current one.
    const cid = targetCategoryId ?? categoryId;
    if (!cid) return { ok: false, error: 'Choose a category first — folders live in a category channel' };
    try {
      // Always create at the top level of the chosen category (no nested parent).
      const { folder } = await api.createFolder(trimmed, cid, null);
      const details =
        folder.channelMessageId
          ? `marker message #${folder.channelMessageId} posted to your Telegram channel`
          : 'created (no category channel — marker not posted)';
      showToast(`Folder '${folder.name}' created — ${details}`);
      // If we created it inside the currently-open category, refresh the view.
      if (Number(cid) === Number(categoryId)) {
        loadCategoryContents();
      } else {
        navigate(`/app/category/${cid}`);
      }
      return { ok: true, folder };
    } catch (e) {
      showToast(e.message, true);
      return { ok: false, error: e.message };
    }
  }, [categoryId, folderId, loadCategoryContents]);
  const handleUploadFromComputer = useCallback(async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    // Do NOT encrypt files while storing in Telegram: send original unencrypted files!
    const items = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      progress: 0,
    }));

    // Queue all uploads into the UI drawer immediately
    setUploads((prev) => [...prev, ...items.map(({ id, name, progress }) => ({ id, name, progress }))]);

    // Concurrency pool: 3 uploads simultaneously
    const CONCURRENCY = 3;
    let nextIdx = 0;

    const worker = async () => {
      while (nextIdx < items.length) {
        const item = items[nextIdx++];
        try {
          await uploadFile(
            item.file,
            folderId,
            (p) => setUploads((u) => u.map((x) => (x.id === item.id ? { ...x, progress: p } : x))),
            undefined,
            categoryId,
            null // Plain original file upload (no encryption before storing in TG)
          );
          setUploads((u) => u.filter((x) => x.id !== item.id));
          showToast(`Uploaded ${item.name}`);
        } catch (e) {
          setUploads((u) => u.map((x) => (x.id === item.id ? { ...x, error: e.message } : x)));
        }
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY, items.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
    loadCategoryContents();
  }, [categoryId, folderId, loadCategoryContents, setUploads, showToast]);

  const handleUploadFromSaved = useCallback(async (selectedMedia) => {
    if (!categoryId) return;
    const mediaList = Array.from(selectedMedia || []);
    if (!mediaList.length) return;
    setShowSavedPicker(false);

    const CONCURRENCY = 3;
    let nextIdx = 0;

    const worker = async () => {
      while (nextIdx < mediaList.length) {
        const media = mediaList[nextIdx++];
        try {
          await api.uploadFromSaved(
            media.id,
            categoryId,
            folderId,
            media.name || 'Saved Media',
            media.mime || 'application/octet-stream',
            media.size || 0
          );
          showToast(`Uploaded ${media.name || 'media'}`);
        } catch (e) {
          showToast(`Failed: ${e.message}`, true);
        }
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(CONCURRENCY, mediaList.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
    loadCategoryContents();
  }, [categoryId, folderId, loadCategoryContents, setShowSavedPicker, showToast]);
  const handleLogout = useCallback(async () => {
    try { await api.logout(); } catch { /* clear locally even if the call fails */ }
    // Clear persisted token for Capacitor native builds
    clearToken();
    // Drop the vault key from this session's memory
    vault.lock();
    setUser(null);
    navigate('/login');
  }, [navigate, setUser]);

  const handleDeleteFolder = useCallback(async (folderId, folderName) => {
    if (!window.confirm(`Delete folder "${folderName}"?\n\nAll files inside will be permanently removed from TGStore AND your Telegram channel. This cannot be undone.`)) return false;
    try {
      const res = await api.deleteFolder(folderId);
      showToast(`Folder "${folderName}" deleted — ${res?.removedFiles ?? 0} file(s) also purged from your Telegram channel`);
      navigate(`/app/category/${categoryId}`);
      loadCategoryContents();
      return true;
    } catch (e) {
      showToast(`Failed to delete folder: ${e.message}`, true);
      return false;
    }
  }, [categoryId, navigate, loadCategoryContents]);

  const handleDeleteFile = useCallback(async (fileId) => {
    if (!window.confirm('Delete this file permanently?\n\nIt will be removed from your Telegram channel and TGStore. This cannot be undone.')) return;
    try { await api.deleteFile(fileId); showToast('File deleted (also removed from your Telegram channel)'); loadCategoryContents(); } catch (e) { showToast(e.message, true); }
  }, [loadCategoryContents]);

    const handleDeleteCategory = useCallback(async (catId, catName) => {
    if (!window.confirm(`Delete category "${catName}"?\n\nAll folders and files inside will be permanently removed from TGStore AND your Telegram channel. The Telegram channel itself stays (you can delete it manually). This cannot be undone.`)) return false;
    try {
      await api.deleteCategory(catId);
      setCategories(prev => prev.filter(c => c.id !== catId));
      showToast(`Category "${catName}" deleted. Create a new one now.`);
      if (Number(categoryId) === catId) navigate('/app');
      return true;
    } catch (e) {
      showToast(`Failed to delete: ${e.message}`, true);
      return false;
    }
  }, [categoryId, navigate, setCategories, showToast]);
  
  return { loadCategories, loadSavedMessages, loadCategoryContents, handleCreateCategory, handleCreateFolder, handleUploadFromComputer, handleUploadFromSaved, handleDeleteFile, handleDeleteCategory, handleDeleteFolder, handleLogout };
}