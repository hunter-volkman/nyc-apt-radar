import { createListing, listListings } from "@/lib/listing-repository";
import { parseListingDraft } from "@/lib/listing-input";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ listings: listListings() });
}

export async function POST(request: Request) {
  try {
    const listing = createListing(parseListingDraft(await request.json()));
    return Response.json({ listing }, { status: 201 });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save listing.";
}
