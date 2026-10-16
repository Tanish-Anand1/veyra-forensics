import { useState } from "react";
import { Header, Footer } from "./Layout";
import CaseStudy from "./CaseStudy";
import Wordmark from "./components/Wordmark";
import Artwork from "./components/Artwork";
const still = () => {};
export default function PublicProduct() {
  const [demo, setDemo] = useState(0);
  return (
    <>
      <Header />
      <main id="main" className="public-product">
        <section className="product-hero" aria-labelledby="product-title">
          <div className="product-sculpture">
            <Artwork intro={false} onComplete={still} />
          </div>
          <div className="product-introduction">
            <Wordmark className="product-wordmark" />
            <h1 id="product-title">
              SEE THROUGH
              <br />
              DECEPTION.
            </h1>
            <p>
              Investigate suspicious conversations. Trace manipulation. Inspect
              the evidence.
            </p>
            <div className="product-actions">
              <a className="button primary" href="/investigate/import">
                Upload a conversation
              </a>
              <a
                className="text-link"
                href="#system"
                onClick={() => setDemo((value) => value + 1)}
              >
                Explore the TrustGraph
              </a>
            </div>
          </div>
        </section>
        <section className="product-workflow" aria-labelledby="workflow-title">
          <h2 id="workflow-title">
            From a message
            <br />
            to the evidence.
          </h2>
          <div>
            <p>
              WhatsApp exports, screenshots or pasted text. Reconstruct the
              exchange, correct it, then investigate the patterns in context.
            </p>
            <ol>
              <li>Upload</li>
              <li>Reconstruct</li>
              <li>Investigate</li>
              <li>Visualize</li>
              <li>Understand</li>
            </ol>
            <p>
              Every finding points to its source. Interpretations remain
              distinct from facts. No sender identity or suspicious website is
              independently verified.
            </p>
          </div>
        </section>
        <CaseStudy key={demo} startSignal={demo} />
        <section className="product-conclusion">
          <h2>
            Make the connection.
            <br />
            Keep your judgment.
          </h2>
          <div>
            <p>
              Explore without an account. Sign in when you want to save an
              investigation and return to its evidence.
            </p>
            <a className="button primary" href="/login">
              Open your workspace
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
