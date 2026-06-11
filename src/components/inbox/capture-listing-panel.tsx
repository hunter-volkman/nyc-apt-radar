import { createListingFromReview } from "@/app/actions/listings";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassInput, GlassTextarea } from "@/components/glass/glass-input";
import { GlassPanel } from "@/components/glass/glass-panel";

export function CaptureListingPanel() {
  return (
    <form action={createListingFromReview} className="grid gap-5 lg:grid-cols-[1fr_0.92fr]">
      <GlassPanel className="grid gap-5">
        <div>
          <p className="fine-label">Inbox</p>
          <h2 className="mt-2 text-2xl font-black text-white">Capture raw listing material</h2>
        </div>

        <GlassInput label="Listing web address" name="sourceUrl" placeholder="https://..." defaultValue="https://example.com/fort-greene-garden-1br" />
        <GlassTextarea
          label="Pasted listing text"
          name="listingText"
          defaultValue="Fort Greene 1BR near Lafayette. Garden-facing, dishwasher, laundry in building. $3,650, June 20. Fee language says owner may cover."
        />
        <GlassTextarea
          label="Broker email or message"
          name="brokerMessage"
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
          <GlassInput label="Title" name="title" defaultValue="Garden-facing 1BR near Lafayette Avenue" />
          <GlassInput label="Rent" name="rentMonthly" defaultValue="$3,650" />
          <GlassInput label="Neighborhood" name="neighborhood" defaultValue="Fort Greene" />
          <GlassInput label="Borough" name="borough" defaultValue="Brooklyn" />
          <GlassInput label="Available" name="availableDate" defaultValue="June 20" />
          <GlassInput label="Bedrooms" name="bedrooms" defaultValue="1" />
          <GlassInput label="Bathrooms" name="bathrooms" defaultValue="1" />
        </div>

        <GlassTextarea label="Fees" name="fees" defaultValue="Owner-paid fee claimed, needs written confirmation" />
        <GlassTextarea label="Open questions" name="openQuestions" defaultValue="Is the broker fee fully owner-paid? Can applications be reviewed same day?" />
        <GlassTextarea label="Notes" name="personalNotes" defaultValue="Saved from Inbox review. Confirm fee language before outreach." />

        <div className="flex flex-wrap gap-3">
          <GlassButton type="submit" variant="primary">Save Candidate</GlassButton>
          <GlassButton>Keep Draft</GlassButton>
        </div>
      </GlassPanel>
    </form>
  );
}
