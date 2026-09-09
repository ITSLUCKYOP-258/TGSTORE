import { createContext, useContext, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, BrowserRouter } from 'react-router-dom';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ShareView from './pages/ShareView.jsx';

const AuthContext = createContext({ user: null, loading: true, setUser: () => {} });
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    api.me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const auth = { user, loading, setUser };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-slate-500">Loading TGStore…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/app" replace /> : <Login />}
        />
        <Route
          path="/app/*"
          element={user ? <Dashboard /> : <Navigate to="/login" replace state={{ from: location }} />}
        />
        <Route path="/s/:token" element={<ShareView />} />
        <Route path="*" element={<Navigate to={user ? '/app' : '/login'} replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}
