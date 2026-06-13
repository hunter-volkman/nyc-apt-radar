import path from "node:path";

export type SystemdUnitOptions = {
  cwd: string;
  unitName?: string;
  user?: string;
  group?: string;
  intervalMinutes?: number;
  environmentFile?: string;
  npmScript?: string;
  path?: string;
};

const defaultUnitName = "nyc-apt-radar";
const defaultUnitDirectory = "/etc/systemd/system";
const defaultPath = "/usr/local/bin:/usr/bin:/bin";
const unitNamePattern = /^[A-Za-z0-9][A-Za-z0-9_.@-]{0,127}$/;

export function defaultSystemdServicePath(unitName = defaultUnitName) {
  return path.join(defaultUnitDirectory, `${validateSystemdUnitName(unitName)}.service`);
}

export function defaultSystemdTimerPath(unitName = defaultUnitName) {
  return path.join(defaultUnitDirectory, `${validateSystemdUnitName(unitName)}.timer`);
}

export function buildSystemdService(options: SystemdUnitOptions) {
  if (options.unitName) {
    validateSystemdUnitName(options.unitName);
  }

  const user = options.user ?? "nyc-apt-radar";
  const environmentFile = options.environmentFile ?? path.join(options.cwd, ".env");
  const npmScript = options.npmScript ?? "agent:run";
  const servicePath = options.path ?? defaultPath;
  const lines = [
    "[Unit]",
    "Description=NYC Apt Radar agent pass",
    "Wants=network-online.target",
    "After=network-online.target",
    "",
    "[Service]",
    "Type=oneshot",
    `WorkingDirectory=${options.cwd}`,
    `User=${user}`,
  ];

  if (options.group) {
    lines.push(`Group=${options.group}`);
  }

  lines.push(
    "Environment=NODE_ENV=production",
    `Environment=PATH=${servicePath}`,
    `EnvironmentFile=-${environmentFile}`,
    `ExecStart=/usr/bin/env npm run ${npmScript}`,
    "",
  );

  return lines.join("\n");
}

export function buildSystemdTimer(options: SystemdUnitOptions) {
  const unitName = validateSystemdUnitName(options.unitName ?? defaultUnitName);
  const intervalMinutes = Math.max(1, Math.round(options.intervalMinutes ?? 60));

  return [
    "[Unit]",
    `Description=Run NYC Apt Radar every ${intervalMinutes} minute${intervalMinutes === 1 ? "" : "s"}`,
    "",
    "[Timer]",
    "OnBootSec=5min",
    `OnUnitActiveSec=${intervalMinutes}min`,
    "AccuracySec=1min",
    "Persistent=true",
    `Unit=${unitName}.service`,
    "",
    "[Install]",
    "WantedBy=timers.target",
    "",
  ].join("\n");
}

export function validateSystemdUnitName(unitName: string) {
  if (!unitNamePattern.test(unitName) || unitName.includes("..") || unitName.endsWith(".service") || unitName.endsWith(".timer")) {
    throw new Error("Invalid systemd unit name. Use a base name like nyc-apt-radar with only letters, numbers, dots, underscores, dashes, or @.");
  }

  return unitName;
}
