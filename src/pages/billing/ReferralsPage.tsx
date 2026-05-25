import { ArrowLeft, Copy, Check } from "lucide-react";
import FancyButton from "@/components/branding/FancyButton";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { DesktopSettingsLayout } from "@/components/settings/DesktopSettingsLayout";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import referralHero from "@/assets/referral-hero.webp";

interface Referral {
  id: string;
  referred_id: string;
  status: string;
  created_at: string;
}

interface Earning {
  id: string;
  amount: number;
  source_action: string;
  created_at: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: string;
  method: string;
  created_at: string;
}

const ReferralsPage = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [activeTab, setActiveTab] = useState<"referrals" | "earnings" | "withdrawals">("referrals");

  const referralLink = referralCode ? `${window.location.origin}/ref/${referralCode}` : "";

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: codes } = await supabase
      .from("referral_codes")
      .select("code")
      .eq("user_id", user.id)
      .limit(1);

    if (codes && codes.length > 0) {
      setReferralCode(codes[0].code);
    } else {
      const code = `MEGSY-${user.id.substring(0, 6).toUpperCase()}`;
      await supabase.from("referral_codes").insert({ user_id: user.id, code });
      setReferralCode(code);
    }

    const { data: refs } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });
    if (refs) setReferrals(refs);

    const { data: earns } = await supabase
      .from("referral_earnings")
      .select("*")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });
    if (earns) setEarnings(earns);

    const { data: wds } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (wds) setWithdrawals(wds);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const total = earnings.reduce((s, e) => s + Number(e.amount), 0);
    const withdrawn = withdrawals
      .filter(w => w.status !== "rejected")
      .reduce((s, w) => s + Number(w.amount), 0);
    setTotalEarned(total);
    setAvailableBalance(total - withdrawn);
  }, [earnings, withdrawals]);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const content = (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 max-w-lg mx-auto pb-16">

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden">
        <img src={referralHero} alt="Megsy Referral Program" className="w-full h-auto object-cover" />
      </div>

      {/* Headline */}
      <div className="text-center space-y-1.5">
        <h2 className="font-display text-2xl font-bold text-foreground tracking-tight">Referral Program</h2>
        <p className="text-sm text-muted-foreground">20% commission on every payment — forever</p>
      </div>

      {/* Stats — transparent, no borders */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Referrals", value: referrals.length.toString() },
          { label: "Total Earned", value: `$${totalEarned.toFixed(2)}` },
          { label: "Available", value: `$${availableBalance.toFixed(2)}` },
        ].map(stat => (
          <div key={stat.label} className="text-center py-3">
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Referral Link */}
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Your Referral Link</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-4 py-3 rounded-xl bg-muted/30 text-sm text-foreground truncate select-all font-mono">
            {referralLink || "Loading..."}
          </div>
          <button
            onClick={handleCopy}
            className="p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* How it works — clean, no borders */}
      <div className="space-y-3">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">How It Works</p>
        <div className="space-y-1">
          {[
            { step: "1", text: "Share your unique referral link" },
            { step: "2", text: "They sign up and make a purchase" },
            { step: "3", text: "You earn 20% of every payment, forever" },
          ].map(item => (
            <div key={item.step} className="flex items-center gap-3 py-2.5">
              <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                {item.step}
              </span>
              <p className="text-sm text-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Withdraw CTA */}
      <FancyButton onClick={() => navigate("/settings/withdraw")} className="w-full">
        Request Withdrawal
      </FancyButton>

      {/* Tabs */}
      <div className="flex bg-secondary/50 rounded-full p-1">
        {(["referrals", "earnings", "withdrawals"] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-semibold transition-all capitalize ${
              activeTab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="space-y-1">
          {activeTab === "referrals" && (
            referrals.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No referrals yet. Share your link to get started.</p>
            ) : (
              referrals.map(r => (
                <div key={r.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">User {r.referred_id.substring(0, 8)}...</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(r.created_at)}</p>
                  </div>
                  <span className={`text-[11px] font-medium ${r.status === "active" ? "text-green-500" : "text-primary"}`}>
                    {r.status}
                  </span>
                </div>
              ))
            )
          )}

          {activeTab === "earnings" && (
            earnings.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No earnings yet.</p>
            ) : (
              earnings.map(e => (
                <div key={e.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">${Number(e.amount).toFixed(2)}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(e.created_at)}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{e.source_action}</span>
                </div>
              ))
            )
          )}

          {activeTab === "withdrawals" && (
            withdrawals.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No withdrawal requests yet.</p>
            ) : (
              withdrawals.map(w => (
                <div key={w.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">${Number(w.amount).toFixed(2)}</p>
                    <p className="text-[11px] text-muted-foreground">{w.method} — {formatDate(w.created_at)}</p>
                  </div>
                  <span className={`text-[11px] font-medium ${
                    w.status === "completed" ? "text-green-500" :
                    w.status === "rejected" ? "text-destructive" :
                    "text-primary"
                  }`}>
                    {w.status}
                  </span>
                </div>
              ))
            )
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );

  if (!isMobile) {
    return (
      <DesktopSettingsLayout title="Referrals" subtitle="Earn commission by inviting friends">
        {content}
      </DesktopSettingsLayout>
    );
  }

  return (
    <div className="h-[100dvh] bg-background overflow-y-auto">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display text-lg font-bold text-foreground">Referrals</h1>
        </div>
        <div className="px-4">{content}</div>
      </div>
    </div>
  );
};

export default ReferralsPage;
