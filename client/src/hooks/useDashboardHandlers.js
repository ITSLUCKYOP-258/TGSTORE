import { useCallback } from 'react';
import { api, uploadFile } from '../api.js';

export function useDashboardHandlers({
  categoryId, folderId, navigate, setUser, setCategories, setCurrentCategory, setCurrentFolder, setFolders, setFiles, setSavedMedia, setLoading, setToast, setUploads, setShowSavedPicker
}) {
  const showToast = (msg, isError = false) => { setToast({ msg, isError }); setTimeout(() => setToast(null), 3500); };
  
  const loadCategories = useCallback(async () => { try { const { categories } = await api.listCategories(); setCategories(categories); } catch (e) { showToast(e.message, true); } }, []);
  const loadSavedMessages = useCallback(async (filter = 'all') => { try { setLoading(true); const { media } = await api.savedMessages(filter); setSavedMedia(media || []); } catch (e) { showToast(e.message, true); } finally { setLoading(false); } }, []);
  const loadCategoryContents = useCallback(async () => { if (!categoryId) return; try { setLoading(true); const cats = await api.listCategories(); setCurrentCategory(cats.categories.find(c => c.id === categoryId)); const { folders, currentFolder } = await api.listFolders(categoryId, folderId || null); setFolders(folders || []); setCurrentFolder(currentFolder || null); const { files } = await api.listFiles(categoryId, folderId || null); setFiles(files || []); } catch (e) { showToast(e.message, true); } finally { setLoading(false); } }, [categoryId, folderId]);

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
  const handleCreateFolder = useCallback(async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'Folder name is required' };
    if (!categoryId) return { ok: false, error: 'Choose a category first — folders live in a category channel' };
    try {
      const { folder } = await api.createFolder(trimmed, categoryId, folderId);
      const details =
        folder.channelMessageId
          ? `marker message #${folder.channelMessageId} posted to your Telegram channel`
          : 'created (no category channel — marker not posted)';
      showToast(`Folder '${folder.name}' created — ${details}`);
      loadCategoryContents();
      return { ok: true, folder };
    } catch (e) {
      showToast(e.message, true);
      return { ok: false, error: e.message };
    }
  }, [categoryId, folderId, loadCategoryContents]);
  const handleUploadFromComputer = useCallback(async (fileList) => { for (const file of Array.from(fileList)) { const id = `${Date.now()}-${Math.random()}`; setUploads(u => [...u, { id, name: file.name, progress: 0 }]); try { await uploadFile(file, folderId, (p) => setUploads(u => u.map(x => x.id === id ? { ...x, progress: p } : x)), undefined, categoryId); setUploads(u => u.filter(x => x.id !== id)); showToast(`Uploaded ${file.name}`); } catch (e) { setUploads(u => u.map(x => x.id === id ? { ...x, error: e.message } : x)); } } loadCategoryContents(); }, [categoryId, folderId, loadCategoryContents]);
  const handleUploadFromSaved = useCallback(async (selectedMedia) => { if (!categoryId) return; setShowSavedPicker(false); for (const media of selectedMedia) { try { await api.uploadFromSaved(media.id, categoryId, folderId, media.name || 'Saved Media', media.mime || 'application/octet-stream', media.size || 0); showToast(`Uploaded ${media.name || 'media'}`); } catch (e) { showToast(`Failed: ${e.message}`, true); } } loadCategoryContents(); }, [categoryId, folderId, loadCategoryContents]);
  const handleLogout = useCallback(async () => {
    try { await api.logout(); } catch { /* clear cookie locally even if the call fails */ }
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