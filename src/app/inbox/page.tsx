import { GlassShell } from "@/components/glass/glass-shell";
import { CaptureListingPanel } from "@/components/inbox/capture-listing-panel";

export default function InboxPage() {
  return (
    <GlassShell
      active="inbox"
      eyebrow="Inbox and Capture"
      title="Turn raw listing noise into structured candidates."
      subtitle="Paste listing context, review every extracted field, and keep sensitive documents out of the app."
    >
      <CaptureListingPanel />
    </GlassShell>
  );
}
