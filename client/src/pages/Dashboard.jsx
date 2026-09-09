import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, uploadFile, downloadUrl } from '../api.js';
import { useAuth } from '../App.jsx';
import Sidebar from '../components/Sidebar.jsx';
import MediaPreview from '../components/MediaPreview.jsx';
import SavedMessagesPicker from '../components/SavedMessagesPicker.jsx';
import NewCategoryModal from '../components/NewCategoryModal.jsx';
import NewFolderModal from '../components/NewFolderModal.jsx';
import UploadProgress from '../components/UploadProgress.jsx';
import Toast from '../components/Toast.jsx';
import SavedMessagesView from '../components/SavedMessagesView.jsx';
import CategoryView from '../components/CategoryView.jsx';
import FolderView from '../components/FolderView.jsx';
import { useDashboardHandlers } from '../hooks/useDashboardHandlers.js';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const categoryId = params.categoryId ? Number(params.categoryId) : null;
  const folderId = params.folderId ? Number(params.folderId) : null;
  
  const [categories, setCategories] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [savedMedia, setSavedMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [savedFilter, setSavedFilter] = useState('all');

  const handlers = useDashboardHandlers({
    categoryId, folderId, navigate, setCategories, setCurrentCategory, setFolders, setFiles, setSavedMedia, setLoading, setToast, setUploads, setShowSavedPicker
  });

  useEffect(() => { handlers.loadCategories(); }, [handlers.loadCategories]);
  useEffect(() => {
    if (categoryId) handlers.loadCategoryContents();
    else handlers.loadSavedMessages(savedFilter);
  }, [categoryId, folderId, handlers.loadCategoryContents, handlers.loadSavedMessages, savedFilter]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    await handlers.handleCreateCategory(newCategoryName);
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await handlers.handleCreateFolder(newFolderName);
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const view = !categoryId ? 'saved' : !folderId ? 'category' : 'folder';

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar user={user} categories={categories} categoryId={categoryId} navigate={navigate} onNewCategory={() => setShowNewCategory(true)} />
      <main className="flex-1 flex flex-col overflow-hidden">
        {view === 'saved' && <SavedMessagesView loading={loading} savedMedia={savedMedia} savedFilter={savedFilter} setSavedFilter={setSavedFilter} onPreview={setPreviewItem} />}
        {view === 'category' && <CategoryView loading={loading} category={currentCategory} folders={folders} navigate={navigate} onNewFolder={() => setShowNewFolder(true)} categoryId={categoryId} />}
        {view === 'folder' && <FolderView loading={loading} folderId={folderId} folders={folders} files={files} onUploadFromComputer={handlers.handleUploadFromComputer} onUploadFromSaved={() => setShowSavedPicker(true)} onPreview={setPreviewItem} onDownload={(f) => window.open(downloadUrl(f.id), '_blank')} onDelete={handlers.handleDeleteFile} />}
      </main>
      {showNewCategory && <NewCategoryModal name={newCategoryName} setName={setNewCategoryName} onCreate={handlers.handleCreateCategory} onClose={() => setShowNewCategory(false)} />}
      {showNewFolder && <NewFolderModal name={newFolderName} setName={setNewFolderName} onCreate={handlers.handleCreateFolder} onClose={() => setShowNewFolder(false)} />}
      {showSavedPicker && <SavedMessagesPicker onSelect={handlers.handleUploadFromSaved} onClose={() => setShowSavedPicker(false)} />}
      {previewItem && <MediaPreview item={previewItem} onClose={() => setPreviewItem(null)} />}
      <UploadProgress uploads={uploads} />
      <Toast toast={toast} />
    </div>
  );
}