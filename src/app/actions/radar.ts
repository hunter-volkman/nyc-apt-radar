"use server";

import { revalidatePath } from "next/cache";
import { isListingStatus, updateListingStatus } from "@/lib/listing-repository";

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
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}
