// For a request that threw: the browser is offline, or SnapStart failed
export function failedMessage(): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "Couldn’t reach SnapStart. Check your connection and try again.";
  return "Something went wrong on SnapStart’s side. Try again in a moment.";
}
