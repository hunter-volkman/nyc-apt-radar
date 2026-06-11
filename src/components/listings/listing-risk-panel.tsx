import { GlassPanel } from "@/components/glass/glass-panel";
import type { DemoListing, ListingEvaluation } from "@/lib/types";

export function ListingRiskPanel({
  listing,
  evaluation,
}: {
  listing: DemoListing;
  evaluation: ListingEvaluation;
}) {
  return (
    <GlassPanel variant={listing.riskLevel === "high" ? "danger" : "default"} className="grid gap-5">
      <div>
        <p className="fine-label">Building risk</p>
        <h2 className="mt-2 text-2xl font-black text-white">Unknown until sourced</h2>
        <p className="mt-2 text-sm leading-6 text-white/68">
          No live HPD, DOB, 311, or rent-stabilization data is connected in Thread 0.
        </p>
      </div>

      <div className="grid gap-3">
        <RiskList title="Listing risks" items={evaluation.risks} />
        <RiskList title="Red flags" items={listing.redFlags.length ? listing.redFlags : ["None captured"]} />
        <RiskList title="Open questions" items={evaluation.openQuestions} />
      </div>
    </GlassPanel>
  );
}

function RiskList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/18 p-4">
      <p className="fine-label">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm leading-5 text-white/76">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
