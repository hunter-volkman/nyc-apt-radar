export function formatDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDateLabel(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(isDateOnly ? { timeZone: "UTC" } : {}),
  }).format(new Date(isDateOnly ? `${value}T00:00:00.000Z` : value));
}
