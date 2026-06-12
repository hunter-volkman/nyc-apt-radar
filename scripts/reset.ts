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
console.log("Run npm run discover to ingest data/source-events.");
