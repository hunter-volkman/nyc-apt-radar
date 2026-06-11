import { FileText, Save, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { createListingFromReview } from "@/app/actions/listings";
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

export function CaptureListingPanel() {
  return (
    <form action={createListingFromReview} className="grid gap-5 lg:grid-cols-[1fr_0.92fr]">
      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="stoop-label">Step 1</p>
              <CardTitle className="mt-1 text-xl font-semibold">Capture raw material</CardTitle>
            </div>
            <Button disabled type="button" variant="secondary">
              <FileText />
              Parse Listing Stub
            </Button>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          <Field label="Listing web address">
            <Input
              className="h-10"
              defaultValue="https://example.com/fort-greene-garden-1br"
              name="sourceUrl"
              placeholder="https://..."
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
                  defaultValue="Fort Greene 1BR near Lafayette. Garden-facing, dishwasher, laundry in building. $3,650, June 20. Fee language says owner may cover."
                  name="listingText"
                />
              </Field>
            </TabsContent>
            <TabsContent className="mt-3" value="broker">
              <Field label="Broker email or message">
                <Textarea
                  className="min-h-40 resize-y"
                  defaultValue="Hi Hunter, this is available for a fast June move-in. Owner may cover the fee. I can show it today after 4 PM."
                  name="brokerMessage"
                />
              </Field>
            </TabsContent>
          </Tabs>

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
              <Button type="submit">
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
              <Input className="h-10" defaultValue="Garden-facing 1BR near Lafayette Avenue" name="title" />
            </Field>
            <Field label="Address">
              <Input className="h-10" defaultValue="238 Adelphi Street, Brooklyn, NY" name="address" />
            </Field>
            <Field label="Rent">
              <Input className="h-10" defaultValue="$3,650" name="rentMonthly" />
            </Field>
            <Field label="Neighborhood">
              <Input className="h-10" defaultValue="Fort Greene" name="neighborhood" />
            </Field>
            <Field label="Borough">
              <Input className="h-10" defaultValue="Brooklyn" name="borough" />
            </Field>
            <Field label="Available">
              <Input className="h-10" defaultValue="June 20" name="availableDate" />
            </Field>
            <Field label="Bedrooms">
              <Input className="h-10" defaultValue="1" name="bedrooms" />
            </Field>
            <Field label="Bathrooms">
              <Input className="h-10" defaultValue="1" name="bathrooms" />
            </Field>
          </div>

          <Field label="Fees">
            <Textarea
              className="min-h-20 resize-y"
              defaultValue="Owner-paid fee claimed, needs written confirmation"
              name="fees"
            />
          </Field>
          <Field label="Open questions">
            <Textarea
              className="min-h-20 resize-y"
              defaultValue="Is the broker fee fully owner-paid? Can applications be reviewed same day?"
              name="openQuestions"
            />
          </Field>
          <Field label="Notes">
            <Textarea
              className="min-h-24 resize-y"
              defaultValue="Saved from Inbox review. Confirm fee language before outreach."
              name="personalNotes"
            />
          </Field>
        </CardContent>
      </Card>
    </form>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="stoop-label">{label}</span>
      {children}
    </label>
  );
}
