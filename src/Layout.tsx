import Wordmark from "./components/Wordmark";
import { AccountNavigation } from "./session";

export function Mark() {
  return (
    <a className="brand" href="/" aria-label="VEYRA home">
      <Wordmark />
    </a>
  );
}

export function Header({ app = false }: { app?: boolean }) {
  return (
    <header className="site-header">
      <Mark />
      <nav aria-label="Main navigation">
        <a href={app ? "/investigate/import" : "/about"}>
          {app ? "Import conversation" : "The product"}
        </a>
        <a href="/methodology">Methodology</a>
        <a className={app ? "nav-active" : "nav-cta"} href="/analyze">
          {app ? "Analysis workstation" : "Open workstation"}
          <span aria-hidden="true">↗</span>
        </a>
      </nav>
      <AccountNavigation />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-invitation">
        <h2>
          Clarity starts
          <br />
          with the source.
        </h2>
        <a className="button primary" href="/investigate/import">
          Investigate a conversation <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="footer-navigation">
        <div className="footer-purpose">
          <Mark />
          <p>
            See the evidence.
            <br />
            Keep your judgment.
          </p>
        </div>
        <nav aria-label="Explore VEYRA">
          <span>Investigate</span>
          <a href="/about">The product</a>
          <a href="/investigate/import">Import conversation</a>
          <a href="/analyze">Analysis workstation</a>
          <a href="/history">Your investigations</a>
        </nav>
        <nav aria-label="Standards and information">
          <span>Understand</span>
          <a href="/methodology">Methodology</a>
          <a href="/sources">Sources</a>
          <a href="/cyber-ethics">Cyber ethics</a>
          <a href="/contact">Contact</a>
        </nav>
      </div>
      <div className="footer-signature" aria-hidden="true">
        <Wordmark />
      </div>
      <div className="footer-baseline">
        <span>© {new Date().getFullYear()} VEYRA</span>
        <span>See through deception.</span>
        <nav aria-label="Legal">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
      </div>
    </footer>
  );
}
