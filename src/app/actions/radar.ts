"use server";

import { revalidatePath } from "next/cache";
import { isListingStatus, updateListingStatus } from "@/lib/listing-repository";
import {
  importSourceEvent,
  runRadarOnce,
} from "@/lib/radar";

export async function importSourceEventFromForm(formData: FormData) {
  const result = importSourceEvent({
    sourceName: readFormString(formData, "sourceName"),
    sourceUrl: readFormString(formData, "sourceUrl"),
    rawText: readRequiredFormString(formData, "rawText"),
  });

  await runRadarOnce({
    runType: "manual_import",
    eventsImported: 1,
  });

  revalidateRadarViews(result.event.listingId);
}

export async function updateRadarListingStatusFromForm(formData: FormData) {
  const id = readRequiredFormString(formData, "id");
  const status = readRequiredFormString(formData, "status");

  if (!isListingStatus(status)) {
    throw new Error(`Unsupported listing status: ${status}`);
  }

  const listing = updateListingStatus(id, status);
  revalidateRadarViews(listing?.id ?? id);
}

function revalidateRadarViews(id: string | null = null) {
  revalidatePath("/");
  revalidatePath("/radar");
  revalidatePath("/board");
  revalidatePath("/inbox");

  if (id) {
    revalidatePath(`/listings/${id}`);
  }
}

function readRequiredFormString(formData: FormData, key: string) {
  const value = readFormString(formData, key);

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
