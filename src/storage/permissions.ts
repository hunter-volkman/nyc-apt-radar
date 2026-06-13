import fs from "node:fs";
import path from "node:path";

const directoryMode = 0o700;
const fileMode = 0o600;

export function ensureOwnerOnlyDirectory(directoryPath: string) {
  fs.mkdirSync(directoryPath, { recursive: true, mode: directoryMode });
  chmodBestEffort(directoryPath, directoryMode);
}

export function applyOwnerOnlyFilePermissions(filePath: string) {
  chmodBestEffort(filePath, fileMode);
}

export function applySQLiteFilePermissions(databasePath: string) {
  for (const filePath of sqliteFilePaths(databasePath)) {
    if (fs.existsSync(filePath)) {
      applyOwnerOnlyFilePermissions(filePath);
    }
  }
}

export function ensureRuntimeDataPermissions(databasePath: string) {
  ensureOwnerOnlyDirectory(path.dirname(databasePath));
  applySQLiteFilePermissions(databasePath);
}

function sqliteFilePaths(databasePath: string) {
  return [
    databasePath,
    `${databasePath}-wal`,
    `${databasePath}-shm`,
    `${databasePath}-journal`,
  ];
}

function chmodBestEffort(targetPath: string, mode: number) {
  if (process.platform === "win32") {
    return;
  }

  try {
    fs.chmodSync(targetPath, mode);
  } catch {
    // Best-effort hardening only. The app should still run on filesystems that
    // do not support Unix ownership modes.
  }
}
