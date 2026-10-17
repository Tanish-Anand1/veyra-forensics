import { Footer, Header } from "./Layout";

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const privacy = kind === "privacy";
  return (
    <>
      <Header />
      <main id="main" className="information">
        <span className="mono">
          VEYRA / {privacy ? "DATA HANDLING" : "DEMO TERMS"} / 16 OCTOBER 2026
        </span>
        <h1>
          {privacy ? "Your conversation." : "A tool for clarity."}
          <br />
          <em>{privacy ? "Your control." : "Use with judgment."}</em>
        </h1>
        <p className="information-lead">
          {privacy
            ? "This notice describes what this implementation actually does with your data."
            : "These terms apply to this experimental social-engineering analysis demo."}
        </p>
        <div className="information-body">
          {privacy ? (
            <>
              <section>
                <h2>Local analysis</h2>
                <p>
                  Local checks, text-file reading and redaction run in your
                  browser. The conversation is not sent to the server in local
                  mode unless you explicitly choose to save. The page requests
                  server configuration and session status without conversation
                  content. Unsaved text and results are held in page memory and
                  cleared when you reload, navigate away or select Clear
                  session.
                </p>
              </section>
              <section>
                <h2>Optional OpenAI processing</h2>
                <p>
                  If you select OpenAI and consent, your current conversation
                  text is sent to this application's server and the OpenAI
                  Responses API. The server also processes sender labels
                  extracted from that text. API keys stay on the server.
                  Requests use <code>store: false</code>. This setting does not
                  promise zero retention: provider abuse monitoring and any
                  applicable provider policies still apply. Review{" "}
                  <a
                    href="https://developers.openai.com/api/docs/guides/your-data"
                    target="_blank"
                    rel="noreferrer"
                  >
                    OpenAI's data controls
                  </a>{" "}
                  before sharing sensitive material.
                </p>
                <p>
                  The server holds request data temporarily while processing it
                  and returns the analysis. This implementation does not
                  intentionally log raw conversations. Import requests and their
                  results may remain in server memory for up to five minutes to
                  coalesce retries; each server instance holds at most 32
                  requests. Hosting infrastructure may record connection
                  metadata; its retention depends on the deployment operator. An
                  in-flight provider request may continue if you cancel or leave
                  the page.
                </p>
              </section>
              <section>
                <h2>Conversation imports and screenshots</h2>
                <p>
                  WhatsApp text and ZIP archives are parsed locally. Archive
                  media is ignored and original archives are never uploaded.
                  Screenshot previews are resized and stripped of file metadata
                  in your browser. Only after separate consent are those
                  prepared images sent through this server to OpenAI for
                  transcription. Image redaction must happen before that step;
                  text redaction later cannot undo a previous image submission.
                </p>
                <p>
                  Review and correct the reconstructed transcript before
                  analysis. The exact selected message packets are shown before
                  text consent. Long histories use a disclosed bounded
                  selection; omitted context may change interpretation. Source
                  filenames, line or image-region references, reviewed text,
                  uncertainties and reports are included when you explicitly
                  save. Original image pixels and export files are excluded from
                  saved reports. A random HttpOnly processing cookie lasts 15
                  minutes and scopes retry coalescing.
                </p>
              </section>
              <section>
                <h2>Redaction and exports</h2>
                <p>
                  Optional local redaction detects common email, phone, long
                  numeric and US Social Security number patterns. It is
                  incomplete. Names, addresses, document numbers, secrets and
                  sensitive context can remain. Review the full text manually.
                  Exporting evidence creates a JSON or PDF file on your device
                  containing the analyzed messages and results. A PDF also
                  attaches the full reviewed evidence as UTF-8 JSON. Clear
                  session cannot delete downloaded files, browser history or
                  provider-held records.
                </p>
              </section>
              <section>
                <h2>Accounts and saved investigations</h2>
                <p>
                  Google or GitHub handles authentication. We retain your
                  provider account identifier, supplied name and profile image,
                  and a verified Google email when available. GitHub private
                  email and repository permissions are not requested. Provider
                  access and refresh tokens are not retained. Profile images
                  load from the provider with no referrer. Secure HttpOnly
                  cookies maintain a seven-day session; signing out revokes the
                  current session.
                </p>
                <p>
                  Choosing Save investigation sends the conversation, report and
                  title to our PostgreSQL database, associated with your
                  account. Saved reports remain until you delete them from your
                  private history. Deletion removes the live application record;
                  database backups may retain copies according to the deployment
                  operator's backup schedule. Saving is optional and requires
                  explicit confirmation. Only your account can read or delete
                  your saved investigations.
                </p>
                <p>
                  If you choose to keep a report while signing in, this tab
                  temporarily stores it in session storage for up to 30 minutes.
                  It is restored only when you return to the workstation, and
                  saving to your account still requires confirmation. Saving,
                  clearing the conversation or logging out removes this
                  temporary copy. Closing the tab ends its storage. Expired
                  copies are discarded when opened again.
                </p>
              </section>
              <section>
                <h2>Other data</h2>
                <p>
                  No analytics, advertising, tracking pixels or remote font
                  services are included. Fonts are self-hosted. Session storage
                  holds the current application view, whether the introductory
                  animation has been seen and any explicitly requested temporary
                  sign-in recovery copy. A short-lived in-memory server rate
                  limit uses the connection IP for endpoint abuse protection.
                  Its counters reset after one minute and on process restart.
                  The public Vercel deployment also applies an edge rate limit
                  using connection IP metadata. Authentication and history use
                  shared database rate limits with HMAC-pseudonymized keys. No
                  suspicious URLs are visited or submitted to a reputation
                  service.
                </p>
              </section>
              <section>
                <h2>Control and questions</h2>
                <p>
                  Use local mode when you do not want to transmit text. Remove
                  sensitive data before analysis. Use only conversations you are
                  authorized to process. Delete retained investigations from
                  your history. A public deployment operator must supply its own
                  identity, contact details and hosting-specific data practices
                  before inviting real users.
                </p>
              </section>
            </>
          ) : (
            <>
              <section>
                <h2>Purpose and eligibility</h2>
                <p>
                  VEYRA is an educational and experimental analysis instrument.
                  You may use it to inspect conversations you have permission to
                  process. Do not submit secrets, passwords, one-time codes,
                  confidential records or unnecessary personal data. Do not use
                  it for harassment, unlawful surveillance or consequential
                  automated decisions about people.
                </p>
              </section>
              <section>
                <h2>Assessments have limits</h2>
                <p>
                  Indicators, model interpretations and hypothetical scenarios
                  may be incomplete or wrong. A low-signal result is not a
                  safety clearance. An elevated assessment does not prove fraud.
                  Sender identities, organizations, URL ownership and reputation
                  are not independently verified. No security, financial, legal
                  or identity-protection guarantee is made.
                </p>
              </section>
              <section>
                <h2>Your decisions</h2>
                <p>
                  Verify consequential claims through an independently sourced,
                  trusted channel. Do not rely on the report alone when sharing
                  money, credentials or documents. If you believe an account or
                  payment has been compromised, contact the relevant institution
                  through its official channel. This demo is not an emergency
                  response or incident recovery service.
                </p>
              </section>
              <section>
                <h2>Samples and scenarios</h2>
                <p>
                  All supplied conversations are fictional, labeled simulated
                  examples. Their reports are computed from their text by the
                  same architecture used for your input. Counterfactual
                  scenarios are assumptions used to examine deterministic
                  assessment rules. They do not add verified evidence, predict
                  future actions or change the original exported report.
                </p>
              </section>
              <section>
                <h2>Availability and changes</h2>
                <p>
                  This demo is provided as available, without a service-level
                  commitment or accuracy warranty. API access may fail, rate
                  limits may apply and the service may be changed or withdrawn.
                  These terms do not exclude rights that cannot lawfully be
                  excluded. Public deployment requires the operator to identify
                  itself and review jurisdiction-specific terms. The{" "}
                  <a href="/privacy">Privacy Policy</a> describes current data
                  handling.
                </p>
              </section>
            </>
          )}
        </div>
        <a className="text-link" href="/analyze">
          RETURN TO WORKSTATION ↗
        </a>
      </main>
      <Footer />
    </>
  );
}

export function Methodology() {
  return (
    <>
      <Header />
      <main id="main" className="information">
        <span className="mono">METHOD & LIMITATIONS</span>
        <h1>
          Evidence first.
          <br />
          <em>Certainty earned.</em>
        </h1>
        <p className="information-lead">
          A transparent experimental system for examining how requests, pressure
          and claims develop across a conversation.
        </p>
        <div className="information-body">
          <section>
            <h2>One conversation, one evidence record</h2>
            <p>
              Each nonempty input line becomes a chronological message with a
              stable identifier. English-language rules identify explicit
              patterns. Optional OpenAI structured extraction can add contextual
              findings. Every accepted model finding must reference a real
              message and an exact quotation. Quotation validation checks
              textual presence, not whether the quoted statement is true.
            </p>
          </section>
          <section>
            <h2>How the assessment changes</h2>
            <p>
              Payment, credential and document requests are consequential
              indicators. When they occur with urgency, secrecy or conflicting
              statements, the deterministic assessment shows elevated concern.
              One category alone leads to review. Without either combination,
              the system reports insufficient evidence. Trust-building language
              and claimed authority alone do not establish deception. These
              rules are explainable heuristics, not a calibrated probability or
              a trained detection benchmark.
            </p>
          </section>
          <section>
            <h2>Graph and progression</h2>
            <p>
              The graph is computed from the same canonical record as the
              report. Sender labels link to messages attributed to them;
              messages link to extracted observations and parsed destinations.
              Conflicting evidence cites the relevant messages together. The
              timeline independently runs local checks on each earlier message
              prefix. Full-conversation AI interpretations appear only at the
              complete exchange. This avoids interpreting early messages using
              future context and does not make extra provider calls during
              replay.
            </p>
          </section>
          <section>
            <h2>Evidence classifications</h2>
            <p>
              OBSERVED describes text or URL structure present in the input.
              INFERRED describes contextual interpretations and potential
              conflicts. VERIFIED is reserved for independently checked facts;
              this implementation provides no identity or reputation
              verification. UNKNOWN covers matters not established here. Exact
              evidence can support an inference without making that inference a
              verified fact.
            </p>
          </section>
          <section>
            <h2>URL analysis</h2>
            <p>
              The standard URL parser extracts the actual hostname, including
              normalized ASCII form for internationalized domains. It checks IP
              destinations, user-info components, institution-like subdomains,
              reserved example domains and unencrypted HTTP. HTTPS does not
              establish trust. No arbitrary URL is fetched, no DNS ownership is
              verified and no threat-intelligence lookup is performed.
            </p>
          </section>
          <section>
            <h2>Research grounding</h2>
            <p>
              Conversation-level research motivates reviewing change across
              turns.
              <a
                href="https://arxiv.org/abs/2605.12243"
                target="_blank"
                rel="noreferrer"
              >
                {" "}
                PreScam (2026)
              </a>{" "}
              examines early scam progression;
              <a
                href="https://arxiv.org/abs/2406.12263"
                target="_blank"
                rel="noreferrer"
              >
                {" "}
                ConvoSentinel research (2024)
              </a>{" "}
              studies message-level and conversation-level defense. These inform
              our choice to expose a cumulative timeline and both analysis
              scopes. We do not reproduce either system, use their datasets,
              claim their performance or predict a sender's next action.
            </p>
            <p>
              The indicator vocabulary draws on public consumer-protection
              guidance about impersonation, urgency, secrecy, upfront
              scholarship fees and sensitive-information requests. The{" "}
              <a
                href="https://consumer.ftc.gov/articles/how-avoid-scholarship-and-financial-aid-scams"
                target="_blank"
                rel="noreferrer"
              >
                FTC's scholarship scam guidance
              </a>{" "}
              informs the payment and trust-building examples. The{" "}
              <a
                href="https://consumer.ftc.gov/articles/government-grant-scams"
                target="_blank"
                rel="noreferrer"
              >
                FTC's government grant guidance
              </a>{" "}
              informs identity and information-request examples. These are
              design references, not validation of this implementation's
              detection performance.
            </p>
            <p>
              The optional extraction uses the official SDK and{" "}
              <a
                href="https://developers.openai.com/api/docs/guides/structured-outputs"
                target="_blank"
                rel="noreferrer"
              >
                OpenAI structured outputs
              </a>
              , with server-side schema and quotation validation. There is no
              claimed equivalence to a research model, no published accuracy
              measurement and no DuoRAM cryptography.
            </p>
          </section>
          <section>
            <h2>Known limitations</h2>
            <p>
              Local rules can misread quotations, sarcasm, speaker intent and
              descriptions of someone else's actions. Negation handling is
              limited. The parser treats each line as one message, with a
              maximum of 60. The model can make errors despite schema and
              evidence validation. English is the only language targeted by the
              deterministic rules. Text alone cannot establish fraud, intent or
              legitimacy.
            </p>
          </section>
        </div>
        <a className="button primary" href="/analyze">
          EXAMINE A CONVERSATION ↗
        </a>
      </main>
      <Footer />
    </>
  );
}

export function ContactPage() {
  const support = [
    {
      name: "Financial cyber fraud",
      description:
        "Lost money to an online scam? Report financial cyber fraud promptly through the national helpline.",
      action: "Call 1930",
      href: "tel:1930",
      source:
        "https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1814120&lang=2&reg=48",
      agency: "Ministry of Home Affairs",
    },
    {
      name: "Report a cybercrime",
      description:
        "Submit a cybercrime complaint through the Government of India's National Cyber Crime Reporting Portal.",
      action: "Open cybercrime.gov.in",
      href: "https://cybercrime.gov.in/",
      source: "https://cybercrime.gov.in/",
      agency: "National Cyber Crime Reporting Portal",
    },
    {
      name: "Immediate danger or emergency",
      description:
        "For an immediate threat to your safety, or an emergency requiring police, fire or medical assistance.",
      action: "Call 112",
      href: "tel:112",
      source:
        "https://www.mha.gov.in/en/commoncontent/emergency-response-support-system-erss",
      agency: "Emergency Response Support System",
    },
    {
      name: "Technical security incidents",
      description:
        "Report cybersecurity incidents affecting systems or networks to CERT-In's incident response help desk.",
      action: "Email incident@cert-in.org.in",
      href: "mailto:incident@cert-in.org.in",
      source: "https://www.cert-in.org.in/s2cMainServlet?pageid=CONTACTUS",
      agency: "Indian Computer Emergency Response Team",
    },
  ];
  const candidate = import.meta.env.VITE_CONTACT_EMAIL?.trim();
  const email =
    candidate && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(candidate)
      ? candidate
      : null;
  return (
    <>
      <Header />
      <main id="main" className="information contact-page">
        <span className="mono">CONTACT / VEYRA</span>
        <h1>
          The right help.
          <br />
          When it matters.
        </h1>
        <p className="information-lead">
          Official reporting channels for India, alongside a way to share
          feedback about VEYRA.
        </p>
        <section className="contact-directory" aria-labelledby="help-title">
          <h2 id="help-title">Find the right reporting channel</h2>
          {support.map((contact) => (
            <article key={contact.href}>
              <div>
                <h3>{contact.name}</h3>
                <p>{contact.description}</p>
              </div>
              <div className="contact-channel">
                <a
                  className="contact-action"
                  href={contact.href}
                  {...(contact.href.startsWith("https:")
                    ? { target: "_blank", rel: "noreferrer" }
                    : {})}
                >
                  {contact.action}
                </a>
                <a href={contact.source} target="_blank" rel="noreferrer">
                  Official source: {contact.agency}
                </a>
              </div>
            </article>
          ))}
          <p className="contact-scope">
            These services cover India. Elsewhere, use your local emergency or
            cybercrime reporting service. VEYRA does not receive complaints or
            provide emergency response. Sources checked on 17 October 2026.
          </p>
        </section>
        <div className="information-body">
          <section>
            <h2>Get in touch</h2>
            {email ? (
              <p>
                <a
                  className="text-link"
                  href={`mailto:${email}?subject=VEYRA%20feedback`}
                >
                  {email} ↗
                </a>
              </p>
            ) : (
              <p>
                For feedback, contact the person who shared this experimental
                demo with you. A public contact address has not yet been
                published.
              </p>
            )}
            <p>
              Include the page, what you tried and what happened. Leave out
              private conversations, passwords, account details and identifying
              documents.
            </p>
          </section>
          <section>
            <h2>Need help with a suspicious request?</h2>
            <p>
              Contact the relevant institution through a channel you already
              trust. This project cannot verify identities or recover accounts
              or payments.
            </p>
          </section>
        </div>
        <a className="button primary" href="/analyze">
          RETURN TO YOUR INVESTIGATION ↗
        </a>
      </main>
      <Footer />
    </>
  );
}
