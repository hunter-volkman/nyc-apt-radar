import { AppShell } from "@/components/layout/app-shell";
import { TourChecklist } from "@/components/tours/tour-checklist";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { applicationReadiness } from "@/lib/demo-data";
import { getToursWithListings } from "@/lib/listing-view-models";

export default function ToursPage() {
  const tours = getToursWithListings();
  const readyCount = applicationReadiness.filter((item) => item.ready).length;
  const gaps = applicationReadiness.filter((item) => !item.ready);
  const percent = Math.round((readyCount / applicationReadiness.length) * 100);

  return (
    <AppShell
      active="tours"
      eyebrow="Tours"
      title="Tour like the decision depends on it."
      subtitle="Time, address, checklist, risk, and verdict stay visible for phone use."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_0.42fr]">
        <div className="grid gap-4">
          {tours.map(({ listing, tour }) => (
            <TourChecklist key={tour.id} listing={listing} tour={tour} />
          ))}
        </div>

        <Card className="h-fit rounded-lg shadow-sm">
          <CardHeader>
            <p className="stoop-label">Application readiness</p>
            <CardTitle className="text-lg font-semibold">
              {readyCount}/{applicationReadiness.length} ready
            </CardTitle>
            <Progress value={percent} />
          </CardHeader>
          <CardContent className="grid gap-2">
            {gaps.map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3" key={item.id}>
                <span className="text-sm font-medium">{item.label}</span>
                <span className={item.blocking ? "text-sm font-semibold text-red-700" : "text-sm font-semibold text-amber-800"}>
                  {item.blocking ? "Blocking" : "Later"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
