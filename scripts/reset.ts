import "../src/config/env";

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("Refusing to reset local radar data without --yes.");
    console.error("Usage: npm run reset -- --yes [--backup] [--backup=/path/to/backup.sqlite]");
    process.exit(1);
  }

  const [
    { clearSourceEvents },
    { clearListings },
    { clearNotifications },
    { backupDatabase, getDatabasePath },
  ] = await Promise.all([
    import("../src/storage/discovery.js"),
    import("../src/storage/listings.js"),
    import("../src/storage/notifications.js"),
    import("../src/storage/database.js"),
  ]);
  const databasePath = getDatabasePath();
  const backupPath = readBackupPath(databasePath);
  if (backupPath) {
    await backupDatabase(backupPath);
    console.log(`Backup: ${backupPath}`);
  }

  clearListings();
  clearSourceEvents();
  clearNotifications();

  console.log("Reset local radar database.");
  console.log(`Database: ${databasePath}`);
  console.log("Cleared: listings, source events, and notification history.");
  console.log("Kept: .env files, preferences, searches, and launchd files.");
  console.log("Run npm run agent:run -- --no-notify to check configured StreetEasy searches.");
}

function readBackupPath(databasePath: string) {
  const equals = process.argv.find((argument) => argument.startsWith("--backup="));
  if (equals) {
    return equals.slice("--backup=".length);
  }

  if (!process.argv.includes("--backup")) {
    return null;
  }

  return `${databasePath}.backup-${timestampForFilename()}`;
}

function timestampForFilename() {
  return new Date().toISOString().replaceAll(/[:.]/g, "-");
}
