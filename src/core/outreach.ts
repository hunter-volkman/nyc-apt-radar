import type { Listing } from "./listings";
import type { PreferenceProfile } from "./preferences";

export function generateOutreachDraft(listing: Listing, profile: PreferenceProfile) {
  const greeting = listing.contactName ? `Hi ${listing.contactName},` : "Hi,";
  const listingName = listing.address ?? listing.title;
  const lines = [
    greeting,
    "",
    `I am interested in ${listingName}. Is it still available?`,
    viewingLine(listing),
    profile.targetMoveIn ? `My target move-in timing is around ${profile.targetMoveIn}.` : null,
    petLine(listing, profile),
    listing.feeStatus === "unknown" ? "Could you also confirm whether there is any broker fee or other move-in fee?" : null,
    "",
    "Best,",
    "[Your name]",
  ];

  return lines.filter((line) => line !== null).join("\n");
}

function viewingLine(listing: Listing) {
  if (listing.appointmentAt) {
    return `I have ${formatAppointment(listing.appointmentAt)} on my calendar. Please confirm that viewing time still works.`;
  }

  return "Could you share the earliest viewing times available?";
}

function petLine(listing: Listing, profile: PreferenceProfile) {
  if (!profile.petRequirements.cats && !profile.petRequirements.dogs) {
    return null;
  }

  if (listing.pets === "unknown") {
    return "I also need to confirm the pet policy, especially cats.";
  }

  if (listing.pets === "cats_allowed" || listing.pets === "cats_and_dogs_allowed") {
    return "I would be bringing a cat.";
  }

  return null;
}

function formatAppointment(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "the scheduled appointment";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(date);
}
