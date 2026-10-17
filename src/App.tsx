import { useCallback, useEffect, lazy, Suspense } from "react";
import PublicProduct from "./PublicProduct";
import Workstation from "./Workstation";
import { LegalPage, Methodology, ContactPage } from "./Information";
import { SourcesPage, CyberEthicsPage } from "./Standards";
import { AuthPage } from "./Auth";
import { HistoryPage } from "./History";
import { useAuth } from "./session";
import { Header, Footer } from "./Layout";
import { navigate, useAppNavigation } from "./navigation";
import { SavedInvestigationPage } from "./Investigations";
import { signInDestination } from "../shared/auth";
const ForensicsImport = lazy(() => import("./ForensicsImport"));

export default function App() {
  const route = useAppNavigation();
  const path = route.pathname;
  const auth = useAuth();
  const finishOpening = useCallback(() => {
    const target = auth.user && !auth.error ? signInDestination : "/login";
    navigate(target, { replace: true });
  }, [auth.user, auth.error]);
  useEffect(() => {
    const titles: Record<string, string> = {
      "/": "See through deception.",
      "/about": "Conversation forensics",
      "/analyze": "Analysis Workstation",
      "/privacy": "Privacy Policy",
      "/terms": "Terms of Service",
      "/methodology": "Methodology",
      "/sources": "Sources",
      "/cyber-ethics": "Cyber ethics",
      "/contact": "Contact",
      "/login": "Log in",
      "/signup": "Create a workspace",
      "/history": "Your investigations",
      "/investigate/import": "Conversation import",
    };
    document.title = `${titles[path] || (path.startsWith("/investigations/") ? "Saved investigation" : "Page not found")} | VEYRA`;
  }, [path]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {path === "/investigate/import" ? (
        <Suspense
          fallback={
            <>
              <Header app />
              <main id="main" className="information">
                <h1>
                  Prepare your <em>evidence.</em>
                </h1>
              </main>
            </>
          }
        >
          <ForensicsImport />
        </Suspense>
      ) : path === "/" || path === "/login" || path === "/signup" ? (
        <AuthPage
          signup={path === "/signup"}
          opening={path === "/"}
          onOpeningEnd={finishOpening}
        />
      ) : path === "/history" ? (
        <HistoryPage />
      ) : /^\/investigations\/[a-f0-9-]{36}$/.test(path) ? (
        <SavedInvestigationPage id={path.split("/")[2]} />
      ) : path === "/analyze" ? (
        <Workstation />
      ) : path === "/privacy" || path === "/terms" ? (
        <LegalPage kind={path.slice(1) as "privacy" | "terms"} />
      ) : path === "/methodology" ? (
        <Methodology />
      ) : path === "/sources" ? (
        <SourcesPage />
      ) : path === "/cyber-ethics" ? (
        <CyberEthicsPage />
      ) : path === "/contact" ? (
        <ContactPage />
      ) : path === "/about" ? (
        <PublicProduct />
      ) : (
        <>
          <Header />
          <main id="main" className="information">
            <span className="mono">404 / PAGE NOT FOUND</span>
            <h1>
              This connection
              <br />
              <em>ends here.</em>
            </h1>
            <a className="button primary" href="/">
              Return home ↗
            </a>
          </main>
          <Footer />
        </>
      )}
      {(["/login", "/signup", "/analyze", "/history"].includes(path) ||
        path.startsWith("/investigations/")) && <Footer />}
    </>
  );
}
