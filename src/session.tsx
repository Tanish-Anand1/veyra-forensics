import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { profileImage } from "../shared/auth";
import { navigate } from "./navigation";
import { removeSession, broadcastSignout } from "./browser-storage";

type User = {
  id: string;
  name: string | null;
  image: string | null;
  expires: string;
};
type Account = {
  user: User | null;
  configured: boolean;
  providers: { google: boolean; github: boolean };
};
type AuthState = Account & {
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
};
const empty: Account = {
  user: null,
  configured: false,
  providers: { google: false, github: false },
};
const AuthContext = createContext<AuthState>({
  ...empty,
  loading: true,
  error: "",
  refresh: async () => {},
});
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/account", {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok)
        throw new Error(
          "Your session could not be checked. Retry in a moment.",
        );
      const data: Account = await response.json();
      if (data.user) {
        const sessionResponse = await fetch("/api/auth/session", {
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        });
        if (!sessionResponse.ok)
          throw new Error("Your session could not be renewed. Please retry.");
        const session = await sessionResponse.json();
        if (!session?.user) data.user = null;
        else data.user.expires = session.expires;
        removeSession("chainbreak-auth-next");
      }
      setAccount(data);
      setError("");
      setLoading(false);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const focus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const storage = (e: StorageEvent) => {
      if (e.key === "chainbreak-auth-event") void refresh();
    };
    document.addEventListener("visibilitychange", focus);
    window.addEventListener("storage", storage);
    const interval = window.setInterval(focus, 60_000);
    return () => {
      clearTimeout(initial);
      document.removeEventListener("visibilitychange", focus);
      window.removeEventListener("storage", storage);
      clearInterval(interval);
    };
  }, [refresh]);
  return (
    <AuthContext.Provider value={{ ...account, loading, error, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export async function authAction(
  action: "signin/google" | "signin/github" | "signout",
  callbackUrl: string,
) {
  const csrfResponse = await fetch("/api/auth/csrf", {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!csrfResponse.ok)
    throw new Error("Sign-in is unavailable. Please retry in a moment.");
  const { csrfToken } = await csrfResponse.json();
  if (!csrfToken) throw new Error("The security check expired. Please retry.");
  const response = await fetch(`/api/auth/${action}`, {
    signal: AbortSignal.timeout(15_000),
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body: new URLSearchParams({ csrfToken, callbackUrl }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.url)
    throw new Error(
      result?.error || "The request could not complete. Please retry.",
    );
  return result.url as string;
}

export function AccountNavigation() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await authAction("signout", "/");
      removeSession("chainbreak-pending-save");
      removeSession("chainbreak-auth-next");
      broadcastSignout();
      await auth.refresh();
      navigate("/login", { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="account-nav" aria-busy={auth.loading || busy}>
      {auth.user ? (
        <>
          <a
            href="/history"
            className="account-link"
            title={auth.user.name || "Your workspace"}
          >
            {profileImage(auth.user.image) ? (
              <img
                src={auth.user.image!}
                width="26"
                height="26"
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="account-monogram" aria-hidden="true">
                {(auth.user.name || "U").slice(0, 1)}
              </span>
            )}
            <span>{auth.user.name || "Your workspace"}</span>
          </a>
          <button onClick={logout} disabled={busy}>
            {busy ? "Signing out…" : "Log out"}
          </button>
        </>
      ) : (
        <a href="/login">
          Log in <span aria-hidden="true">↗</span>
        </a>
      )}
      {error && (
        <span className="account-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
