import "../src/config/env";
import { clearSourceEvents } from "../src/storage/discovery";
import { clearListings } from "../src/storage/listings";
import { clearNotifications } from "../src/storage/notifications";
import { getDatabasePath } from "../src/storage/database";

clearListings();
clearSourceEvents();
clearNotifications();

console.log("Reset local radar database.");
console.log(`Database: ${getDatabasePath()}`);
console.log("Cleared: listings, source events, and notification history.");
console.log("Kept: .env files, preferences, searches, and launchd files.");
console.log("Run npm run agent:run -- --no-notify to check configured StreetEasy searches.");
