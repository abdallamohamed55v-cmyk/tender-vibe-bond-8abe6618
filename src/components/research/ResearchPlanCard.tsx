import { motion } from "framer-motion";
import MegsyStar from "@/components/files/MegsyStar";

export type ResearchPlan = {
  goal: string;
  steps: string[];
};

const ResearchPlanCard = ({ plan }: { plan: ResearchPlan }) => {
  const steps = plan.steps.map((step) => step.trim()).filter(Boolean);
  const goal = plan.goal.trim();

  if (!goal && steps.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <MegsyStar size={18} static />
        <h3 className="text-sm font-semibold text-foreground">Research Plan</h3>
      </div>
      {goal && <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{goal}</p>}
      <ol className="space-y-2">
        {steps.map((step, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-3 text-xs text-foreground/85"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <span className="leading-relaxed pt-0.5">{step}</span>
          </motion.li>
        ))}
      </ol>
    </motion.div>
  );
};

export default ResearchPlanCard;
