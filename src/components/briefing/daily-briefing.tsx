import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DailyBrief } from "@/lib/types";

export function DailyBriefing({ brief }: { brief: DailyBrief }) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <p className="radar-label">Daily briefing</p>
        <CardTitle className="text-lg font-semibold">Generated from local listings</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-2">
        {brief.recommendedNextActions.length ? (
          brief.recommendedNextActions.map((action, index) => (
            <div className="flex gap-3 rounded-md border bg-muted/35 p-3" key={action}>
              <span className="radar-on-primary grid size-7 shrink-0 place-items-center rounded-md bg-primary text-sm font-semibold">
                {index + 1}
              </span>
              <p className="text-sm font-medium leading-6">{action}</p>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            No local listing actions yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
