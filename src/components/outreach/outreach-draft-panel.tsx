"use client";

import { Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  outreachKindLabels,
  outreachKinds,
} from "@/lib/outreach";
import type { OutreachDraft, OutreachKind } from "@/lib/types";

type DraftResponse = {
  draft?: OutreachDraft;
  error?: string;
};

export function OutreachDraftPanel({
  initialDraft,
  listingId,
}: {
  initialDraft: OutreachDraft;
  listingId: string;
}) {
  const [selectedKind, setSelectedKind] = useState<OutreachKind>(initialDraft.kind);
  const [draft, setDraft] = useState(initialDraft);
  const [subject, setSubject] = useState(initialDraft.subject);
  const [body, setBody] = useState(initialDraft.body);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function generate(kind: OutreachKind) {
    setSelectedKind(kind);
    setMessage(null);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/listings/${listingId}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const payload = (await response.json()) as DraftResponse;

      if (!response.ok || !payload.draft) {
        setMessage(payload.error ?? "Unable to generate draft.");
        return;
      }

      setDraft(payload.draft);
      setSubject(payload.draft.subject);
      setBody(payload.draft.body);
    } catch {
      setMessage("Unable to generate draft.");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setMessage("Draft copied.");
    } catch {
      setMessage("Copy failed. The draft is still editable here.");
    }
  }

  return (
    <Card className="rounded-lg shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="stoop-label">Outreach draft</p>
            <CardTitle className="mt-1 text-lg font-semibold">Draft workspace</CardTitle>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Generate message text only. Nothing is sent, scheduled, stored, or approved here.
            </p>
          </div>
          <Badge className="h-6 rounded-md" variant="secondary">
            {draft.generationMode === "openai" ? "OpenAI assisted" : "Local fallback"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2" aria-label="Outreach draft type">
          {outreachKinds.map((kind) => (
            <Button
              key={kind}
              onClick={() => generate(kind)}
              size="sm"
              type="button"
              variant={selectedKind === kind ? "default" : "outline"}
            >
              {outreachKindLabels[kind]}
            </Button>
          ))}
        </div>

        <div className="grid gap-2">
          <label className="stoop-label" htmlFor="outreach-subject">Subject</label>
          <Input
            id="outreach-subject"
            onChange={(event) => setSubject(event.target.value)}
            value={subject}
          />
        </div>

        <div className="grid gap-2">
          <label className="stoop-label" htmlFor="outreach-body">Draft text</label>
          <Textarea
            className="min-h-44 resize-y leading-6"
            id="outreach-body"
            onChange={(event) => setBody(event.target.value)}
            value={body}
          />
        </div>

        <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm leading-5 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" />
            <span>{draft.safetyNote}</span>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button disabled={isLoading} onClick={() => generate(selectedKind)} size="sm" type="button" variant="outline">
              <RefreshCw />
              Regenerate
            </Button>
            <Button disabled={isLoading || !body.trim()} onClick={copyDraft} size="sm" type="button" variant="outline">
              <Copy />
              Copy
            </Button>
          </div>
        </div>

        {message ? (
          <p className="rounded-md border bg-card p-3 text-sm font-medium text-muted-foreground" role="status">
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
