import type { Listing } from "./listings";

export function rankListings(listings: Listing[]) {
  return [...listings].sort((left, right) => {
    if (left.status === "rejected" && right.status !== "rejected") {
      return 1;
    }

    if (right.status === "rejected" && left.status !== "rejected") {
      return -1;
    }

    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
  });
}

export function nextActionForListing(listing: Listing) {
  if (listing.status === "rejected") {
    return "No action.";
  }

  if (listing.status === "scheduled") {
    return listing.appointmentAt ? "Attend showing and verify fee, pet policy, and apartment facts." : "Confirm viewing time.";
  }

  if (listing.status === "viewed") {
    return listing.score >= 78 ? "Decide whether to apply." : "Reject unless a missing fact improves the score.";
  }

  if (listing.status === "applied") {
    return "Track response and keep backup leads moving.";
  }

  if (listing.status === "contacted") {
    return "Follow up with concrete viewing windows.";
  }

  if (listing.status === "interested") {
    return "Review and send the outreach draft manually.";
  }

  return listing.score >= 78 ? "Mark interested and draft outreach." : "Resolve missing facts or reject.";
}
