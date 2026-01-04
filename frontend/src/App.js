import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useState, useEffect, createContext, useContext } from "react";
import { Toaster } from "./components/ui/sonner";
import axios from "axios";

// Pages
import LandingPage from "./pages/LandingPage";
import DictionaryPage from "./pages/DictionaryPage";
import TranslatePage from "./pages/TranslatePage";
import ConversationPage from "./pages/ConversationPage";
import AdminPage from "./pages/AdminPage";
import AuthCallback from "./pages/AuthCallback";
import LoginPage from "./pages/LoginPage";
import DonatePage from "./pages/DonatePage";

// Context
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

// Auth Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true
      });
      setUser(response.data);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = () => {
    const redirectUrl = window.location.origin + '/auth/callback';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error("Logout error:", error);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

// Protected Route
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse-soft">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-primary animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// App Router
function AppRouter() {
  const location = useLocation();

  // Check URL fragment for session_id (synchronous to prevent race conditions)
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dictionary" element={<DictionaryPage />} />
      <Route path="/translate" element={<TranslatePage />} />
      <Route path="/conversation" element={<ConversationPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/donate" element={<DonatePage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-background font-body">
          <AppRouter />
          <Toaster position="bottom-right" richColors theme="dark" />
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
