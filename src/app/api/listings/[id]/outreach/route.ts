import { searchProfile } from "@/lib/demo-data";
import { getListing } from "@/lib/listing-repository";
import { draftOutreach, parseOutreachKind } from "@/lib/outreach";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const listing = getListing(id);

    if (!listing) {
      return Response.json({ error: "Listing not found." }, { status: 404 });
    }

    const body = await request.json();
    const kind = parseOutreachKind(readRecord(body).kind);

    if (!kind) {
      return Response.json({ error: "Unsupported outreach kind." }, { status: 400 });
    }

    const draft = await draftOutreach(listing, searchProfile, kind);
    return Response.json({ draft });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to draft outreach.";
}
