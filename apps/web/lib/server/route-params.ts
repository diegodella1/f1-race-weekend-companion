export function decodeRouteId(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
