"use client";

import { AlertTriangle, CheckCircle2, FileText, Loader2, Save, Upload } from "lucide-react";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { createListingFromReview } from "@/app/actions/listings";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Confidence, ParsedListing } from "@/lib/types";

type ReviewDraft = {
  title: string;
  address: string;
  unit: string;
  rentMonthly: string;
  netEffectiveRent: string;
  neighborhood: string;
  borough: string;
  availableDate: string;
  bedrooms: string;
  bathrooms: string;
  squareFeet: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  amenities: string;
  fees: string;
  redFlags: string;
  openQuestions: string;
  personalNotes: string;
};

const emptyReviewDraft: ReviewDraft = {
  title: "",
  address: "",
  unit: "",
  rentMonthly: "",
  netEffectiveRent: "",
  neighborhood: "",
  borough: "",
  availableDate: "",
  bedrooms: "",
  bathrooms: "",
  squareFeet: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  amenities: "",
  fees: "",
  redFlags: "",
  openQuestions: "",
  personalNotes: "",
};

export function CaptureListingPanel() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [listingText, setListingText] = useState("");
  const [brokerMessage, setBrokerMessage] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [review, setReview] = useState<ReviewDraft>(emptyReviewDraft);
  const [parsedListing, setParsedListing] = useState<ParsedListing | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const canParse = useMemo(
    () => [sourceUrl, listingText, brokerMessage, manualNotes].some((value) => value.trim()),
    [brokerMessage, listingText, manualNotes, sourceUrl],
  );

  async function handleParse() {
    setIsParsing(true);
    setParseError(null);

    try {
      const response = await fetch("/api/listings/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceUrl,
          listingText,
          brokerMessage,
          manualNotes,
        }),
      });
      const body = (await response.json()) as { parsed?: ParsedListing; error?: string };

      if (!response.ok || !body.parsed) {
        throw new Error(body.error ?? "Unable to parse listing.");
      }

      setParsedListing(body.parsed);
      setReview(parsedListingToReviewDraft(body.parsed));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Unable to parse listing.");
    } finally {
      setIsParsing(false);
    }
  }

  function updateReviewField(field: keyof ReviewDraft) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setReview((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  return (
    <form action={createListingFromReview} className="grid gap-5 lg:grid-cols-[1fr_0.92fr]">
      <input name="listingText" type="hidden" value={listingText} />
      <input name="brokerMessage" type="hidden" value={brokerMessage} />
      <input name="manualNotes" type="hidden" value={manualNotes} />
      <input name="parserMode" type="hidden" value={parsedListing?.parserMode ?? ""} />

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="stoop-label">Step 1</p>
              <CardTitle className="mt-1 text-xl font-semibold">Capture raw material</CardTitle>
            </div>
            <Button disabled={!canParse || isParsing} onClick={handleParse} type="button" variant="secondary">
              {isParsing ? <Loader2 className="animate-spin" /> : <FileText />}
              {isParsing ? "Parsing" : "Parse Listing"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          <Field label="Listing web address">
            <Input
              className="h-10"
              name="sourceUrl"
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://..."
              value={sourceUrl}
            />
          </Field>

          <Tabs defaultValue="listing">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="listing">Listing Text</TabsTrigger>
              <TabsTrigger value="broker">Broker Message</TabsTrigger>
            </TabsList>
            <TabsContent className="mt-3" value="listing">
              <Field label="Pasted listing text">
                <Textarea
                  className="min-h-40 resize-y"
                  onChange={(event) => setListingText(event.target.value)}
                  placeholder="Paste the listing body, broker blurb, or building details."
                  value={listingText}
                />
              </Field>
            </TabsContent>
            <TabsContent className="mt-3" value="broker">
              <Field label="Broker email or message">
                <Textarea
                  className="min-h-40 resize-y"
                  onChange={(event) => setBrokerMessage(event.target.value)}
                  placeholder="Paste the email, text message, or DM."
                  value={brokerMessage}
                />
              </Field>
            </TabsContent>
          </Tabs>

          <Field label="Manual notes">
            <Textarea
              className="min-h-20 resize-y"
              onChange={(event) => setManualNotes(event.target.value)}
              placeholder="Add context you already know."
              value={manualNotes}
            />
          </Field>

          <ParseStatus error={parseError} parsed={parsedListing} />

          <Field label="Screenshot upload">
            <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <span>Future feature</span>
              <Upload className="size-4" />
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-primary/20 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="stoop-label">Step 2</p>
              <CardTitle className="mt-1 text-xl font-semibold">Review and save candidate</CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              {parsedListing ? (
                <>
                  <Badge className="rounded-md capitalize" variant="outline">
                    {parsedListing.parserMode}
                  </Badge>
                  <Badge className="rounded-md capitalize" variant={confidenceVariant(parsedListing.confidence)}>
                    {parsedListing.confidence}
                  </Badge>
                </>
              ) : null}
              <Button disabled={!review.title.trim()} type="submit">
                <Save />
                Save Candidate
              </Button>
              <Button disabled type="button" variant="secondary">
                Draft Storage Stub
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <Input className="h-10" name="title" onChange={updateReviewField("title")} value={review.title} />
            </Field>
            <Field label="Address">
              <Input className="h-10" name="address" onChange={updateReviewField("address")} value={review.address} />
            </Field>
            <Field label="Unit">
              <Input className="h-10" name="unit" onChange={updateReviewField("unit")} value={review.unit} />
            </Field>
            <Field label="Rent">
              <Input className="h-10" name="rentMonthly" onChange={updateReviewField("rentMonthly")} value={review.rentMonthly} />
            </Field>
            <Field label="Net effective rent">
              <Input
                className="h-10"
                name="netEffectiveRent"
                onChange={updateReviewField("netEffectiveRent")}
                value={review.netEffectiveRent}
              />
            </Field>
            <Field label="Neighborhood">
              <Input
                className="h-10"
                name="neighborhood"
                onChange={updateReviewField("neighborhood")}
                value={review.neighborhood}
              />
            </Field>
            <Field label="Borough">
              <Input className="h-10" name="borough" onChange={updateReviewField("borough")} value={review.borough} />
            </Field>
            <Field label="Available">
              <Input
                className="h-10"
                name="availableDate"
                onChange={updateReviewField("availableDate")}
                placeholder="YYYY-MM-DD"
                value={review.availableDate}
              />
            </Field>
            <Field label="Bedrooms">
              <Input className="h-10" name="bedrooms" onChange={updateReviewField("bedrooms")} value={review.bedrooms} />
            </Field>
            <Field label="Bathrooms">
              <Input className="h-10" name="bathrooms" onChange={updateReviewField("bathrooms")} value={review.bathrooms} />
            </Field>
            <Field label="Square feet">
              <Input
                className="h-10"
                name="squareFeet"
                onChange={updateReviewField("squareFeet")}
                value={review.squareFeet}
              />
            </Field>
            <Field label="Contact name">
              <Input
                className="h-10"
                name="contactName"
                onChange={updateReviewField("contactName")}
                value={review.contactName}
              />
            </Field>
            <Field label="Contact email">
              <Input
                className="h-10"
                name="contactEmail"
                onChange={updateReviewField("contactEmail")}
                value={review.contactEmail}
              />
            </Field>
            <Field label="Contact phone">
              <Input
                className="h-10"
                name="contactPhone"
                onChange={updateReviewField("contactPhone")}
                value={review.contactPhone}
              />
            </Field>
          </div>

          <Field label="Amenities">
            <Textarea
              className="min-h-20 resize-y"
              name="amenities"
              onChange={updateReviewField("amenities")}
              value={review.amenities}
            />
          </Field>
          <Field label="Fees">
            <Textarea
              className="min-h-20 resize-y"
              name="fees"
              onChange={updateReviewField("fees")}
              value={review.fees}
            />
          </Field>
          <Field label="Red flags">
            <Textarea
              className="min-h-20 resize-y"
              name="redFlags"
              onChange={updateReviewField("redFlags")}
              value={review.redFlags}
            />
          </Field>
          <Field label="Open questions">
            <Textarea
              className="min-h-20 resize-y"
              name="openQuestions"
              onChange={updateReviewField("openQuestions")}
              value={review.openQuestions}
            />
          </Field>
          <Field label="Notes">
            <Textarea
              className="min-h-24 resize-y"
              name="personalNotes"
              onChange={updateReviewField("personalNotes")}
              value={review.personalNotes}
            />
          </Field>
        </CardContent>
      </Card>
    </form>
  );
}

function ParseStatus({ error, parsed }: { error: string | null; parsed: ParsedListing | null }) {
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
        <AlertTriangle className="mt-0.5 size-4" />
        <span>{error}</span>
      </div>
    );
  }

  if (parsed) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/35 p-3 text-sm">
        <CheckCircle2 className="size-4 text-emerald-700" />
        <span className="font-medium">Parsed</span>
        <Badge className="rounded-md capitalize" variant="outline">
          {parsed.parserMode}
        </Badge>
        <Badge className="rounded-md capitalize" variant={confidenceVariant(parsed.confidence)}>
          {parsed.confidence}
        </Badge>
        <span className="text-muted-foreground">
          {parsed.openQuestions.length} open questions, {parsed.redFlags.length} red flags
        </span>
      </div>
    );
  }

  return null;
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="stoop-label">{label}</span>
      {children}
    </label>
  );
}

function parsedListingToReviewDraft(parsed: ParsedListing): ReviewDraft {
  const listing = parsed.listing;

  return {
    title: listing.title,
    address: listing.address ?? "",
    unit: listing.unit ?? "",
    rentMonthly: formatFormNumber(listing.rentMonthly),
    netEffectiveRent: formatFormNumber(listing.netEffectiveRent),
    neighborhood: listing.neighborhood ?? "",
    borough: listing.borough ?? "",
    availableDate: listing.availableDate ?? "",
    bedrooms: formatFormNumber(listing.bedrooms),
    bathrooms: formatFormNumber(listing.bathrooms),
    squareFeet: formatFormNumber(listing.squareFeet),
    contactName: listing.contactName ?? "",
    contactEmail: listing.contactEmail ?? "",
    contactPhone: listing.contactPhone ?? "",
    amenities: listing.amenities.join("\n"),
    fees: parsed.fees.join("\n"),
    redFlags: parsed.redFlags.join("\n"),
    openQuestions: parsed.openQuestions.join("\n"),
    personalNotes: listing.personalNotes ?? "Saved from Inbox parser review.",
  };
}

function formatFormNumber(value: number | null) {
  return value === null ? "" : String(value);
}

function confidenceVariant(confidence: Confidence) {
  if (confidence === "high") {
    return "default";
  }

  if (confidence === "medium") {
    return "secondary";
  }

  return "destructive";
}
