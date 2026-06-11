import { GlassPanel } from "@/components/glass/glass-panel";
import { GlassShell } from "@/components/glass/glass-shell";
import { TourChecklist } from "@/components/tours/tour-checklist";
import { applicationReadiness, getToursWithListings } from "@/lib/demo-data";

export default function ToursPage() {
  const tours = getToursWithListings();

  return (
    <GlassShell
      active="tours"
      eyebrow="Tours"
      title="Tour like the decision depends on it."
      subtitle="Track the physical checks that listing photos tend to hide: noise, light, smell, pressure, signal, laundry, trash, packages, street feel, and broker answers."
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_0.42fr]">
        <div className="grid gap-5">
          {tours.map(({ listing, tour }) => (
            <TourChecklist key={tour.id} listing={listing} tour={tour} />
          ))}
        </div>

        <GlassPanel className="content-start">
          <p className="fine-label">Application readiness</p>
          <h2 className="mt-2 text-2xl font-black text-white">Readiness only, no file storage</h2>
          <div className="mt-5 grid gap-2">
            {applicationReadiness.map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/18 p-3" key={item.id}>
                <span className="text-sm font-semibold text-white/78">{item.label}</span>
                <span className={item.ready ? "risk-pill risk-low" : item.blocking ? "risk-pill risk-high" : "risk-pill risk-medium"}>
                  {item.ready ? "Ready" : item.blocking ? "Blocking" : "Later"}
                </span>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </GlassShell>
  );
}
