import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, MessageSquare, Mic, Send, Volume2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import { useAuth, API } from "../App";
import axios from "axios";
import { toast } from "sonner";

// Message Bubble Component
const MessageBubble = ({ message, isUser, onPlayAudio }) => {
  const playAudio = async () => {
    try {
      const response = await axios.post(`${API}/voice/synthesize`, {
        text: message.content,
        voice: "nova"
      });
      
      if (response.data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${response.data.audio}`);
        audio.play();
      }
    } catch (error) {
      toast.error("Could not play audio");
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-fade-in`}>
      <div 
        className={`
          max-w-[80%] md:max-w-[70%] p-4 rounded-2xl
          ${isUser 
            ? 'bg-primary text-primary-foreground rounded-br-md' 
            : 'bg-muted rounded-bl-md'
          }
        `}
      >
        <p className="text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
        
        {!isUser && (
          <button
            onClick={playAudio}
            className={`mt-2 p-1.5 rounded-full ${isUser ? 'hover:bg-primary-foreground/10' : 'hover:bg-foreground/10'}`}
            aria-label="Play audio"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default function ConversationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  // Handle initial message from landing page
  useEffect(() => {
    if (location.state?.initialMessage) {
      setInputText(location.state.initialMessage);
      // Clear the state so it doesn't persist on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Salaan! 👋 I'm your Af Maay language assistant. I can help you:\n\n• Learn Af Maay vocabulary and grammar\n• Practice conversations\n• Translate between English and Af Maay\n• Answer questions about the language\n\nHow can I help you today?",
        timestamp: new Date().toISOString()
      }]);
    }
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim() || loading) return;

    const userMessage = {
      role: "user",
      content: inputText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setLoading(true);

    try {
      const response = await axios.post(`${API}/chat`, {
        message: inputText,
        conversation_id: conversationId,
        language: "en"
      }, { withCredentials: true });

      setConversationId(response.data.conversation_id);
      
      const assistantMessage = {
        role: "assistant",
        content: response.data.response,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      if (response.data.vocabulary_gaps?.length > 0) {
        toast.info(`Note: ${response.data.vocabulary_gaps.length} terms couldn't be translated`);
      }
    } catch (error) {
      toast.error("Failed to send message. Please try again.");
      // Remove the user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const startVoiceInput = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        const formData = new FormData();
        formData.append('file', blob, 'message.webm');
        
        try {
          const response = await axios.post(`${API}/voice/transcribe`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          if (response.data.text) {
            setInputText(response.data.text);
            toast.success("Voice captured!");
          }
        } catch (error) {
          toast.error("Transcription failed");
        }
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      toast.error("Could not access microphone");
    }
  };

  const stopVoiceInput = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };

  const clearConversation = () => {
    setMessages([{
      role: "assistant",
      content: "Conversation cleared. How can I help you?",
      timestamp: new Date().toISOString()
    }]);
    setConversationId(null);
    toast.success("Conversation cleared");
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/')}
                data-testid="back-button"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-primary" />
                <h1 className="font-heading font-bold text-xl">Conversation</h1>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={clearConversation}
                className="text-muted-foreground hover:text-destructive"
                data-testid="clear-chat-btn"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="max-w-4xl mx-auto px-4 py-6">
            {messages.map((message, index) => (
              <MessageBubble
                key={index}
                message={message}
                isUser={message.role === "user"}
              />
            ))}
            
            {loading && (
              <div className="flex justify-start mb-4">
                <div className="bg-muted p-4 rounded-2xl rounded-bl-md">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 glass border-t border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {/* Voice Button */}
            <Button
              variant={isRecording ? "destructive" : "outline"}
              size="icon"
              onClick={isRecording ? stopVoiceInput : startVoiceInput}
              className="shrink-0 h-12 w-12 rounded-full"
              data-testid="voice-input-btn"
            >
              {isRecording ? (
                <div className="flex items-center gap-0.5">
                  {[1,2,3].map(i => (
                    <div 
                      key={i}
                      className="w-1 h-4 bg-white rounded-full waveform-bar"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    />
                  ))}
                </div>
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </Button>

            {/* Text Input */}
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message or tap the mic..."
              className="flex-1 h-12 text-base"
              disabled={loading}
              data-testid="message-input"
            />

            {/* Send Button */}
            <Button
              onClick={sendMessage}
              disabled={loading || !inputText.trim()}
              className="shrink-0 h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
              data-testid="send-message-btn"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          
          {isRecording && (
            <p className="text-center text-sm text-destructive mt-2">
              Recording... Click mic button to stop
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
