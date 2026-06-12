import { ScoreTile } from "@/components/listings/listing-badges";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
    <Card className="rounded-lg shadow-sm">
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="radar-label">Score</p>
            <CardTitle className="mt-1 text-lg font-semibold">
              {evaluation.totalScore}/100
            </CardTitle>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {evaluation.eligible ? "Eligible" : "Ineligible"} · {evaluation.confidence} confidence
            </p>
          </div>
          <ScoreTile eligible={evaluation.eligible} score={evaluation.totalScore} />
        </div>
      </CardHeader>

      <CardContent className="grid gap-3">
        {Object.entries(evaluation.scoreBreakdown).map(([key, value]) => {
          const typedKey = key as keyof ListingEvaluation["scoreBreakdown"];
          const max = scoringWeights[typedKey];
          const percent = Math.round((value / max) * 100);

          return (
            <div key={key}>
              <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-muted-foreground">{scoreLabels[typedKey]}</span>
                <span className="font-semibold">
                  {value}/{max}
                </span>
              </div>
              <Progress value={percent} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
