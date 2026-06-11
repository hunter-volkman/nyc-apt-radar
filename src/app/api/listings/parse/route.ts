import { parseListing, parseListingInput } from "@/lib/parser";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const parsed = await parseListing(parseListingInput(await request.json()));
    return Response.json({ parsed });
  } catch (error) {
    return Response.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to parse listing.";
}
