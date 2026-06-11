import { GlassPanel } from "@/components/glass/glass-panel";
import type { DailyBrief } from "@/lib/types";

export function DailyBriefing({ brief }: { brief: DailyBrief }) {
  return (
    <GlassPanel variant="strong" className="grid gap-5">
      <div>
        <p className="fine-label">Daily briefing</p>
        <h2 className="mt-2 text-2xl font-black text-white">Three moves matter today</h2>
      </div>

      <div className="grid gap-3">
        {brief.recommendedNextActions.map((action, index) => (
          <div className="flex gap-3 rounded-2xl border border-white/10 bg-black/18 p-4" key={action}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--stoop-jade)] text-sm font-black text-black">
              {index + 1}
            </span>
            <p className="text-sm font-semibold leading-6 text-white/84">{action}</p>
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}
