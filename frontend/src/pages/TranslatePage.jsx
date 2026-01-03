import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft, Languages, Mic, Volume2, Copy, Check, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { API } from "../App";
import axios from "axios";
import { toast } from "sonner";

export default function TranslatePage() {
  const navigate = useNavigate();
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("maay");
  const [loading, setLoading] = useState(false);
  const [vocabularyGaps, setVocabularyGaps] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);

  const swapLanguages = () => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  const translate = async () => {
    if (!sourceText.trim()) {
      toast.error("Please enter text to translate");
      return;
    }

    setLoading(true);
    setVocabularyGaps([]);
    
    try {
      const response = await axios.post(`${API}/translate`, {
        text: sourceText,
        source_language: sourceLang,
        target_language: targetLang
      });
      
      setTranslatedText(response.data.translated_text);
      if (response.data.vocabulary_gaps?.length > 0) {
        setVocabularyGaps(response.data.vocabulary_gaps);
        toast.info(`${response.data.vocabulary_gaps.length} words could not be translated`);
      }
    } catch (error) {
      toast.error("Translation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const playAudio = async (text, lang) => {
    try {
      const response = await axios.post(`${API}/voice/synthesize`, {
        text: text,
        voice: lang === "maay" ? "nova" : "alloy"
      });
      
      if (response.data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${response.data.audio}`);
        audio.play();
      }
    } catch (error) {
      toast.error("Could not play audio");
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
        formData.append('file', blob, 'input.webm');
        
        try {
          const response = await axios.post(`${API}/voice/transcribe`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          if (response.data.text) {
            setSourceText(response.data.text);
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
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
              <Languages className="w-6 h-6 text-primary" />
              <h1 className="font-heading font-bold text-xl">Translate</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Language Selector */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <Button
            variant="outline"
            className={`min-w-28 ${sourceLang === 'en' ? 'border-primary bg-primary/5' : ''}`}
            onClick={() => { setSourceLang('en'); setTargetLang('maay'); }}
          >
            English
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={swapLanguages}
            className="rounded-full"
            data-testid="swap-languages"
          >
            <ArrowRightLeft className="w-5 h-5" />
          </Button>
          
          <Button
            variant="outline"
            className={`min-w-28 ${targetLang === 'maay' ? 'border-primary bg-primary/5' : ''}`}
            onClick={() => { setSourceLang('maay'); setTargetLang('en'); }}
          >
            Af Maay
          </Button>
        </div>

        {/* Translation Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Source */}
          <Card className="p-5 border-2 border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {sourceLang === 'en' ? 'English' : 'Af Maay'}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => playAudio(sourceText, sourceLang)}
                  disabled={!sourceText}
                  className="h-8 w-8"
                >
                  <Volume2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={isRecording ? stopVoiceInput : startVoiceInput}
                  className={`h-8 w-8 ${isRecording ? 'text-destructive' : ''}`}
                  data-testid="voice-input-btn"
                >
                  <Mic className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <Textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={`Enter ${sourceLang === 'en' ? 'English' : 'Af Maay'} text...`}
              className="min-h-[200px] text-lg border-0 p-0 focus-visible:ring-0 resize-none"
              data-testid="source-input"
            />
            
            {isRecording && (
              <div className="flex items-center gap-2 mt-3 text-destructive">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-sm">Recording... Click mic to stop</span>
              </div>
            )}
          </Card>

          {/* Target */}
          <Card className="p-5 border-2 border-border bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {targetLang === 'en' ? 'English' : 'Af Maay'}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => playAudio(translatedText, targetLang)}
                  disabled={!translatedText}
                  className="h-8 w-8"
                >
                  <Volume2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyToClipboard}
                  disabled={!translatedText}
                  className="h-8 w-8"
                >
                  {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            
            <div className="min-h-[200px] text-lg">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : translatedText ? (
                <p className="whitespace-pre-wrap" data-testid="translation-result">
                  {translatedText}
                </p>
              ) : (
                <p className="text-muted-foreground">Translation will appear here...</p>
              )}
            </div>
          </Card>
        </div>

        {/* Translate Button */}
        <div className="flex justify-center mt-6">
          <Button
            onClick={translate}
            disabled={loading || !sourceText.trim()}
            className="bg-primary hover:bg-primary/90 px-12 py-6 text-lg"
            data-testid="translate-btn"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Translating...
              </>
            ) : (
              'Translate'
            )}
          </Button>
        </div>

        {/* Vocabulary Gaps */}
        {vocabularyGaps.length > 0 && (
          <Card className="mt-8 p-5 border-2 border-border bg-yellow-50 dark:bg-yellow-900/10">
            <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
              <span className="text-yellow-600">Missing Vocabulary</span>
              <Badge variant="secondary">{vocabularyGaps.length}</Badge>
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              These English words don't have Af Maay equivalents yet:
            </p>
            <div className="flex flex-wrap gap-2">
              {vocabularyGaps.map((gap, i) => (
                <Badge key={i} variant="outline" className="text-yellow-700 border-yellow-300">
                  {gap}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Help expand the language! Suggest Af Maay translations in the admin panel.
            </p>
          </Card>
        )}

        {/* Tips */}
        <div className="mt-12 text-center">
          <h3 className="font-heading font-semibold mb-4">Translation Tips</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div className="p-4 rounded-lg bg-muted/30">
              <strong className="text-foreground">SOV Order</strong>
              <p>Af Maay uses Subject-Object-Verb order</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <strong className="text-foreground">Context Matters</strong>
              <p>Some words change meaning in context</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30">
              <strong className="text-foreground">Sound Groups</strong>
              <p>Nouns belong to 6 sound groups (k, t, dh, n, b, r)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
