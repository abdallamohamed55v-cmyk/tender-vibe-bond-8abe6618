import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunction";
import { WORKSPACE_PRODUCT_MAP } from "@/lib/workspacePlans";

const PRODUCT_IDS: Record<string, string> = Object.fromEntries(
  Object.entries(WORKSPACE_PRODUCT_MAP).map(([key, value]) => [key, value.monthly]),
);

type Feature = { label: string; value: string | boolean };

type Plan = {
  name: string;
  tier: string;
  price: string;
  yearlyNote: string;
  description: string;
  nameClass: string;
  bestOffer?: boolean;
  features: Feature[];
};

const plans: Plan[] = [
  {
    name: "STARTER",
    tier: "starter",
    price: "9",
    yearlyNote: "or $89/yr — 960 MC",
    description: "Perfect for casual creators who want to explore AI tools",
    nameClass: "from-emerald-300 to-emerald-500",
    features: [
      { label: "Monthly Credits", value: "80 MC" },
      { label: "Chat Models", value: "All" },
      { label: "Image Generation", value: true },
      { label: "Video Generation", value: true },
      { label: "Code Builder", value: true },
      { label: "Deploy & Publish", value: true },
      { label: "Support", value: "Standard" },
    ],
  },
  {
    name: "PRO",
    tier: "pro",
    price: "29",
    yearlyNote: "or $299/yr — 3,360 MC",
    description: "Best for daily creators and small teams who need more output",
    nameClass: "from-amber-300 to-yellow-500",
    features: [
      { label: "Monthly Credits", value: "280 MC" },
      { label: "All AI Models", value: true },
      { label: "Private Creations", value: true },
      { label: "Custom Presets", value: true },
      { label: "API Access", value: true },
      { label: "Team Workspace", value: true },
      { label: "Support", value: "Priority" },
    ],
  },
  {
    name: "ELITE",
    tier: "elite",
    price: "59",
    yearlyNote: "or $599/yr — 5,760 MC",
    description: "For semi-pros and active creators who need maximum power",
    nameClass: "from-green-400 to-emerald-500",
    bestOffer: true,
    features: [
      { label: "Monthly Credits", value: "480 MC" },
      { label: "All Models (Fast Lane)", value: true },
      { label: "Advanced Presets", value: true },
      { label: "API + Webhooks", value: true },
      { label: "Custom Branding", value: true },
      { label: "Analytics Dashboard", value: true },
      { label: "Support", value: "Dedicated" },
    ],
  },
  {
    name: "BUSINESS",
    tier: "business",
    price: "149",
    yearlyNote: "or $1,599/yr — 17,760 MC",
    description: "Perfect for professional teams, studios, and content producers",
    nameClass: "from-rose-400 to-red-500",
    features: [
      { label: "Monthly Credits", value: "1,480 MC" },
      { label: "All Models + Priority", value: true },
      { label: "Dedicated Infrastructure", value: true },
      { label: "SSO & Role Management", value: true },
      { label: "Advanced Security", value: true },
      { label: "SLA Guarantee", value: true },
      { label: "Support", value: "Account Manager" },
    ],
  },
];

const PricingPreview = () => {
  const navigate = useNavigate();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = async (tier: string) => {
    const product_id = PRODUCT_IDS[tier];
    if (!product_id) {
      navigate("/pricing");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?redirect=/pricing");
      return;
    }
    setLoadingTier(tier);
    try {
      const { data, error } = await invokeFunction("dodo-checkout", {
        body: { product_id, plan: tier },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || "Checkout failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to open checkout");
      setLoadingTier(null);
    }
  };

  return (
    <section id="pricing" className="relative overflow-hidden py-16 md:py-32 bg-black">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-14 text-center"
        >
          <h2 className="font-display text-[10vw] font-black uppercase tracking-tighter leading-[0.85] text-white md:text-[6vw]">
            SIMPLE{" "}
            <span className="bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              PRICING
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/40">
            Every MC is real value. No hidden fees.
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="relative"
            >
              {plan.bestOffer && (
                <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-emerald-500 px-5 py-1 text-xs font-bold uppercase tracking-wider text-black shadow-lg shadow-emerald-500/30">
                  Best Offer
                </div>
              )}
              <div
                className={`relative h-full rounded-2xl border bg-[#0a0a0a] p-8 transition-all duration-300 hover:border-white/20 ${
                  plan.bestOffer ? "border-emerald-500/40" : "border-white/[0.08]"
                }`}
              >
                {/* Plan name */}
                <h3
                  className={`text-center font-display text-4xl font-black uppercase tracking-tight bg-gradient-to-b ${plan.nameClass} bg-clip-text text-transparent`}
                >
                  {plan.name}
                </h3>

                {/* Price */}
                <div className="mt-8 flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-white">${plan.price}</span>
                  <span className="text-base text-white/50">/month</span>
                </div>
                <p className="mt-2 text-center text-xs text-white/30">ex. tax</p>
                <p className="mt-1 text-center text-[11px] text-white/35">{plan.yearlyNote}</p>

                {/* Subscribe button */}
                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  disabled={loadingTier === plan.tier}
                  className="mt-6 w-full rounded-full bg-violet-600 py-3 text-base font-semibold text-white transition-all hover:bg-violet-500 disabled:opacity-50"
                >
                  {loadingTier === plan.tier ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    "Subscribe"
                  )}
                </button>

                {/* Description */}
                <p className="mt-7 min-h-[3rem] text-center text-sm leading-relaxed text-white/55">
                  {plan.description}
                </p>

                {/* Features */}
                <ul className="mt-6 space-y-3.5 border-t border-white/[0.06] pt-6">
                  {plan.features.map((f) => (
                    <li
                      key={f.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-white/70">{f.label}</span>
                      {typeof f.value === "boolean" ? (
                        <Check size={16} className="text-white/80" strokeWidth={2.5} />
                      ) : (
                        <span className="font-semibold text-white">{f.value}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Enterprise */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-6 rounded-2xl border border-white/[0.08] bg-[#0a0a0a] p-8 md:flex md:items-center md:justify-between md:p-10"
        >
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-cyan-500/10 p-3">
              <Building2 className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Enterprise</h3>
              <p className="mt-1 max-w-xl text-sm text-white/50">
                Custom plans for large teams — dedicated infrastructure, advanced security, SLA, and everything your organization needs.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/enterprise")}
            className="mt-6 w-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500 px-8 py-3 text-base font-semibold text-white transition-all hover:opacity-90 md:mt-0 md:w-auto"
          >
            Contact Sales
          </button>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingPreview;
