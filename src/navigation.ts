import { useEffect, useRef, useSyncExternalStore } from "react";
import { readSession, writeSession } from "./browser-storage";

export type AppLocation = { pathname: string; search: string; key: number };

const viewKey = "veyra-view";
const routes = new Set([
  "/",
  "/about",
  "/analyze",
  "/methodology",
  "/sources",
  "/cyber-ethics",
  "/privacy",
  "/terms",
  "/contact",
  "/login",
  "/signup",
  "/history",
  "/investigate/import",
]);

export function parseAppLocation(
  value: string,
): Omit<AppLocation, "key"> | null {
  if (
    value.length > 512 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return null;
  const url = new URL(value, "https://veyra.invalid");
  const pathname = url.pathname.replace(/\/$/, "") || "/";
  if (
    !routes.has(pathname) &&
    !/^\/investigations\/[a-f0-9-]{36}$/.test(pathname)
  )
    return null;
  return { pathname, search: url.search };
}

let current: AppLocation;
const listeners = new Set<() => void>();

function remember(location: AppLocation) {
  writeSession(viewKey, JSON.stringify(location));
}

function initialize(): AppLocation {
  const direct = window.location.pathname + window.location.search;
  let route = parseAppLocation(direct);
  if (direct === "/") {
    try {
      const saved =
        window.history.state?.veyraView ??
        JSON.parse(readSession(viewKey) || "null");
      if (saved?.pathname && typeof saved.search === "string")
        route = parseAppLocation(saved.pathname + saved.search);
    } catch {
      route = parseAppLocation(direct);
    }
  }
  const location = {
    ...(route ?? { pathname: "/404", search: "" }),
    key: Date.now(),
  };
  window.history.replaceState({ veyraView: location }, "", "/");
  remember(location);
  return location;
}

function snapshot() {
  current ??= initialize();
  return current;
}

export function appLocation() {
  return snapshot();
}

export function navigate(target: string, options: { replace?: boolean } = {}) {
  const route = parseAppLocation(target);
  if (!route) return;
  current = { ...route, key: Math.max(Date.now(), snapshot().key + 1) };
  window.history[options.replace ? "replaceState" : "pushState"](
    { veyraView: current },
    "",
    "/",
  );
  remember(current);
  listeners.forEach((listener) => listener());
}

export function useAppLocation() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, snapshot);
}

export function useAppNavigation() {
  const location = useAppLocation();
  const initialKey = useRef(location.key);
  useEffect(() => {
    const back = () => {
      const state = window.history.state?.veyraView;
      const route = state && parseAppLocation(state.pathname + state.search);
      current = {
        ...(route ?? { pathname: "/", search: "" }),
        key: Date.now(),
      };
      remember(current);
      listeners.forEach((listener) => listener());
    };
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target || link.hasAttribute("download")) return;
      const href = link.getAttribute("href") || "";
      if (href.startsWith("#")) {
        const target = document.getElementById(href.slice(1));
        if (target) {
          event.preventDefault();
          target.scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
          });
          target.setAttribute("tabindex", "-1");
          target.focus({ preventScroll: true });
        }
        return;
      }
      const url = new URL(link.href);
      if (
        url.origin !== window.location.origin ||
        !parseAppLocation(url.pathname + url.search)
      )
        return;
      event.preventDefault();
      navigate(url.pathname + url.search);
    };
    window.addEventListener("popstate", back);
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("popstate", back);
      document.removeEventListener("click", click);
    };
  }, []);
  useEffect(() => {
    if (location.key === initialKey.current) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    const frame = requestAnimationFrame(() => {
      const main = document.getElementById("main");
      main?.setAttribute("tabindex", "-1");
      main?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [location.key]);
  return location;
}
