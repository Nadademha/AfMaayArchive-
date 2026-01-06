import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Volume2, Book, Mic, ArrowLeft, Check } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { toast } from "sonner";

// Import static dictionary data
import dictionaryData from '../dictionary-data.json';

// Sound Group Badge Colors
const soundGroupColors = {
  k: "bg-orange-900/30 text-orange-400 border-orange-500/50",
  t: "bg-blue-900/30 text-blue-400 border-blue-500/50",
  th: "bg-green-900/30 text-green-400 border-green-500/50",
  dh: "bg-green-900/30 text-green-400 border-green-500/50",
  n: "bg-yellow-900/30 text-yellow-400 border-yellow-500/50",
  g: "bg-yellow-900/30 text-yellow-400 border-yellow-500/50",
  b: "bg-purple-900/30 text-purple-400 border-purple-500/50",
  r: "bg-red-900/30 text-red-400 border-red-500/50",
  l: "bg-purple-900/30 text-purple-400 border-purple-500/50",
  m: "bg-pink-900/30 text-pink-400 border-pink-500/50",
  y: "bg-cyan-900/30 text-cyan-400 border-cyan-500/50",
  h: "bg-indigo-900/30 text-indigo-400 border-indigo-500/50"
};

// Dictionary Entry Card
const DictionaryCard = ({ entry }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const playAudio = async () => {
    // Voice feature - needs API setup
    toast.info("Voice feature coming soon! Set up OpenAI API to enable.", {
      description: "Check README.md for setup instructions"
    });
    
    /* 
    // ENABLE THIS WHEN YOU ADD API:
    if (isPlaying) return;
    setIsPlaying(true);
    
    try {
      const response = await axios.post(`${API}/voice/synthesize`, {
        text: entry.maay_word,
        voice: "nova"
      });
      
      if (response.data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${response.data.audio}`);
        audio.onended = () => setIsPlaying(false);
        audio.onerror = () => setIsPlaying(false);
        audio.play();
      }
    } catch (error) {
      toast.error("Could not play audio");
      setIsPlaying(false);
    }
    */
  };

  return (
    <Card 
      data-testid={`dict-entry-${entry.entry_id}`}
      className="p-5 border-2 border-border rounded-xl hover:border-primary/50 transition-colors duration-300 card-glow"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-heading font-semibold text-lg truncate text-primary">
              {entry.maay_word}
            </h3>
            <button
              onClick={playAudio}
              disabled={isPlaying}
              className={`p-1.5 rounded-full hover:bg-primary/10 text-primary transition-colors ${isPlaying ? 'animate-pulse' : ''}`}
              aria-label="Play pronunciation"
              title="Voice synthesis (needs API setup)"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
          
          <p className="text-foreground mb-3">{entry.english_translation}</p>
          
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs bg-secondary">
              {entry.part_of_speech}
            </Badge>
            {entry.sound_group && (
              <Badge className={`text-xs border ${soundGroupColors[entry.sound_group] || 'border-border'}`}>
                {entry.sound_group} group
              </Badge>
            )}
            {entry.is_verified && (
              <Badge className="bg-green-900/30 text-green-400 border border-green-500/50 text-xs">
                <Check className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            )}
          </div>
          
          {(entry.example_maay || entry.example_english) && (
            <div className="mt-4 pt-4 border-t border
