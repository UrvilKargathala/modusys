export function formatTime(date: Date | string | null): string {
  if (!date) return "--:--";
  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getWorkingHours(
  checkIn: Date | string,
  checkOut: Date | string | null
): string {
  if (!checkOut) return "In progress";
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}
