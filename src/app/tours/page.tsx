import { Inbox } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { TourChecklist } from "@/components/tours/tour-checklist";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getApplicationReadinessSummary } from "@/lib/application-readiness";
import { getTourStatusBundles } from "@/lib/listing-view-models";

export default function ToursPage() {
  const tours = getTourStatusBundles();
  const readiness = getApplicationReadinessSummary();

  return (
    <AppShell
      active="tours"
      eyebrow="Tours"
      title="Tour like the decision depends on it."
      subtitle="Time, address, checklist, risk, and verdict stay visible for phone use."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_0.42fr]">
        <div className="grid gap-4">
          {tours.length ? (
            tours.map(({ listing }) => (
              <TourChecklist key={listing.id} listing={listing} />
            ))
          ) : (
            <Card className="rounded-lg border-dashed shadow-sm">
              <CardContent className="grid gap-4 p-4 sm:p-5">
                <div>
                  <p className="stoop-label">No real tours yet</p>
                  <h2 className="mt-1 text-xl font-semibold">Capture a listing, then move it to tour scheduled.</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    This page only shows listings with real local tour scheduled or toured status.
                    There is no separate tour-time storage yet.
                  </p>
                </div>
                <Button asChild className="w-full sm:w-fit">
                  <Link href="/inbox">
                    <Inbox />
                    Capture listing
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit rounded-lg shadow-sm">
          <CardHeader>
            <p className="stoop-label">Application readiness</p>
            <CardTitle className="text-lg font-semibold">
              {readiness.trackedReadyCount}/{readiness.totalCount} tracked ready
            </CardTitle>
            <Progress value={0} />
          </CardHeader>
          <CardContent className="grid gap-2">
            {readiness.items.map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3" key={item.id}>
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-sm font-semibold text-muted-foreground">
                  {item.requiredForMostApplications ? "Untracked" : "Conditional"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
