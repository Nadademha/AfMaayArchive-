import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, CreditCard, Calendar, Check, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { API } from "../App";
import axios from "axios";
import { toast } from "sonner";

const DONATION_AMOUNTS = [10, 25, 50, 100, 250, 500];

export default function DonatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(25);
  const [customAmount, setCustomAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [formData, setFormData] = useState({
    donor_name: "",
    donor_email: "",
    message: ""
  });

  const amount = customAmount ? parseInt(customAmount) : selectedAmount;

  const handleDonate = async (e) => {
    e.preventDefault();
    
    if (!formData.donor_name || !formData.donor_email) {
      toast.error("Please fill in your name and email");
      return;
    }
    
    if (!amount || amount < 1) {
      toast.error("Please select or enter a donation amount");
      return;
    }

    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/donations/create-checkout`, {
        amount: amount * 100, // Convert to cents
        currency: "usd",
        donor_name: formData.donor_name,
        donor_email: formData.donor_email,
        message: formData.message,
        is_recurring: isRecurring
      });
      
      if (response.data.checkout_url) {
        window.location.href = response.data.checkout_url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      const message = error.response?.data?.detail || "Failed to process donation. Please try again.";
      toast.error(message);
      setLoading(false);
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
              <Heart className="w-6 h-6 text-primary" />
              <h1 className="font-heading font-bold text-xl">Support Af Maay</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Info Section */}
          <div>
            <h2 className="font-heading text-3xl font-bold mb-4">
              Help Preserve <span className="text-primary">Af Maay</span>
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Your donation directly supports the preservation and digitization of Af Maay language. 
              We're building the first comprehensive digital platform for this unique language variant.
            </p>
            
            <div className="space-y-4 mb-8">
              {[
                "Dictionary development with audio pronunciations",
                "AI-powered translation and learning tools",
                "Community collaboration features",
                "Educational resources for learners",
                "Server and infrastructure costs"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-sm">{item}</span>
                </div>
              ))}
            </div>

            <Card className="p-4 border-2 border-primary/30 bg-primary/5">
              <p className="text-sm text-muted-foreground">
                <strong className="text-primary">Tax Deductible:</strong> Donations may be tax deductible. 
                You will receive a receipt via email for your records.
              </p>
            </Card>
          </div>

          {/* Donation Form */}
          <Card className="p-6 border-2 border-border">
            <form onSubmit={handleDonate} className="space-y-6">
              {/* Amount Selection */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Select Amount</Label>
                <div className="grid grid-cols-3 gap-3">
                  {DONATION_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => { setSelectedAmount(amt); setCustomAmount(""); }}
                      className={`
                        py-3 px-4 rounded-lg border-2 font-semibold transition-all
                        ${selectedAmount === amt && !customAmount
                          ? 'border-primary bg-primary text-white'
                          : 'border-border hover:border-primary'
                        }
                      `}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
                
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    placeholder="Custom amount"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setSelectedAmount(0);
                    }}
                    className="pl-8"
                    min="1"
                  />
                </div>
              </div>

              {/* Recurring Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Monthly Donation</p>
                    <p className="text-sm text-muted-foreground">Support us every month</p>
                  </div>
                </div>
                <Switch
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                />
              </div>

              {/* Donor Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name *</Label>
                  <Input
                    id="name"
                    value={formData.donor_name}
                    onChange={(e) => setFormData({ ...formData, donor_name: e.target.value })}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.donor_email}
                    onChange={(e) => setFormData({ ...formData, donor_email: e.target.value })}
                    placeholder="Enter your email"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Receipt will be sent to this email
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="message">Message (Optional)</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Leave a message of support..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 py-6 text-lg"
                disabled={loading || !amount}
                data-testid="donate-submit-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Donate ${amount}{isRecurring ? '/month' : ''}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Secure payment powered by Stripe. Your card information is never stored on our servers.
              </p>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
