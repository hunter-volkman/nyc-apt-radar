import { coordinatesForListing, distanceMiles, walkingMinutes, type Coordinates } from "./geo";
import type { Listing } from "./listings";
import type { PreferenceProfile } from "./preferences";

export type Station = Coordinates & {
  id: string;
  name: string;
  lines: string[];
};

export type CommuteEstimate = {
  targetLabel: string;
  targetAddress: string;
  totalMinutes: number;
  walkToTrainMinutes: number;
  trainMinutes: number;
  walkFromTrainMinutes: number;
  startStation: string;
  endStation: string;
  lines: string[];
  transfers: number;
  confidence: "high" | "medium" | "low";
  summary: string;
};

type Edge = {
  from: string;
  to: string;
  line: string;
  minutes: number;
};

type RouteState = {
  stationId: string;
  line: string | null;
  minutes: number;
  transfers: number;
  path: Array<{ stationId: string; line: string | null }>;
  lines: string[];
};

const transferPenaltyMinutes = 5;

// Small, inspectable subway model for the current search area; replace with GTFS when wider coverage matters.
const stations: Station[] = [
  { id: "bedford-l", name: "Bedford Av", latitude: 40.7177, longitude: -73.9568, lines: ["L"] },
  { id: "lorimer-metropolitan", name: "Lorimer St-Metropolitan Av", latitude: 40.7141, longitude: -73.9503, lines: ["L", "G"] },
  { id: "marcy", name: "Marcy Av", latitude: 40.7084, longitude: -73.9578, lines: ["J", "M", "Z"] },
  { id: "essex", name: "Delancey St-Essex St", latitude: 40.7186, longitude: -73.9881, lines: ["F", "J", "M", "Z"] },
  { id: "first-av", name: "1 Av", latitude: 40.7309, longitude: -73.9817, lines: ["L"] },
  { id: "union-square", name: "14 St-Union Sq", latitude: 40.7347, longitude: -73.9903, lines: ["L", "N", "Q", "R", "W", "4", "5", "6"] },
  { id: "sixth-av-14", name: "14 St-6 Av", latitude: 40.7382, longitude: -73.9962, lines: ["F", "M", "L"] },
  { id: "herald-square", name: "34 St-Herald Sq", latitude: 40.7496, longitude: -73.9879, lines: ["B", "D", "F", "M", "N", "Q", "R", "W"] },
  { id: "penn", name: "34 St-Penn Station", latitude: 40.7506, longitude: -73.9935, lines: ["A", "C", "E", "1", "2", "3"] },
  { id: "times-square", name: "Times Sq-42 St", latitude: 40.7553, longitude: -73.9875, lines: ["1", "2", "3", "N", "Q", "R", "W", "7", "S"] },
  { id: "bryant-park", name: "42 St-Bryant Park", latitude: 40.7542, longitude: -73.9846, lines: ["B", "D", "F", "M", "7"] },
  { id: "grand-central", name: "Grand Central-42 St", latitude: 40.7527, longitude: -73.9772, lines: ["4", "5", "6", "7", "S"] },
  { id: "atlantic", name: "Atlantic Av-Barclays Ctr", latitude: 40.6840, longitude: -73.9777, lines: ["B", "D", "N", "Q", "R", "2", "3", "4", "5"] },
  { id: "clinton-washington-g", name: "Clinton-Washington Avs", latitude: 40.6881, longitude: -73.9668, lines: ["G"] },
  { id: "fulton-g", name: "Fulton St", latitude: 40.6871, longitude: -73.9754, lines: ["G"] },
  { id: "bergen-fg", name: "Bergen St", latitude: 40.6861, longitude: -73.9909, lines: ["F", "G"] },
  { id: "seventh-av-bq", name: "7 Av", latitude: 40.6771, longitude: -73.9723, lines: ["B", "Q"] },
  { id: "union-st-r", name: "Union St", latitude: 40.6773, longitude: -73.9831, lines: ["R"] },
  { id: "astoria-ditmars", name: "Astoria-Ditmars Blvd", latitude: 40.7750, longitude: -73.9120, lines: ["N", "W"] },
  { id: "crown-heights-uticapkwy", name: "Crown Hts-Utica Av", latitude: 40.6689, longitude: -73.9329, lines: ["3", "4"] },
  { id: "seventy-second", name: "72 St", latitude: 40.7787, longitude: -73.9819, lines: ["1", "2", "3"] },
];

const edges: Edge[] = [
  edge("lorimer-metropolitan", "bedford-l", "L", 3),
  edge("bedford-l", "first-av", "L", 5),
  edge("first-av", "union-square", "L", 3),
  edge("union-square", "sixth-av-14", "L", 3),
  edge("marcy", "essex", "J", 6),
  edge("marcy", "essex", "M", 6),
  edge("marcy", "essex", "Z", 6),
  edge("essex", "sixth-av-14", "F", 8),
  edge("essex", "sixth-av-14", "M", 8),
  edge("sixth-av-14", "herald-square", "F", 7),
  edge("sixth-av-14", "herald-square", "M", 7),
  edge("herald-square", "bryant-park", "B", 3),
  edge("herald-square", "bryant-park", "D", 3),
  edge("herald-square", "bryant-park", "F", 3),
  edge("herald-square", "bryant-park", "M", 3),
  edge("penn", "times-square", "1", 2),
  edge("penn", "times-square", "2", 2),
  edge("penn", "times-square", "3", 2),
  edge("times-square", "bryant-park", "7", 2),
  edge("times-square", "grand-central", "S", 4),
  edge("times-square", "herald-square", "N", 2),
  edge("times-square", "herald-square", "Q", 2),
  edge("times-square", "herald-square", "R", 2),
  edge("times-square", "herald-square", "W", 2),
  edge("herald-square", "union-square", "N", 5),
  edge("herald-square", "union-square", "Q", 5),
  edge("herald-square", "union-square", "R", 5),
  edge("herald-square", "union-square", "W", 5),
  edge("union-square", "grand-central", "4", 5),
  edge("union-square", "grand-central", "5", 5),
  edge("union-square", "grand-central", "6", 5),
  edge("atlantic", "herald-square", "B", 18),
  edge("atlantic", "herald-square", "D", 18),
  edge("atlantic", "herald-square", "N", 20),
  edge("atlantic", "herald-square", "Q", 16),
  edge("atlantic", "union-square", "4", 14),
  edge("atlantic", "union-square", "5", 14),
  edge("seventh-av-bq", "atlantic", "B", 4),
  edge("seventh-av-bq", "atlantic", "Q", 4),
  edge("union-st-r", "atlantic", "R", 4),
  edge("clinton-washington-g", "fulton-g", "G", 4),
  edge("fulton-g", "bergen-fg", "G", 4),
  edge("bergen-fg", "sixth-av-14", "F", 15),
  edge("astoria-ditmars", "times-square", "N", 22),
  edge("astoria-ditmars", "times-square", "W", 24),
  edge("crown-heights-uticapkwy", "atlantic", "3", 14),
  edge("crown-heights-uticapkwy", "atlantic", "4", 14),
  edge("seventy-second", "times-square", "1", 8),
  edge("seventy-second", "times-square", "2", 6),
  edge("seventy-second", "times-square", "3", 6),
];

const stationById = new Map(stations.map((station) => [station.id, station]));
const graph = buildGraph(edges);

export function estimateCommutes(listing: Listing, profile: PreferenceProfile): CommuteEstimate[] {
  const origin = coordinatesForListing(listing);

  return profile.commuteTargets.map((target) => {
    if (!origin) {
      return unknownCommute(target.label, target.address);
    }

    return estimateCommute(origin, {
      latitude: target.latitude,
      longitude: target.longitude,
    }, target.label, target.address);
  });
}

export function commuteScore(listing: Listing, profile: PreferenceProfile) {
  const estimates = estimateCommutes(listing, profile);
  const targetScores = estimates.map((estimate, index) => {
    const target = profile.commuteTargets[index];

    if (!target || estimate.confidence === "low") {
      return 8;
    }

    if (estimate.totalMinutes <= target.maxMinutes) {
      return 20;
    }

    if (estimate.totalMinutes <= target.maxMinutes + 10) {
      return 14;
    }

    if (estimate.totalMinutes <= target.maxMinutes + 20) {
      return 8;
    }

    return 3;
  });

  return Math.round(targetScores.reduce((sum, value) => sum + value, 0) / Math.max(1, targetScores.length));
}

export function commuteSummary(listing: Listing, profile: PreferenceProfile) {
  return estimateCommutes(listing, profile).map((estimate) => estimate.summary).join(" | ");
}

function estimateCommute(origin: Coordinates, target: Coordinates, targetLabel: string, targetAddress: string): CommuteEstimate {
  const startCandidates = nearestStations(origin, 4);
  const endCandidates = nearestStations(target, 4);
  let best: CommuteEstimate | null = null;

  for (const start of startCandidates) {
    for (const end of endCandidates) {
      const route = shortestRoute(start.station.id, end.station.id);
      if (!route) {
        continue;
      }

      const walkToTrainMinutes = walkingMinutes(start.distanceMiles);
      const walkFromTrainMinutes = walkingMinutes(end.distanceMiles);
      const totalMinutes = walkToTrainMinutes + route.minutes + walkFromTrainMinutes;
      const estimate: CommuteEstimate = {
        targetLabel,
        targetAddress,
        totalMinutes,
        walkToTrainMinutes,
        trainMinutes: route.minutes,
        walkFromTrainMinutes,
        startStation: start.station.name,
        endStation: end.station.name,
        lines: route.lines,
        transfers: route.transfers,
        confidence: "medium",
        summary: `${targetLabel}: ${totalMinutes} min via ${route.lines.join(" -> ")} from ${start.station.name} to ${end.station.name}; ${walkToTrainMinutes} min walk to train, ${route.transfers} transfer${route.transfers === 1 ? "" : "s"}, ${walkFromTrainMinutes} min walk from train`,
      };

      if (!best || estimate.totalMinutes < best.totalMinutes) {
        best = estimate;
      }
    }
  }

  if (!best) {
    return unknownCommute(targetLabel, targetAddress);
  }

  return best;
}

function shortestRoute(startStationId: string, endStationId: string) {
  if (startStationId === endStationId) {
    const station = stationById.get(startStationId);
    const line = station?.lines[0] ?? "walk";

    return {
      minutes: 0,
      transfers: 0,
      lines: [line],
    };
  }

  const queue: RouteState[] = [{
    stationId: startStationId,
    line: null,
    minutes: 0,
    transfers: 0,
    path: [{ stationId: startStationId, line: null }],
    lines: [],
  }];
  const best = new Map<string, number>();

  while (queue.length) {
    queue.sort((left, right) => left.minutes - right.minutes);
    const current = queue.shift();

    if (!current) {
      break;
    }

    const key = `${current.stationId}:${current.line ?? "start"}`;
    if ((best.get(key) ?? Infinity) <= current.minutes) {
      continue;
    }
    best.set(key, current.minutes);

    if (current.stationId === endStationId) {
      return {
        minutes: current.minutes,
        transfers: current.transfers,
        lines: compactLines(current.lines),
      };
    }

    for (const edge of graph.get(current.stationId) ?? []) {
      const isTransfer = current.line !== null && current.line !== edge.line;
      queue.push({
        stationId: edge.to,
        line: edge.line,
        minutes: current.minutes + edge.minutes + (isTransfer ? transferPenaltyMinutes : 0),
        transfers: current.transfers + (isTransfer ? 1 : 0),
        path: [...current.path, { stationId: edge.to, line: edge.line }],
        lines: [...current.lines, edge.line],
      });
    }
  }

  return null;
}

function nearestStations(point: Coordinates, limit: number) {
  return stations
    .map((station) => ({
      station,
      distanceMiles: distanceMiles(point, station),
    }))
    .sort((left, right) => left.distanceMiles - right.distanceMiles)
    .slice(0, limit);
}

function buildGraph(sourceEdges: Edge[]) {
  const map = new Map<string, Edge[]>();

  for (const sourceEdge of sourceEdges) {
    const reverse = {
      from: sourceEdge.to,
      to: sourceEdge.from,
      line: sourceEdge.line,
      minutes: sourceEdge.minutes,
    };

    map.set(sourceEdge.from, [...map.get(sourceEdge.from) ?? [], sourceEdge]);
    map.set(sourceEdge.to, [...map.get(sourceEdge.to) ?? [], reverse]);
  }

  return map;
}

function compactLines(lines: string[]) {
  return lines.filter((line, index) => index === 0 || line !== lines[index - 1]);
}

function edge(from: string, to: string, line: string, minutes: number): Edge {
  return { from, to, line, minutes };
}

function unknownCommute(targetLabel: string, targetAddress: string): CommuteEstimate {
  return {
    targetLabel,
    targetAddress,
    totalMinutes: 999,
    walkToTrainMinutes: 0,
    trainMinutes: 0,
    walkFromTrainMinutes: 0,
    startStation: "Unknown",
    endStation: "Unknown",
    lines: [],
    transfers: 0,
    confidence: "low",
    summary: `${targetLabel}: commute unknown; listing needs coordinates or a known neighborhood`,
  };
}
