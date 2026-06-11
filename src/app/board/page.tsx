import { connection } from "next/server";
import { CandidateBoard } from "@/components/board/candidate-board";
import { GlassButton } from "@/components/glass/glass-button";
import { GlassShell } from "@/components/glass/glass-shell";
import { getBoardColumns } from "@/lib/listing-view-models";

export default async function BoardPage() {
  await connection();
  const columns = getBoardColumns();

  return (
    <GlassShell
      active="board"
      eyebrow="Candidate Board"
      title="Move listings through the pipeline."
      subtitle="Every candidate sits in one exact status, with score, risk, next action, and update recency visible."
      action={
        <>
          <GlassButton href="/inbox" variant="primary">Capture Listing</GlassButton>
          <GlassButton href="/">Today</GlassButton>
        </>
      }
    >
      <CandidateBoard columns={columns} />
    </GlassShell>
  );
}
