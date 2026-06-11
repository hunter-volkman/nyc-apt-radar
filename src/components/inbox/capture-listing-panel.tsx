import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput, GlassTextarea } from "@/components/glass/glass-input";
import { GlassPanel } from "@/components/glass/glass-panel";

export function CaptureListingPanel() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.92fr]">
      <GlassPanel className="grid gap-5">
        <div>
          <p className="fine-label">Inbox</p>
          <h2 className="mt-2 text-2xl font-black text-white">Capture raw listing material</h2>
        </div>

        <GlassInput label="Listing web address" placeholder="https://..." defaultValue="https://example.com/fort-greene-garden-1br" />
        <GlassTextarea
          label="Pasted listing text"
          defaultValue="Fort Greene 1BR near Lafayette. Garden-facing, dishwasher, laundry in building. $3,650, June 20. Fee language says owner may cover."
        />
        <GlassTextarea
          label="Broker email or message"
          defaultValue="Hi Hunter, this is available for a fast June move-in. Owner may cover the fee. I can show it today after 4 PM."
        />
        <GlassInput label="Screenshot upload" disabled value="Future feature" />

        <div className="flex flex-wrap gap-3">
          <GlassButton variant="primary">Parse Listing</GlassButton>
          <GlassButton variant="ghost">Manual Entry</GlassButton>
        </div>
      </GlassPanel>

      <GlassPanel variant="strong" className="grid gap-5">
        <div>
          <p className="fine-label">Editable review</p>
          <h2 className="mt-2 text-2xl font-black text-white">Parsed field preview</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <GlassInput label="Title" defaultValue="Garden-facing 1BR near Lafayette Avenue" />
          <GlassInput label="Rent" defaultValue="$3,650" />
          <GlassInput label="Neighborhood" defaultValue="Fort Greene" />
          <GlassInput label="Available" defaultValue="June 20" />
          <GlassInput label="Bedrooms" defaultValue="1" />
          <GlassInput label="Bathrooms" defaultValue="1" />
        </div>

        <GlassTextarea label="Fees" defaultValue="Owner-paid fee claimed, needs written confirmation" />
        <GlassTextarea label="Open questions" defaultValue="Is the broker fee fully owner-paid? Can applications be reviewed same day?" />

        <div className="flex flex-wrap gap-3">
          <GlassButton variant="primary">Save Candidate</GlassButton>
          <GlassButton>Keep Draft</GlassButton>
        </div>
      </GlassPanel>
    </div>
  );
}
