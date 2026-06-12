import { LayoutDashboard, Radar } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { CandidateBoard } from "@/components/board/candidate-board";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { getBoardColumns } from "@/lib/listing-view-models";

export default async function BoardPage() {
  await connection();
  const columns = getBoardColumns();

  return (
    <AppShell
      active="board"
      eyebrow="Candidate Board"
      title="Move listings through the pipeline."
      subtitle="Every candidate sits in one exact status, with score, risk, next action, and update recency visible."
      action={
        <>
          <Button asChild size="sm">
            <Link href="/radar">
              <Radar />
              Radar
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/">
              <LayoutDashboard />
              Today
            </Link>
          </Button>
        </>
      }
    >
      <CandidateBoard columns={columns} />
    </AppShell>
  );
}
