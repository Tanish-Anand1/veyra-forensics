export function safeDestination(value: unknown): string {
  if (typeof value !== "string" || value.length > 220 || /[\\\r\n]/.test(value))
    return "/history";
  if (
    /^\/(?:analyze|history|investigate\/import)(?:\?(?:resume=1)?)?$/.test(
      value,
    )
  )
    return value;
  if (/^\/investigations\/[a-f0-9-]{36}$/.test(value)) return value;
  return "/history";
}
export function profileImage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      (url.hostname === "avatars.githubusercontent.com" ||
        url.hostname === "lh3.googleusercontent.com")
      ? url.href
      : null;
  } catch {
    return null;
  }
}
