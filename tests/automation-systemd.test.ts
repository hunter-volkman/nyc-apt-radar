import { describe, expect, it } from "vitest";
import {
  buildSystemdService,
  buildSystemdTimer,
  defaultSystemdServicePath,
  defaultSystemdTimerPath,
  validateSystemdUnitName,
} from "../src/automation/systemd";

describe("systemd automation", () => {
  it("builds unit paths and timers for valid unit names", () => {
    expect(validateSystemdUnitName("nyc-apt-radar")).toBe("nyc-apt-radar");
    expect(defaultSystemdServicePath("nyc-apt-radar")).toBe("/etc/systemd/system/nyc-apt-radar.service");
    expect(defaultSystemdTimerPath("com.hunter.nyc-apt-radar")).toBe("/etc/systemd/system/com.hunter.nyc-apt-radar.timer");
    expect(buildSystemdTimer({
      cwd: "/srv/nyc-apt-radar",
      unitName: "nyc-apt-radar",
      intervalMinutes: 15,
    })).toContain("Unit=nyc-apt-radar.service");
  });

  it("rejects unsafe unit names before building paths or systemctl arguments", () => {
    for (const unitName of ["../nyc-apt-radar", "nyc/apt-radar", "nyc apt radar", ".hidden", "nyc..apt", "nyc-apt-radar.service", "nyc-apt-radar.timer"]) {
      expect(() => validateSystemdUnitName(unitName)).toThrow(/Invalid systemd unit name/);
      expect(() => defaultSystemdServicePath(unitName)).toThrow(/Invalid systemd unit name/);
      expect(() => defaultSystemdTimerPath(unitName)).toThrow(/Invalid systemd unit name/);
      expect(() => buildSystemdTimer({ cwd: "/srv/nyc-apt-radar", unitName })).toThrow(/Invalid systemd unit name/);
      expect(() => buildSystemdService({ cwd: "/srv/nyc-apt-radar", unitName })).toThrow(/Invalid systemd unit name/);
    }
  });
});
