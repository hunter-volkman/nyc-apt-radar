import { DailyBriefing } from "@/components/briefing/daily-briefing";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassPanel } from "@/components/glass/glass-panel";
import { GlassShell } from "@/components/glass/glass-shell";
import { ListingCard } from "@/components/listings/listing-card";
import {
  applicationReadiness,
  dailyBrief,
  getNeedsFollowUp,
  getNeedsOutreach,
  getRecentlyKilled,
  getTopCandidates,
  getToursWithListings,
  searchProfile,
} from "@/lib/demo-data";
import { formatDateTimeLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export default function TodayPage() {
  const topCandidates = getTopCandidates(4);
  const needsOutreach = getNeedsOutreach();
  const needsFollowUp = getNeedsFollowUp();
  const scheduledTours = getToursWithListings().filter(({ listing }) => listing.status === "tour_scheduled");
  const recentlyKilled = getRecentlyKilled();
  const readyCount = applicationReadiness.filter((item) => item.ready).length;

  return (
    <GlassShell
      active="today"
      eyebrow="Today"
      title="What should Hunter do next?"
      subtitle="A ranked local dashboard for apartment decisions, follow-ups, tours, and application readiness."
      action={
        <>
          <GlassButton href="/inbox" variant="primary">Capture Listing</GlassButton>
          <GlassButton href="/board">Open Board</GlassButton>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="grid gap-5">
          <section>
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="fine-label">Top candidates</p>
                <h2 className="mt-2 text-2xl font-black text-white">Ranked by urgency and fit</h2>
              </div>
              <GlassButton href="/board" size="sm" variant="ghost">Board</GlassButton>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {topCandidates.map(({ listing, evaluation }) => (
                <ListingCard evaluation={evaluation} key={listing.id} listing={listing} />
              ))}
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <ActionQueue title="Needs outreach" items={needsOutreach.map((listing) => `${listing.title}: ${listing.nextAction}`)} />
            <ActionQueue title="Needs follow-up" items={needsFollowUp.map((listing) => `${listing.title}: ${listing.nextAction}`)} />
          </div>

          <GlassPanel>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="fine-label">Scheduled tours</p>
                <h2 className="mt-2 text-2xl font-black text-white">Tonight decides Crown Heights</h2>
              </div>
              <GlassButton href="/tours" size="sm">Tours</GlassButton>
            </div>
            <div className="mt-5 grid gap-3">
              {scheduledTours.map(({ tour, listing }) => (
                <div className="rounded-2xl border border-white/10 bg-black/18 p-4" key={tour.id}>
                  <p className="text-sm font-bold text-white">{listing.title}</p>
                  <p className="mt-1 text-sm text-white/62">{formatDateTimeLabel(tour.startsAt)}</p>
                  <p className="mt-3 text-sm leading-6 text-white/76">{tour.notes}</p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        <aside className="grid content-start gap-5">
          <DailyBriefing brief={dailyBrief} />

          <GlassPanel>
            <p className="fine-label">Search profile</p>
            <h2 className="mt-2 text-2xl font-black text-white">{searchProfile.name}</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <MiniMetric label="Max rent" value={formatMoney(searchProfile.maxRentMonthly)} />
              <MiniMetric label="Tolerance" value={formatMoney(searchProfile.budgetToleranceMonthly)} />
              <MiniMetric label="Move-in" value="Jun 24" />
              <MiniMetric label="Bedroom" value="1-2" />
            </div>
          </GlassPanel>

          <GlassPanel>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="fine-label">Application readiness</p>
                <h2 className="mt-2 text-2xl font-black text-white">
                  {readyCount}/{applicationReadiness.length} ready
                </h2>
              </div>
              <span className="risk-pill risk-medium">2 blockers</span>
            </div>
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

          <GlassPanel variant="danger">
            <p className="fine-label">Recently killed</p>
            <div className="mt-4 grid gap-3">
              {recentlyKilled.map((listing) => (
                <div className="rounded-2xl border border-white/10 bg-black/18 p-4" key={listing.id}>
                  <p className="text-sm font-bold text-white">{listing.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/68">{listing.mainRisk}</p>
                </div>
              ))}
            </div>
          </GlassPanel>
        </aside>
      </div>
    </GlassShell>
  );
}

function ActionQueue({ title, items }: { title: string; items: string[] }) {
  return (
    <GlassPanel>
      <p className="fine-label">{title}</p>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <div className="rounded-2xl border border-white/10 bg-black/18 p-4 text-sm font-semibold leading-6 text-white/78" key={item}>
            {item}
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <p className="fine-label">{label}</p>
      <p className="mt-2 font-black text-white">{value}</p>
    </div>
  );
}
