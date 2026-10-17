export const signInDestination = "/about";
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
