import { GlassPanel } from "@/components/glass/glass-panel";
import { scoringWeights } from "@/lib/scoring";
import type { ListingEvaluation } from "@/lib/types";

const scoreLabels: Record<keyof ListingEvaluation["scoreBreakdown"], string> = {
  location: "Location and commute",
  price: "Price",
  apartmentFit: "Apartment fit",
  moveInFit: "Move-in fit",
  risk: "Risk",
  responsiveness: "Responsiveness",
  subjectivePull: "Subjective pull",
};

export function ListingScore({ evaluation }: { evaluation: ListingEvaluation }) {
  return (
    <GlassPanel className="grid gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="fine-label">Score</p>
          <h2 className="mt-2 text-2xl font-black text-white">{evaluation.totalScore}/100</h2>
          <p className="mt-2 text-sm font-semibold text-white/64">
            {evaluation.eligible ? "Eligible" : "Ineligible"} - {evaluation.confidence} confidence
          </p>
        </div>
        <span className={evaluation.eligible ? "score-chip" : "score-chip score-chip-muted"}>{evaluation.totalScore}</span>
      </div>

      <div className="grid gap-3">
        {Object.entries(evaluation.scoreBreakdown).map(([key, value]) => {
          const typedKey = key as keyof ListingEvaluation["scoreBreakdown"];
          const max = scoringWeights[typedKey];
          const percent = `${Math.round((value / max) * 100)}%`;

          return (
            <div key={key}>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-white/78">{scoreLabels[typedKey]}</span>
                <span className="font-bold text-white">
                  {value}/{max}
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-[var(--stoop-jade)]" style={{ width: percent }} />
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
