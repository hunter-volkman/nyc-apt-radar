import { ArrowLeft, Radar } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export default function ListingNotFound() {
  return (
    <AppShell
      active="board"
      eyebrow="Listing Detail"
      title="Listing not found"
      subtitle="This ID does not match a real local listing."
      action={
        <>
          <Button asChild size="sm" variant="outline">
            <Link href="/board">
              <ArrowLeft />
              Board
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/radar">
              <Radar />
              Radar
            </Link>
          </Button>
        </>
      }
    >
      <Card className="rounded-lg border-dashed shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <p className="text-sm leading-6 text-muted-foreground">
            No saved listing exists for this URL. Return to Radar or the board.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
