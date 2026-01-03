import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Book, Languages, MessageSquare, Volume2, ChevronRight, Menu, X, LogIn, LogOut, User, Settings } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useAuth, API } from "../App";
import axios from "axios";
import { toast } from "sonner";

// Voice Button Component
const VoiceButton = ({ onTranscribe }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // Send to API
        const formData = new FormData();
        formData.append('file', blob, 'recording.webm');
        
        try {
          const response = await axios.post(`${API}/voice/transcribe`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          if (response.data.text) {
            onTranscribe(response.data.text);
          }
        } catch (error) {
          toast.error("Transcription failed. Please try again.");
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      toast.error("Could not access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Pulse rings */}
      {isRecording && (
        <>
          <div className="absolute w-40 h-40 md:w-56 md:h-56 rounded-full bg-primary/20 animate-pulse-ring" />
          <div className="absolute w-48 h-48 md:w-64 md:h-64 rounded-full bg-primary/10 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
        </>
      )}
      
      {/* Main button */}
      <button
        data-testid="voice-button"
        onClick={isRecording ? stopRecording : startRecording}
        className={`
          relative z-10 w-32 h-32 md:w-48 md:h-48 rounded-full 
          flex items-center justify-center
          transition-transform duration-300 ease-out
          ${isRecording 
            ? 'bg-destructive scale-110 shadow-2xl' 
            : 'bg-primary hover:scale-105 shadow-xl'
          }
        `}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        {isRecording ? (
          <div className="flex items-center gap-1">
            {[1,2,3,4,5].map((i) => (
              <div 
                key={i}
                className="w-1.5 h-8 md:h-12 bg-white rounded-full waveform-bar"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        ) : (
          <Mic className="w-12 h-12 md:w-20 md:h-20 text-white" />
        )}
      </button>
      
      <p className="mt-6 text-lg text-muted-foreground font-medium">
        {isRecording ? "Tap to stop" : "Tap to speak"}
      </p>
    </div>
  );
};

// Feature Card
const FeatureCard = ({ icon: Icon, title, description, onClick, testId }) => (
  <Card 
    data-testid={testId}
    onClick={onClick}
    className="group p-6 border-2 border-border rounded-xl cursor-pointer 
               hover:border-primary hover:shadow-lg transition-all duration-300
               bg-card card-shadow"
  >
    <div className="flex items-start gap-4">
      <div className="p-3 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <h3 className="font-heading font-semibold text-lg mb-1">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
    </div>
  </Card>
);

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");

  const handleTranscribe = (text) => {
    setTranscribedText(text);
    toast.success("Voice captured!");
    // Navigate to conversation with the transcribed text
    navigate('/conversation', { state: { initialMessage: text } });
  };

  const features = [
    {
      icon: Book,
      title: "Dictionary",
      description: "Search 1000+ Af Maay words with audio pronunciations",
      path: "/dictionary",
      testId: "feature-dictionary"
    },
    {
      icon: Languages,
      title: "Translate",
      description: "Translate between English and Af Maay instantly",
      path: "/translate",
      testId: "feature-translate"
    },
    {
      icon: MessageSquare,
      title: "Conversation",
      description: "Practice speaking with AI-powered chat",
      path: "/conversation",
      testId: "feature-conversation"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-white font-heading font-bold text-xl">M</span>
              </div>
              <span className="font-heading font-bold text-xl">Maay AI</span>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-6">
              <button 
                onClick={() => navigate('/dictionary')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Dictionary
              </button>
              <button 
                onClick={() => navigate('/translate')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Translate
              </button>
              <button 
                onClick={() => navigate('/conversation')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Conversation
              </button>
              
              {user ? (
                <div className="flex items-center gap-3">
                  {user.is_admin && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => navigate('/admin')}
                      data-testid="admin-link"
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Admin
                    </Button>
                  )}
                  <div className="flex items-center gap-2">
                    {user.picture ? (
                      <img 
                        src={user.picture} 
                        alt={user.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                    <span className="text-sm font-medium">{user.name?.split(' ')[0]}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={logout}
                    data-testid="logout-button"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button 
                  onClick={login}
                  className="bg-primary hover:bg-primary/90"
                  data-testid="login-button"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              )}
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMenuOpen(!menuOpen)}
              data-testid="mobile-menu-button"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-border bg-background animate-slide-up">
            <div className="px-4 py-4 space-y-3">
              <button 
                onClick={() => { navigate('/dictionary'); setMenuOpen(false); }}
                className="block w-full text-left py-2 text-muted-foreground hover:text-foreground"
              >
                Dictionary
              </button>
              <button 
                onClick={() => { navigate('/translate'); setMenuOpen(false); }}
                className="block w-full text-left py-2 text-muted-foreground hover:text-foreground"
              >
                Translate
              </button>
              <button 
                onClick={() => { navigate('/conversation'); setMenuOpen(false); }}
                className="block w-full text-left py-2 text-muted-foreground hover:text-foreground"
              >
                Conversation
              </button>
              {user ? (
                <>
                  {user.is_admin && (
                    <button 
                      onClick={() => { navigate('/admin'); setMenuOpen(false); }}
                      className="block w-full text-left py-2 text-muted-foreground hover:text-foreground"
                    >
                      Admin Panel
                    </button>
                  )}
                  <button 
                    onClick={() => { logout(); setMenuOpen(false); }}
                    className="block w-full text-left py-2 text-destructive"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Button 
                  onClick={() => { login(); setMenuOpen(false); }}
                  className="w-full bg-primary"
                >
                  Sign In with Google
                </Button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative py-16 md:py-24 px-4 overflow-hidden">
        {/* Background accent */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-4 py-1.5 mb-6 text-sm font-medium bg-primary/10 text-primary rounded-full">
            First Digital Platform for Af Maay
          </span>
          
          <h1 className="font-heading text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Preserve. Learn. Speak.
            <span className="block text-primary mt-2">Af Maay</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 leading-relaxed">
            The first comprehensive AI-powered platform for Af Maay language. 
            Voice-first design for native speakers. Modern tools for learners.
          </p>

          {/* Voice Button - Central Hero */}
          <div className="mb-16">
            <VoiceButton onTranscribe={handleTranscribe} />
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.path}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                onClick={() => navigate(feature.path)}
                testId={feature.testId}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { value: "1000+", label: "Dictionary Words" },
              { value: "7", label: "Person Conjugations" },
              { value: "6", label: "Sound Groups" },
              { value: "SOV", label: "Word Order" }
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="font-heading text-3xl md:text-4xl font-bold text-primary mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-6">
                Why Af Maay?
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Af Maay is a Somali language variant that has existed for centuries in oral tradition. 
                Until now, it lacked comprehensive digital resources.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Our platform bridges this gap, making Af Maay accessible to native speakers, 
                diaspora communities, and language enthusiasts worldwide.
              </p>
              <Button 
                onClick={() => navigate('/dictionary')}
                className="bg-secondary hover:bg-secondary/90"
                data-testid="explore-dictionary-btn"
              >
                Explore Dictionary
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl overflow-hidden border-2 border-border">
                <img 
                  src="https://images.unsplash.com/photo-1659861264333-99bb8142fc17?w=600&q=80"
                  alt="Somali landscape"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 bg-card p-4 rounded-xl border-2 border-border shadow-lg">
                <Volume2 className="w-8 h-8 text-primary" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-heading font-bold">M</span>
            </div>
            <span className="font-heading font-semibold">Maay AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Preserving and modernizing Af Maay language
          </p>
        </div>
      </footer>
    </div>
  );
}
