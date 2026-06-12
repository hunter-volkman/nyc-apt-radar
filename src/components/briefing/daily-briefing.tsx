import { Clock, FileCheck2, Flame, ListChecks } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DailyBriefingResult } from "@/lib/types";

export function DailyBriefing({ brief }: { brief: DailyBriefingResult }) {
  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="stoop-label">Daily briefing</p>
            <CardTitle className="mt-1 text-lg font-semibold">Three moves matter today</CardTitle>
          </div>
          <Badge className="h-6 rounded-md" variant="secondary">
            {brief.generationMode === "openai" ? "OpenAI assisted" : "Local fallback"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          {brief.recommendedNextActions.map((action, index) => (
            <div className="flex gap-3 rounded-md border bg-muted/35 p-3" key={action}>
              <span className="stoop-on-primary grid size-7 shrink-0 place-items-center rounded-md bg-primary text-sm font-semibold">
                {index + 1}
              </span>
              <p className="text-sm font-medium leading-6">{action}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-2">
          <BriefingMiniList icon={<ListChecks />} title="Best candidates" items={brief.bestCandidates} />
          <BriefingMiniList icon={<Clock />} title="Follow-ups" items={brief.followUps} />
          <BriefingMiniList icon={<Flame />} title="Tours and risks" items={brief.upcomingTours.concat(brief.deadOrRiskyListings.slice(0, 2))} />
          <BriefingMiniList icon={<FileCheck2 />} title="Readiness gaps" items={brief.applicationReadinessGaps} />
        </div>
      </CardContent>
    </Card>
  );
}

function BriefingMiniList({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-md border bg-muted/25 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="[&>svg]:size-3.5">{icon}</span>
        <p className="stoop-label">{title}</p>
      </div>
      <ul className="grid gap-1.5 text-sm leading-5">
        {items.slice(0, 3).map((item) => (
          <li className="text-muted-foreground" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
