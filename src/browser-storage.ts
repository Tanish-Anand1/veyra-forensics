export function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeSession(key: string): boolean {
  try {
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function broadcastSignout(): boolean {
  try {
    localStorage.setItem("chainbreak-auth-event", String(Date.now()));
    return true;
  } catch {
    return false;
  }
}
