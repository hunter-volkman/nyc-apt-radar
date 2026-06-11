import type { Listing } from "@/lib/types";
import type { ListingRow, NewListingRow } from "@/db/schema";

export function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    rawText: row.rawText,
    title: row.title,
    address: row.address,
    unit: row.unit,
    neighborhood: row.neighborhood,
    borough: row.borough,
    rentMonthly: row.rentMonthly,
    netEffectiveRent: row.netEffectiveRent,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    squareFeet: row.squareFeet,
    availableDate: row.availableDate,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    status: row.status,
    amenities: row.amenities,
    fees: row.fees,
    redFlags: row.redFlags,
    openQuestions: row.openQuestions,
    personalNotes: row.personalNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listingToRow(listing: Listing): NewListingRow {
  return {
    id: listing.id,
    sourceName: listing.sourceName,
    sourceUrl: listing.sourceUrl,
    rawText: listing.rawText,
    title: listing.title,
    address: listing.address,
    unit: listing.unit,
    neighborhood: listing.neighborhood,
    borough: listing.borough,
    rentMonthly: listing.rentMonthly,
    netEffectiveRent: listing.netEffectiveRent,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    squareFeet: listing.squareFeet,
    availableDate: listing.availableDate,
    contactName: listing.contactName,
    contactEmail: listing.contactEmail,
    contactPhone: listing.contactPhone,
    status: listing.status,
    amenities: listing.amenities,
    fees: listing.fees,
    redFlags: listing.redFlags,
    openQuestions: listing.openQuestions,
    personalNotes: listing.personalNotes,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
  };
}
