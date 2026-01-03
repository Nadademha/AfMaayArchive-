import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth, API } from "../App";
import axios from "axios";
import { toast } from "sonner";

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, checkAuth } = useAuth();
  const hasProcessed = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Get session_id from URL fragment
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.substring(1));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          throw new Error("No session ID found");
        }

        // Exchange session_id for session token
        const response = await axios.post(
          `${API}/auth/session`,
          { session_id: sessionId },
          { withCredentials: true }
        );

        if (response.data.user) {
          setUser(response.data.user);
          toast.success(`Welcome, ${response.data.user.name}!`);
          
          // Clean URL and navigate
          window.history.replaceState({}, document.title, '/');
          navigate('/', { replace: true, state: { user: response.data.user } });
        } else {
          throw new Error("No user data received");
        }
      } catch (error) {
        console.error("Auth callback error:", error);
        setError(error.message || "Authentication failed");
        toast.error("Authentication failed. Please try again.");
        
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      }
    };

    processAuth();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-destructive text-2xl">!</span>
          </div>
          <h2 className="font-heading text-xl font-semibold mb-2">Authentication Failed</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
        <h2 className="font-heading text-xl font-semibold mb-2">Signing you in...</h2>
        <p className="text-muted-foreground">Please wait a moment</p>
      </div>
    </div>
  );
}
