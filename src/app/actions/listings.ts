"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createListing, deleteListing, isListingStatus, updateListingStatus } from "@/lib/listing-repository";

export async function createListingFromReview(formData: FormData) {
  const listing = createListing({
    sourceName: "Inbox review",
    sourceUrl: readFormString(formData, "sourceUrl"),
    rawText: buildRawText(formData),
    title: readFormString(formData, "title") ?? "Untitled listing",
    neighborhood: readFormString(formData, "neighborhood"),
    borough: readFormString(formData, "borough"),
    rentMonthly: readFormNumber(formData, "rentMonthly"),
    bedrooms: readFormNumber(formData, "bedrooms"),
    bathrooms: readFormNumber(formData, "bathrooms"),
    availableDate: readFormDate(formData, "availableDate"),
    fees: readFormList(formData, "fees"),
    openQuestions: readFormList(formData, "openQuestions"),
    personalNotes: readFormString(formData, "personalNotes"),
    status: "new",
  });

  revalidateListingViews(listing.id);
  redirect(`/listings/${listing.id}`);
}

export async function updateListingStatusFromForm(formData: FormData) {
  const id = readRequiredFormString(formData, "id");
  const status = readRequiredFormString(formData, "status");

  if (!isListingStatus(status)) {
    throw new Error(`Unsupported listing status: ${status}`);
  }

  updateListingStatus(id, status);
  revalidateListingViews(id);
}

export async function deleteListingFromForm(formData: FormData) {
  const id = readRequiredFormString(formData, "id");
  deleteListing(id);
  revalidateListingViews(id);
  redirect("/board");
}

function revalidateListingViews(id: string) {
  revalidatePath("/");
  revalidatePath("/board");
  revalidatePath("/inbox");
  revalidatePath(`/listings/${id}`);
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

function readFormNumber(formData: FormData, key: string) {
  const value = readFormString(formData, key);

  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function readFormDate(formData: FormData, key: string) {
  const value = readFormString(formData, key);

  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = new Date(`${value} ${new Date().getFullYear()}`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

function readFormList(formData: FormData, key: string) {
  return (readFormString(formData, key) ?? "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildRawText(formData: FormData) {
  const listingText = readFormString(formData, "listingText");
  const brokerMessage = readFormString(formData, "brokerMessage");

  return [listingText, brokerMessage].filter(Boolean).join("\n\nBroker message:\n") || null;
}
