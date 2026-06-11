import { localDatabasePath } from "../src/db/client";
import { listings } from "../src/lib/demo-data";
import { replaceListings } from "../src/lib/listing-repository";

const count = replaceListings(listings);

console.log(`Seeded ${count} listings into ${localDatabasePath}`);
