export const NO_RESPONSE_LABEL =
  "No response (connection failed or request did not complete)";

export function describeHttpStatus(status: number): string {
  if (status === 0) return NO_RESPONSE_LABEL;
  return `HTTP ${status}`;
}

export function humanizeHttpStatusActual(actual: string): string {
  if (actual === "HTTP 0" || actual.startsWith("HTTP 0 ")) {
    return NO_RESPONSE_LABEL + actual.slice("HTTP 0".length);
  }
  return actual;
}
