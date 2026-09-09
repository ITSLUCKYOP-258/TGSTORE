import { useCallback } from 'react';
import { api, uploadFile } from '../api.js';

export function useDashboardHandlers({
  categoryId, folderId, navigate, setCategories, setCurrentCategory, setFolders, setFiles, setSavedMedia, setLoading, setToast, setUploads, setShowSavedPicker
}) {
  const showToast = (msg, isError = false) => { setToast({ msg, isError }); setTimeout(() => setToast(null), 3500); };
  
  const loadCategories = useCallback(async () => { try { const { categories } = await api.listCategories(); setCategories(categories); } catch (e) { showToast(e.message, true); } }, []);
  const loadSavedMessages = useCallback(async (filter = 'all') => { try { setLoading(true); const { media } = await api.savedMessages(filter); setSavedMedia(media || []); } catch (e) { showToast(e.message, true); } finally { setLoading(false); } }, []);
  const loadCategoryContents = useCallback(async () => { if (!categoryId) return; try { setLoading(true); const cats = await api.listCategories(); setCurrentCategory(cats.categories.find(c => c.id === categoryId)); const { folders } = await api.listFolders(categoryId, folderId || null); setFolders(folders || []); if (folderId) { const { files } = await api.listFiles(categoryId, folderId); setFiles(files || []); } else setFiles([]); } catch (e) { showToast(e.message, true); } finally { setLoading(false); } }, [categoryId, folderId]);

  const handleCreateCategory = useCallback(async (name) => { if (!name.trim()) return; try { const { category } = await api.createCategory(name.trim()); showToast(`Category '${category.name}' created!`); setCategories(prev => [...prev, category]); navigate(`/app/category/${category.id}`); } catch (e) { showToast(e.message, true); } }, [navigate]);
  const handleCreateFolder = useCallback(async (name) => { if (!name.trim() || !categoryId) return; try { await api.createFolder(name.trim(), categoryId, folderId); showToast(`Folder '${name}' created!`); loadCategoryContents(); } catch (e) { showToast(e.message, true); } }, [categoryId, folderId, loadCategoryContents]);
  const handleUploadFromComputer = useCallback(async (fileList) => { for (const file of Array.from(fileList)) { const id = `${Date.now()}-${Math.random()}`; setUploads(u => [...u, { id, name: file.name, progress: 0 }]); try { await uploadFile(file, folderId, (p) => setUploads(u => u.map(x => x.id === id ? { ...x, progress: p } : x)), undefined, categoryId); setUploads(u => u.filter(x => x.id !== id)); showToast(`Uploaded ${file.name}`); } catch (e) { setUploads(u => u.map(x => x.id === id ? { ...x, error: e.message } : x)); } } loadCategoryContents(); }, [categoryId, folderId, loadCategoryContents]);
  const handleUploadFromSaved = useCallback(async (selectedMedia) => { if (!categoryId) return; setShowSavedPicker(false); for (const media of selectedMedia) { try { await api.uploadFromSaved(media.id, categoryId, folderId, media.name || 'Saved Media', media.mime || 'application/octet-stream', media.size || 0); showToast(`Uploaded ${media.name || 'media'}`); } catch (e) { showToast(`Failed: ${e.message}`, true); } } loadCategoryContents(); }, [categoryId, folderId, loadCategoryContents]);
  const handleDeleteFile = useCallback(async (fileId) => { try { await api.deleteFile(fileId); showToast('File deleted'); loadCategoryContents(); } catch (e) { showToast(e.message, true); } }, [loadCategoryContents]);

  return { loadCategories, loadSavedMessages, loadCategoryContents, handleCreateCategory, handleCreateFolder, handleUploadFromComputer, handleUploadFromSaved, handleDeleteFile };
}