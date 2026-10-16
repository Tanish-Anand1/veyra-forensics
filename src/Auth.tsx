import { useCallback, useEffect, useState, useRef } from "react";
import { safeDestination } from "../shared/auth";
import Artwork from "./components/Artwork";
import { Mark } from "./Layout";
import Opening from "./components/Opening";
import { authAction, useAuth } from "./session";
import { navigate, useAppLocation } from "./navigation";
import { readSession, writeSession } from "./browser-storage";

const authErrors: Record<string, string> = {
  AccessDenied:
    "Sign-in was cancelled or permission was declined. You can try again or return to the demonstration.",
  OAuthCallbackError:
    "Sign-in was cancelled or the provider could not complete sign-in. Please try again.",
  OAuthSignin: "The provider could not be reached. Please retry.",
  OAuthSignInError: "The provider could not be reached. Please retry.",
  OAuthAccountNotLinked:
    "Use the provider you originally signed up with. Accounts are never merged automatically by email.",
  AccountNotLinked:
    "Use the provider you originally signed up with. Accounts are never merged automatically by email.",
  Configuration:
    "Sign-in could not complete. Please retry from this page. If it continues, try the other provider.",
  MissingCSRF: "The sign-in security check expired. Please try again.",
  SessionRequired:
    "Your session has ended. Sign in again to return to your investigation.",
};
const still = () => {};
export function AuthPage({
  signup = false,
  opening = false,
  onOpeningEnd,
}: {
  signup?: boolean;
  opening?: boolean;
  onOpeningEnd?: () => void;
}) {
  const auth = useAuth();
  const [isOpening, setIsOpening] = useState(() => {
    if (!opening || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return false;
    return !readSession("veyra-intro");
  });
  const [filmReady, setFilmReady] = useState(false);
  const endOpening = useRef(onOpeningEnd);
  useEffect(() => {
    endOpening.current = onOpeningEnd;
  }, [onOpeningEnd]);
  const finishOpening = useCallback(() => {
    setIsOpening(false);
    writeSession("veyra-intro", "seen");
    endOpening.current?.();
  }, []);
  const sceneReady = useCallback(() => {
    void document.fonts.ready.then(() => setFilmReady(true));
  }, []);
  useEffect(() => {
    if (opening && !isOpening) endOpening.current?.();
  }, [opening, isOpening]);
  useEffect(() => {
    if (!isOpening) return;
    const timer = setTimeout(finishOpening, filmReady ? 7100 : 9000);
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const reduce = () => {
      if (media.matches) finishOpening();
    };
    media.addEventListener("change", reduce);
    return () => {
      clearTimeout(timer);
      media.removeEventListener("change", reduce);
    };
  }, [isOpening, filmReady, finishOpening]);
  const route = useAppLocation();
  const params = new URLSearchParams(route.search);
  const remembered = readSession("chainbreak-auth-next");
  let destination =
    params.get("next") || params.get("callbackUrl") || remembered;
  if (destination?.startsWith(window.location.origin + "/"))
    destination = destination.slice(window.location.origin.length);
  const next = safeDestination(destination || "/investigate/import");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(() =>
    params.has("error")
      ? authErrors[params.get("error")!] ||
        "Sign-in did not complete. Please try again."
      : "",
  );
  useEffect(() => {
    if (auth.user && !auth.error && !opening && !isOpening)
      navigate(next, { replace: true });
  }, [auth.user, auth.error, next, opening, isOpening]);
  async function signin(provider: "google" | "github") {
    setBusy(provider);
    setError("");
    writeSession("chainbreak-auth-next", next);
    try {
      window.location.assign(await authAction(`signin/${provider}`, next));
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }
  return (
    <div
      className={`auth-page${isOpening ? " is-opening" : ""}`}
      data-film-ready={filmReady}
    >
      <header className="auth-header" inert={isOpening}>
        <Mark />
        <a href="/about">Explore VEYRA</a>
      </header>
      <main id="main" className="auth-composition">
        <div className="auth-sculpture">
          <Artwork
            intro={isOpening && filmReady}
            onComplete={still}
            onReady={sceneReady}
            cameraMotion
          />
        </div>
        <section
          className="auth-entry"
          aria-labelledby="auth-title"
          inert={isOpening}
          aria-hidden={isOpening}
        >
          <h1 id="auth-title">
            {signup ? "START WITH" : "SEE THROUGH"}
            <br />
            {signup ? "THE EVIDENCE." : "DECEPTION."}
          </h1>
          <p className="auth-intro">
            {signup
              ? "Create your investigation workspace. Save the conversations you choose, and return to their evidence."
              : "Investigate suspicious conversations. Trace manipulation. Inspect the evidence."}
          </p>
          <div
            className="provider-stack"
            aria-busy={Boolean(busy) || auth.loading}
          >
            <button
              className="provider-button provider-google"
              disabled={auth.loading || !auth.providers.google || Boolean(busy)}
              onClick={() => signin("google")}
            >
              <GoogleIcon />
              <span>
                {busy === "google"
                  ? "Connecting to Google…"
                  : "Continue with Google"}
              </span>
            </button>
            <button
              className="provider-button"
              disabled={auth.loading || !auth.providers.github || Boolean(busy)}
              onClick={() => signin("github")}
            >
              <GitHubIcon />
              <span>
                {busy === "github"
                  ? "Connecting to GitHub…"
                  : "Continue with GitHub"}
              </span>
            </button>
          </div>
          <div
            className="auth-status"
            role={error || auth.error ? "alert" : "status"}
          >
            {error ||
              auth.error ||
              (auth.loading
                ? "Checking sign-in availability…"
                : !auth.configured
                  ? "Sign-in is awaiting server configuration. The public demonstration is available now."
                  : !auth.providers.google || !auth.providers.github
                    ? "One provider is awaiting configuration. Use the available option to continue."
                    : "Your provider handles sign-in. We never ask for your password.")}
            {auth.error && (
              <button className="text-link" onClick={() => void auth.refresh()}>
                Retry connection ↗
              </button>
            )}
          </div>
          <p className="auth-switch">
            {signup ? "Already have a workspace?" : "First time here?"}{" "}
            <a
              href={`${signup ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`}
            >
              {signup ? "Log in" : "Create a workspace"}
            </a>
          </p>
        </section>
      </main>
      <nav
        className="auth-footer"
        aria-label="Guest access and policies"
        inert={isOpening}
      >
        <a href="/investigate/import">Try a guest investigation</a>
        <button
          className="replay-opening"
          onClick={() => {
            if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
            window.scrollTo({ top: 0, behavior: "instant" });
            setIsOpening(true);
          }}
        >
          Replay opening
        </button>
        <div>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
      </nav>
      {isOpening && <Opening running={filmReady} onFinish={finishOpening} />}
    </div>
  );
}
function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.94 5.49l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z"
      />
    </svg>
  );
}
function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 .8a11.2 11.2 0 0 0-3.54 21.82c.56.1.77-.24.77-.54v-2.08c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 .1.76 2.52 3.29 1.8.1-.73.4-1.23.72-1.51-2.5-.29-5.14-1.26-5.14-5.59 0-1.24.44-2.25 1.16-3.04-.12-.29-.5-1.44.11-3 0 0 .95-.3 3.08 1.16a10.75 10.75 0 0 1 5.6 0c2.14-1.46 3.08-1.16 3.08-1.16.62 1.56.23 2.71.12 3a4.36 4.36 0 0 1 1.15 3.04c0 4.34-2.64 5.3-5.15 5.58.41.35.77 1.03.77 2.08v3.22c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8Z" />
    </svg>
  );
}
