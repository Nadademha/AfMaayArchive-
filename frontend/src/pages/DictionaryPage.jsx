import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Volume2, Book, Mic, ArrowLeft, Check, X, Plus, Edit, Upload } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { useAuth, API } from "../App";
import axios from "axios";
import { toast } from "sonner";

// Sound Group Badge Colors
const soundGroupColors = {
  k: "bg-orange-900/30 text-orange-400 border-orange-500/50",
  t: "bg-blue-900/30 text-blue-400 border-blue-500/50",
  dh: "bg-green-900/30 text-green-400 border-green-500/50",
  n: "bg-yellow-900/30 text-yellow-400 border-yellow-500/50",
  b: "bg-purple-900/30 text-purple-400 border-purple-500/50",
  r: "bg-red-900/30 text-red-400 border-red-500/50"
};

// Dictionary Entry Card
const DictionaryCard = ({ entry, user, onEdit, onSuggestEdit }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const playAudio = async () => {
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
  };

  const canEdit = user?.is_admin || user?.is_contributor;

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
            {entry.is_verified ? (
              <Badge className="bg-green-900/30 text-green-400 border border-green-500/50 text-xs">
                <Check className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Community
              </Badge>
            )}
          </div>
          
          {(entry.example_maay || entry.example_english) && (
            <div className="mt-4 pt-4 border-t border-border">
              {entry.example_maay && (
                <p className="text-sm italic text-primary/80 mb-1">
                  "{entry.example_maay}"
                </p>
              )}
              {entry.example_english && (
                <p className="text-sm text-muted-foreground">
                  "{entry.example_english}"
                </p>
              )}
            </div>
          )}
          
          {entry.contributor_name && (
            <p className="text-xs text-muted-foreground mt-3">
              Contributed by {entry.contributor_name}
            </p>
          )}
        </div>
        
        {/* Edit buttons */}
        {user && (
          <div className="flex flex-col gap-1">
            {canEdit ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(entry)}
                className="h-8 w-8 text-muted-foreground hover:text-primary"
              >
                <Edit className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onSuggestEdit(entry)}
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                title="Suggest an edit"
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

// Add/Edit Word Dialog
const WordDialog = ({ mode = "add", entry = null, onSave, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    maay_word: entry?.maay_word || "",
    english_translation: entry?.english_translation || "",
    part_of_speech: entry?.part_of_speech || "noun",
    sound_group: entry?.sound_group || "",
    example_maay: entry?.example_maay || "",
    example_english: entry?.example_english || ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.maay_word || !formData.english_translation) {
      toast.error("Please fill in required fields");
      return;
    }

    setLoading(true);
    try {
      await onSave(formData, entry?.entry_id);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="maay_word">Af Maay Word *</Label>
        <Input
          id="maay_word"
          value={formData.maay_word}
          onChange={(e) => setFormData({ ...formData, maay_word: e.target.value })}
          placeholder="Enter Af Maay word"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="english">English Translation *</Label>
        <Input
          id="english"
          value={formData.english_translation}
          onChange={(e) => setFormData({ ...formData, english_translation: e.target.value })}
          placeholder="Enter English translation"
          required
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Part of Speech</Label>
          <Select 
            value={formData.part_of_speech} 
            onValueChange={(v) => setFormData({ ...formData, part_of_speech: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="noun">Noun</SelectItem>
              <SelectItem value="verb">Verb</SelectItem>
              <SelectItem value="adjective">Adjective</SelectItem>
              <SelectItem value="adverb">Adverb</SelectItem>
              <SelectItem value="pronoun">Pronoun</SelectItem>
              <SelectItem value="preposition">Preposition</SelectItem>
              <SelectItem value="conjunction">Conjunction</SelectItem>
              <SelectItem value="interjection">Interjection</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>Sound Group</Label>
          <Select 
            value={formData.sound_group || "none"} 
            onValueChange={(v) => setFormData({ ...formData, sound_group: v === "none" ? "" : v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              <SelectItem value="k">K Group</SelectItem>
              <SelectItem value="t">T Group</SelectItem>
              <SelectItem value="dh">DH Group</SelectItem>
              <SelectItem value="n">N Group</SelectItem>
              <SelectItem value="b">B Group</SelectItem>
              <SelectItem value="r">R Group</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="example_maay">Example (Af Maay)</Label>
        <Textarea
          id="example_maay"
          value={formData.example_maay}
          onChange={(e) => setFormData({ ...formData, example_maay: e.target.value })}
          placeholder="Example sentence in Af Maay"
          rows={2}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="example_english">Example (English)</Label>
        <Textarea
          id="example_english"
          value={formData.example_english}
          onChange={(e) => setFormData({ ...formData, example_english: e.target.value })}
          placeholder="English translation of example"
          rows={2}
        />
      </div>
      
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading} className="bg-primary">
          {loading ? "Saving..." : mode === "add" ? "Add Word" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
};

// Suggest Edit Dialog
const SuggestEditDialog = ({ entry, onSubmit, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    maay_word: entry?.maay_word || "",
    english_translation: entry?.english_translation || "",
    reason: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(entry.entry_id, formData);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground mb-4">
        Suggest corrections to this entry. An admin will review your suggestion.
      </p>
      
      <div className="space-y-2">
        <Label htmlFor="maay_word">Af Maay Word</Label>
        <Input
          id="maay_word"
          value={formData.maay_word}
          onChange={(e) => setFormData({ ...formData, maay_word: e.target.value })}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="english">English Translation</Label>
        <Input
          id="english"
          value={formData.english_translation}
          onChange={(e) => setFormData({ ...formData, english_translation: e.target.value })}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="reason">Reason for change</Label>
        <Textarea
          id="reason"
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          placeholder="Explain why this change is needed..."
          rows={3}
        />
      </div>
      
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading} className="bg-primary">
          {loading ? "Submitting..." : "Submit Suggestion"}
        </Button>
      </div>
    </form>
  );
};

export default function DictionaryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLanguage, setSearchLanguage] = useState("both");
  const [soundGroupFilter, setSoundGroupFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  
  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [suggestingEntry, setSuggestingEntry] = useState(null);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (searchLanguage !== "both") params.append("language", searchLanguage);
      if (soundGroupFilter) params.append("sound_group", soundGroupFilter);
      if (verifiedOnly) params.append("verified_only", "true");
      
      const response = await axios.get(`${API}/dictionary?${params.toString()}`);
      setEntries(response.data);
    } catch (error) {
      toast.error("Failed to load dictionary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [searchLanguage, soundGroupFilter, verifiedOnly]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (searchQuery !== undefined) {
        fetchEntries();
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Voice search
  const handleVoiceSearch = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        const formData = new FormData();
        formData.append('file', blob, 'search.webm');
        
        try {
          const response = await axios.post(`${API}/voice/transcribe`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          if (response.data.text) {
            setSearchQuery(response.data.text);
            toast.success("Voice search: " + response.data.text);
          }
        } catch (error) {
          toast.error("Voice search failed");
        }
      };

      recorder.start();
      setTimeout(() => recorder.stop(), 3000);
      toast.info("Listening for 3 seconds...");
    } catch (error) {
      toast.error("Could not access microphone");
    }
  };

  // Add word
  const handleAddWord = async (data) => {
    try {
      await axios.post(`${API}/dictionary`, data, { withCredentials: true });
      toast.success("Word added successfully!");
      fetchEntries();
    } catch (error) {
      toast.error("Failed to add word");
      throw error;
    }
  };

  // Edit word
  const handleEditWord = async (data, entryId) => {
    try {
      await axios.put(`${API}/dictionary/${entryId}`, data, { withCredentials: true });
      toast.success("Word updated successfully!");
      fetchEntries();
    } catch (error) {
      toast.error("Failed to update word");
      throw error;
    }
  };

  // Suggest edit
  const handleSuggestEdit = async (entryId, data) => {
    try {
      const changes = {};
      if (data.maay_word) changes.maay_word = data.maay_word;
      if (data.english_translation) changes.english_translation = data.english_translation;
      
      await axios.post(`${API}/dictionary/${entryId}/suggest-edit`, {
        changes,
        reason: data.reason
      }, { withCredentials: true });
      
      toast.success("Edit suggestion submitted for review!");
    } catch (error) {
      toast.error("Failed to submit suggestion");
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4">
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
              <Book className="w-6 h-6 text-primary" />
              <h1 className="font-heading font-bold text-xl">Dictionary</h1>
            </div>
            <div className="flex-1" />
            {user && (
              <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90" data-testid="add-word-btn">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Word
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-heading">Add New Word</DialogTitle>
                  </DialogHeader>
                  <WordDialog 
                    mode="add"
                    onSave={handleAddWord}
                    onClose={() => setShowAddDialog(false)}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </header>

      {/* Search & Filters */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search words..."
              className="pl-10 pr-12 h-12 text-base bg-card border-border"
              data-testid="dictionary-search"
            />
            <button
              onClick={handleVoiceSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-primary/10 text-primary"
              aria-label="Voice search"
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <Select value={searchLanguage} onValueChange={setSearchLanguage}>
              <SelectTrigger className="w-32 bg-card">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both</SelectItem>
                <SelectItem value="maay">Af Maay</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>

            <Select value={soundGroupFilter || "all"} onValueChange={(v) => setSoundGroupFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-36 bg-card">
                <SelectValue placeholder="Sound Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                <SelectItem value="k">K Group</SelectItem>
                <SelectItem value="t">T Group</SelectItem>
                <SelectItem value="dh">DH Group</SelectItem>
                <SelectItem value="n">N Group</SelectItem>
                <SelectItem value="b">B Group</SelectItem>
                <SelectItem value="r">R Group</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={verifiedOnly ? "default" : "outline"}
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={`whitespace-nowrap ${verifiedOnly ? 'bg-primary' : 'border-border'}`}
            >
              <Check className="w-4 h-4 mr-1" />
              Verified
            </Button>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {[1,2,3,4].map(i => (
              <Card key={i} className="p-5 border-2 border-border animate-pulse">
                <div className="h-6 bg-muted rounded w-1/3 mb-3" />
                <div className="h-4 bg-muted rounded w-2/3 mb-4" />
                <div className="flex gap-2">
                  <div className="h-5 bg-muted rounded w-16" />
                  <div className="h-5 bg-muted rounded w-20" />
                </div>
              </Card>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <Book className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-heading font-semibold text-lg mb-2">No entries found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? "Try a different search term" : "Be the first to add a word!"}
            </p>
            {user && (
              <Button onClick={() => setShowAddDialog(true)} className="bg-primary">
                <Plus className="w-4 h-4 mr-2" />
                Add Word
              </Button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {entries.map((entry, index) => (
              <div 
                key={entry.entry_id} 
                className="animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <DictionaryCard 
                  entry={entry} 
                  user={user}
                  onEdit={setEditingEntry}
                  onSuggestEdit={setSuggestingEntry}
                />
              </div>
            ))}
          </div>
        )}

        {/* Results count */}
        {!loading && entries.length > 0 && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            Showing {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </p>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingEntry} onOpenChange={() => setEditingEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Edit Word</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <WordDialog 
              mode="edit"
              entry={editingEntry}
              onSave={handleEditWord}
              onClose={() => setEditingEntry(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Suggest Edit Dialog */}
      <Dialog open={!!suggestingEntry} onOpenChange={() => setSuggestingEntry(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Suggest Edit</DialogTitle>
          </DialogHeader>
          {suggestingEntry && (
            <SuggestEditDialog
              entry={suggestingEntry}
              onSubmit={handleSuggestEdit}
              onClose={() => setSuggestingEntry(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
