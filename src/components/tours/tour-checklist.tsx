import { GlassPanel } from "@/components/glass/glass-panel";
import { formatDateTimeLabel } from "@/lib/dates";
import type { DemoListing, Tour } from "@/lib/types";

export function TourChecklist({ listing, tour }: { listing: DemoListing; tour: Tour }) {
  const entries = Object.entries(tour.checklist);
  const complete = entries.filter(([, checked]) => checked).length;

  return (
    <GlassPanel as="article" className="grid gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="fine-label">{formatDateTimeLabel(tour.startsAt)}</p>
          <h2 className="mt-2 text-2xl font-black text-white">{listing.title}</h2>
          <p className="mt-1 text-sm text-white/62">
            {listing.neighborhood}, {listing.borough}
          </p>
        </div>
        <span className="risk-pill risk-medium">
          {complete}/{entries.length} checked
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {entries.map(([item, checked]) => (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/18 p-3" key={item}>
            <span className={checked ? "grid h-5 w-5 place-items-center rounded-full bg-[var(--stoop-green)] text-xs font-black text-black" : "h-5 w-5 rounded-full border border-white/24"} />
            <span className="text-sm font-semibold text-white/78">{item}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
        <p className="fine-label">Post-tour verdict</p>
        <p className="mt-2 text-sm font-semibold capitalize text-white">{tour.verdict}</p>
        {tour.notes ? <p className="mt-2 text-sm leading-6 text-white/68">{tour.notes}</p> : null}
      </div>
    </GlassPanel>
  );
}
