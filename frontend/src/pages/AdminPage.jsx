import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, Settings, Book, Users, BarChart3, 
  Check, X, Upload, Search, Trash2, Edit, 
  AlertCircle, Plus, FileText, MessageSquare
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useAuth, API } from "../App";
import axios from "axios";
import { toast } from "sonner";

// Stats Card
const StatCard = ({ icon: Icon, label, value, color = "primary" }) => (
  <Card className="p-5 border-2 border-border">
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-lg bg-${color}/10 text-${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-heading text-2xl font-bold">{value}</p>
      </div>
    </div>
  </Card>
);

// Pending Entry Card
const PendingEntryCard = ({ entry, onApprove, onReject }) => (
  <Card className="p-4 border-2 border-border hover:border-primary/50 transition-colors">
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold truncate">{entry.maay_word}</h4>
        <p className="text-sm text-muted-foreground">{entry.english_translation}</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="secondary" className="text-xs">{entry.part_of_speech}</Badge>
          {entry.sound_group && (
            <Badge variant="outline" className="text-xs">{entry.sound_group} group</Badge>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onApprove(entry.entry_id)}
          className="h-8 w-8 text-accent hover:bg-accent hover:text-accent-foreground"
        >
          <Check className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onReject(entry.entry_id)}
          className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  </Card>
);

// Vocabulary Gap Card
const VocabularyGapCard = ({ gap, onSuggest, onApprove }) => {
  const [suggestion, setSuggestion] = useState(gap.suggested_maay || "");
  const [showInput, setShowInput] = useState(false);

  const handleSuggest = async () => {
    if (!suggestion.trim()) return;
    await onSuggest(gap.gap_id, suggestion);
    setShowInput(false);
  };

  return (
    <Card className="p-4 border-2 border-border">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">{gap.english_term}</h4>
            <Badge variant="secondary" className="text-xs">{gap.frequency}x</Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{gap.context}</p>
          <Badge variant="outline" className="mt-2 text-xs">{gap.domain}</Badge>
          
          {gap.suggested_maay && (
            <div className="mt-3 p-2 bg-accent/10 rounded-lg">
              <p className="text-sm">
                <span className="text-muted-foreground">Suggestion: </span>
                <span className="font-medium">{gap.suggested_maay}</span>
              </p>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-2">
          {gap.suggested_maay ? (
            <Button
              size="sm"
              onClick={() => onApprove(gap.gap_id)}
              className="bg-accent hover:bg-accent/90"
            >
              <Check className="w-4 h-4 mr-1" />
              Approve
            </Button>
          ) : showInput ? (
            <div className="flex flex-col gap-2">
              <Input
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="Maay word"
                className="w-32"
              />
              <div className="flex gap-1">
                <Button size="sm" onClick={handleSuggest}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowInput(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowInput(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Suggest
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

// Bulk Upload Dialog
const BulkUploadDialog = ({ onUpload }) => {
  const [open, setOpen] = useState(false);
  const [jsonData, setJsonData] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    try {
      const entries = JSON.parse(jsonData);
      if (!Array.isArray(entries)) {
        toast.error("Data must be an array of entries");
        return;
      }
      
      setLoading(true);
      await onUpload(entries);
      setOpen(false);
      setJsonData("");
    } catch (e) {
      toast.error("Invalid JSON format");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Bulk Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Upload Dictionary Entries</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>JSON Data</Label>
            <Textarea
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              placeholder={`[
  {
    "maay_word": "example",
    "english_translation": "example",
    "part_of_speech": "noun",
    "sound_group": "k",
    "example_maay": "Example sentence",
    "example_english": "Translation"
  }
]`}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={loading || !jsonData.trim()}>
              {loading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Add Grammar Rule Dialog
const AddGrammarDialog = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: "verb_morphology",
    title: "",
    content: "",
    difficulty: "beginner"
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.content) {
      toast.error("Please fill required fields");
      return;
    }
    
    setLoading(true);
    try {
      await onAdd(formData);
      setOpen(false);
      setFormData({ category: "verb_morphology", title: "", content: "", difficulty: "beginner" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Grammar Rule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <Select 
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="verb_morphology">Verb Morphology</SelectItem>
                  <SelectItem value="nominal_morphology">Nominal Morphology</SelectItem>
                  <SelectItem value="syntax">Syntax</SelectItem>
                  <SelectItem value="phonology">Phonology</SelectItem>
                  <SelectItem value="demonstratives">Demonstratives</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select 
                value={formData.difficulty}
                onValueChange={(v) => setFormData({ ...formData, difficulty: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div>
            <Label>Title *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Rule title"
              required
            />
          </div>
          
          <div>
            <Label>Content *</Label>
            <Textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Explain the grammar rule..."
              rows={6}
              required
            />
          </div>
          
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Rule"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [pendingEntries, setPendingEntries] = useState([]);
  const [vocabularyGaps, setVocabularyGaps] = useState([]);
  const [grammarRules, setGrammarRules] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, pendingRes, gapsRes, grammarRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { withCredentials: true }),
        axios.get(`${API}/admin/pending-entries`, { withCredentials: true }),
        axios.get(`${API}/vocabulary-gaps?status=pending`),
        axios.get(`${API}/grammar`)
      ]);
      
      setStats(statsRes.data);
      setPendingEntries(pendingRes.data);
      setVocabularyGaps(gapsRes.data);
      setGrammarRules(grammarRes.data);
    } catch (error) {
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApproveEntry = async (entryId) => {
    try {
      await axios.post(`${API}/dictionary/${entryId}/verify`, {}, { withCredentials: true });
      toast.success("Entry approved!");
      fetchData();
    } catch (error) {
      toast.error("Failed to approve entry");
    }
  };

  const handleRejectEntry = async (entryId) => {
    try {
      await axios.delete(`${API}/dictionary/${entryId}`, { withCredentials: true });
      toast.success("Entry rejected");
      fetchData();
    } catch (error) {
      toast.error("Failed to reject entry");
    }
  };

  const handleSuggestMaay = async (gapId, suggestion) => {
    try {
      await axios.post(`${API}/vocabulary-gaps/${gapId}/suggest`, { suggested_maay: suggestion });
      toast.success("Suggestion saved!");
      fetchData();
    } catch (error) {
      toast.error("Failed to save suggestion");
    }
  };

  const handleApproveGap = async (gapId) => {
    try {
      await axios.post(`${API}/vocabulary-gaps/${gapId}/approve`, {}, { withCredentials: true });
      toast.success("Gap approved and added to dictionary!");
      fetchData();
    } catch (error) {
      toast.error("Failed to approve gap");
    }
  };

  const handleBulkUpload = async (entries) => {
    try {
      const response = await axios.post(`${API}/admin/bulk-upload/dictionary`, { entries }, { withCredentials: true });
      toast.success(response.data.message);
      fetchData();
    } catch (error) {
      toast.error("Bulk upload failed");
    }
  };

  const handleAddGrammar = async (data) => {
    try {
      await axios.post(`${API}/grammar`, data, { withCredentials: true });
      toast.success("Grammar rule added!");
      fetchData();
    } catch (error) {
      toast.error("Failed to add grammar rule");
    }
  };

  if (!user?.is_admin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h2 className="font-heading text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">You need admin privileges to access this page.</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
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
              <Settings className="w-6 h-6 text-primary" />
              <h1 className="font-heading font-bold text-xl">Admin Panel</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        {loading ? (
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            {[1,2,3,4].map(i => (
              <Card key={i} className="p-5 animate-pulse">
                <div className="h-16 bg-muted rounded" />
              </Card>
            ))}
          </div>
        ) : stats && (
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Book} label="Dictionary Entries" value={stats.dictionary_entries} />
            <StatCard icon={Check} label="Verified" value={stats.verified_entries} color="accent" />
            <StatCard icon={Users} label="Users" value={stats.users} color="secondary" />
            <StatCard icon={AlertCircle} label="Pending Gaps" value={stats.vocabulary_gaps} color="chart-4" />
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="pending">Pending Review</TabsTrigger>
            <TabsTrigger value="gaps">Vocabulary Gaps</TabsTrigger>
            <TabsTrigger value="grammar">Grammar Rules</TabsTrigger>
            <TabsTrigger value="upload">Upload Data</TabsTrigger>
          </TabsList>

          {/* Pending Entries Tab */}
          <TabsContent value="pending" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-lg">
                Pending Dictionary Entries ({pendingEntries.length})
              </h2>
            </div>
            
            {pendingEntries.length === 0 ? (
              <Card className="p-8 text-center">
                <Check className="w-12 h-12 mx-auto text-accent mb-4" />
                <p className="text-muted-foreground">All caught up! No pending entries.</p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {pendingEntries.map(entry => (
                  <PendingEntryCard
                    key={entry.entry_id}
                    entry={entry}
                    onApprove={handleApproveEntry}
                    onReject={handleRejectEntry}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Vocabulary Gaps Tab */}
          <TabsContent value="gaps" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-lg">
                Missing Vocabulary ({vocabularyGaps.length})
              </h2>
            </div>
            
            {vocabularyGaps.length === 0 ? (
              <Card className="p-8 text-center">
                <Book className="w-12 h-12 mx-auto text-accent mb-4" />
                <p className="text-muted-foreground">No vocabulary gaps to fill.</p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {vocabularyGaps.map(gap => (
                  <VocabularyGapCard
                    key={gap.gap_id}
                    gap={gap}
                    onSuggest={handleSuggestMaay}
                    onApprove={handleApproveGap}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Grammar Rules Tab */}
          <TabsContent value="grammar" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-lg">
                Grammar Rules ({grammarRules.length})
              </h2>
              <AddGrammarDialog onAdd={handleAddGrammar} />
            </div>
            
            {grammarRules.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No grammar rules yet. Add your first rule!</p>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {grammarRules.map(rule => (
                  <Card key={rule.rule_id} className="p-5 border-2 border-border">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-semibold">{rule.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{rule.content}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant="secondary">{rule.category}</Badge>
                          <Badge variant="outline">{rule.difficulty}</Badge>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Upload Data Tab */}
          <TabsContent value="upload" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-lg">Data Upload</h2>
            </div>
            
            <Card className="p-6 border-2 border-border">
              <h3 className="font-semibold mb-4">Bulk Dictionary Upload</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload multiple dictionary entries at once using JSON format.
                Entries will be automatically verified.
              </p>
              <BulkUploadDialog onUpload={handleBulkUpload} />
              
              <div className="mt-6 pt-6 border-t border-border">
                <h4 className="font-medium mb-2">Expected Format</h4>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`[
  {
    "maay_word": "ninki",
    "english_translation": "the man",
    "part_of_speech": "noun",
    "sound_group": "k",
    "example_maay": "Ninki wuu yimi",
    "example_english": "The man came"
  }
]`}
                </pre>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
