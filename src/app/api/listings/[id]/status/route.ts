import { isListingStatus, updateListingStatus } from "@/lib/listing-repository";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json();
  const status = typeof body.status === "string" ? body.status : null;

  if (!status || !isListingStatus(status)) {
    return Response.json({ error: "A supported listing status is required." }, { status: 400 });
  }

  const listing = updateListingStatus(id, status);

  if (!listing) {
    return Response.json({ error: "Listing not found." }, { status: 404 });
  }

  return Response.json({ listing });
}
