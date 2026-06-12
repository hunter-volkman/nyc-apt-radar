import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ListingEvaluation, ListingView } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ListingRiskPanel({
  listing,
  evaluation,
}: {
  listing: ListingView;
  evaluation: ListingEvaluation;
}) {
  return (
    <Card
      className={cn(
        "rounded-lg shadow-sm",
        listing.riskLevel === "high" && "border-red-200 bg-red-50/60",
      )}
    >
      <CardHeader>
        <p className="radar-label">Building risk</p>
        <CardTitle className="text-lg font-semibold">Unknown until sourced</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          No live HPD, DOB, 311, or rent-stabilization data is connected.
        </p>
      </CardHeader>

      <CardContent className="grid gap-3">
        <RiskList title="Listing risks" items={evaluation.risks} />
        <RiskList title="Red flags" items={listing.redFlags.length ? listing.redFlags : ["None captured"]} />
        <RiskList title="Open questions" items={evaluation.openQuestions} />
      </CardContent>
    </Card>
  );
}

function RiskList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="radar-label">{title}</p>
      <ul className="mt-2 grid gap-2 text-sm leading-5 text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
