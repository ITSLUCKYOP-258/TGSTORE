import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // NOTE: Dashboard is mounted on the wildcard route "/app/*", so useParams()
  // returns NO named params. Derive categoryId/folderId from the pathname:
  //   /app                      → saved messages
  //   /app/category/:id         → category view
  //   /app/category/:id/folder/:fid → folder view
  const pathMatch = /^\/app\/category\/(\d+)(?:\/folder\/(\d+))?/.exec(location.pathname);
  const categoryId = pathMatch ? Number(pathMatch[1]) : null;
  const folderId = pathMatch?.[2] ? Number(pathMatch[2]) : null;
  
  const [categories, setCategories] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [savedMedia, setSavedMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [folderModal, setFolderModal] = useState({ open: false, submitting: false, error: null, success: null });
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [previewItem, setPreviewItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [savedFilter, setSavedFilter] = useState('all');
  // Mobile sidebar drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer whenever the user navigates to a different route
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  const handlers = useDashboardHandlers({
    categoryId, folderId, navigate, setUser, setCategories, setCurrentCategory, setCurrentFolder, setFolders, setFiles, setSavedMedia, setLoading, setToast, setUploads, setShowSavedPicker
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
    setFolderModal((m) => ({ ...m, submitting: true, error: null, success: null }));
    const result = await handlers.handleCreateFolder(newFolderName);
    if (result?.ok) {
      const f = result.folder;
      setFolderModal((m) => ({
        ...m,
        submitting: false,
        success: `Folder '${f.name}' created — marker ${f.channelMessageId ? `message #${f.channelMessageId} posted` : 'posted'} in your channel`,
      }));
      setNewFolderName('');
      setTimeout(() => setFolderModal((m) => ({ ...m, open: false })), 1600);
    } else {
      setFolderModal((m) => ({ ...m, submitting: false, error: result?.error || 'Could not create folder' }));
    }
  };

  const openNewFolder = () => setFolderModal({ open: true, submitting: false, error: null, success: null });

  const view = !categoryId ? 'saved' : !folderId ? 'category' : 'folder';

  return (
    <div className="flex h-dvh bg-slate-50">
      <Sidebar
        user={user}
        categories={categories}
        categoryId={categoryId}
        navigate={navigate}
        onNewCategory={() => setShowNewCategory(true)}
        onLogout={handlers.handleLogout}
        onDeleteCategory={handlers.handleDeleteCategory}
        mobileOpen={drawerOpen}
        onCloseMenu={() => setDrawerOpen(false)}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {view === 'saved' && (
          <SavedMessagesView
            loading={loading} savedMedia={savedMedia} savedFilter={savedFilter}
            setSavedFilter={setSavedFilter} onPreview={setPreviewItem}
            onOpenMenu={() => setDrawerOpen(true)}
          />
        )}
        {view === 'category' && (
          <CategoryView
            loading={loading} category={currentCategory} folders={folders} files={files}
            navigate={navigate} onNewFolder={openNewFolder} categoryId={categoryId}
            onUploadFromComputer={handlers.handleUploadFromComputer}
            onUploadFromSaved={() => setShowSavedPicker(true)}
            onPreview={setPreviewItem}
            onDownload={(f) => window.open(downloadUrl(f.id), '_blank')}
            onDelete={handlers.handleDeleteFile}
            onDeleteCategory={handlers.handleDeleteCategory}
            onOpenMenu={() => setDrawerOpen(true)}
          />
        )}
        {view === 'folder' && (
          <FolderView
            loading={loading} folderId={folderId} folder={currentFolder} folders={folders} files={files}
            onUploadFromComputer={handlers.handleUploadFromComputer}
            onUploadFromSaved={() => setShowSavedPicker(true)}
            onPreview={setPreviewItem}
            onDownload={(f) => window.open(downloadUrl(f.id), '_blank')}
            onDelete={handlers.handleDeleteFile}
            onDeleteFolder={handlers.handleDeleteFolder}
            categoryId={categoryId} navigate={navigate}
            onOpenMenu={() => setDrawerOpen(true)}
          />
        )}
      </main>
      {showNewCategory && <NewCategoryModal name={newCategoryName} setName={setNewCategoryName} onCreate={() => handleCreateCategory()} onClose={() => setShowNewCategory(false)} />}
      {folderModal.open && <NewFolderModal name={newFolderName} setName={setNewFolderName} onCreate={handleCreateFolder} onClose={() => setFolderModal({ open: false, submitting: false, error: null, success: null })} error={folderModal.error} submitting={folderModal.submitting} success={folderModal.success} hasCategories={categories.length > 0} categoryName={currentCategory?.name} />}
      {showSavedPicker && <SavedMessagesPicker onSelect={handlers.handleUploadFromSaved} onClose={() => setShowSavedPicker(false)} />}
      {previewItem && <MediaPreview item={previewItem} onClose={() => setPreviewItem(null)} />}
      <UploadProgress uploads={uploads} />
      <Toast toast={toast} />
    </div>
  );
}