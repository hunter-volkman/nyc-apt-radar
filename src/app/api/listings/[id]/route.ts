import { deleteListing, getListing, updateListing } from "@/lib/listing-repository";
import { parseListingPatch } from "@/lib/listing-input";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const listing = getListing(id);

  if (!listing) {
    return Response.json({ error: "Listing not found." }, { status: 404 });
  }

  return Response.json({ listing });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const listing = updateListing(id, parseListingPatch(await request.json()));

    if (!listing) {
      return Response.json({ error: "Listing not found." }, { status: 404 });
    }

    return Response.json({ listing });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return PATCH(request, context);
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  deleteListing(id);
  return Response.json({ ok: true });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to update listing.";
}
