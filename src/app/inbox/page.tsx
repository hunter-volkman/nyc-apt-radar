import { AppShell } from "@/components/layout/app-shell";
import { CaptureListingPanel } from "@/components/inbox/capture-listing-panel";

export default function InboxPage() {
  return (
    <AppShell
      active="inbox"
      eyebrow="Fallback Parser"
      title="Parse a one-off listing."
      subtitle="This is a fallback surface. The primary workflow is the Radar loop."
    >
      <CaptureListingPanel />
    </AppShell>
  );
}
