import { Footer, Header } from "./Layout";

const sources = [
  {
    category: "Conversation research",
    title: "PreScam: Predicting scam progression from early conversations",
    publisher: "Sun et al. · 2026 · Research preprint",
    href: "https://arxiv.org/abs/2605.12243",
    description:
      "Examines how conversational scams develop over time. It informs our emphasis on cumulative evidence and chronological review.",
    boundary:
      "VEYRA does not use this dataset, reproduce its benchmark or predict a sender’s next action.",
  },
  {
    category: "Conversation research",
    title: "Defending Against Social Engineering Attacks in the Age of LLMs",
    publisher: "Ai et al. · 2024 · EMNLP",
    href: "https://aclanthology.org/2024.emnlp-main.716/",
    description:
      "Studies social engineering in chat and defenses that consider both individual messages and the surrounding conversation.",
    boundary:
      "This is a design reference. VEYRA does not implement ConvoSentinel or claim its reported performance.",
  },
  {
    category: "Protective guidance",
    title: "How to avoid scholarship and financial aid scams",
    publisher: "US Federal Trade Commission",
    href: "https://consumer.ftc.gov/articles/how-avoid-scholarship-and-financial-aid-scams",
    description:
      "Practical guidance on scholarship promises, upfront charges and requests for financial information. It informs our fictional scholarship example.",
    boundary:
      "A warning pattern is a reason to investigate. It does not establish that a particular message is fraudulent.",
  },
  {
    category: "Protective guidance",
    title: "Phishing: recognize suspicious requests",
    publisher: "National Institute of Standards and Technology",
    href: "https://www.nist.gov/itl/smallbusinesscyber/guidance-topic/phishing",
    description:
      "An introduction to phishing and practical resources for recognizing suspicious communications and checking their origin.",
    boundary:
      "VEYRA inspects the text you provide. It does not independently verify identities or visit suspicious destinations.",
  },
  {
    category: "Responsible computing",
    title: "ACM Code of Ethics and Professional Conduct",
    publisher: "Association for Computing Machinery · 2018",
    href: "https://www.acm.org/code-of-ethics",
    description:
      "Principles for avoiding harm, respecting privacy and assessing the wider consequences of computing systems.",
    boundary:
      "Our cyber ethics page translates these principles into practical expectations for using this product.",
  },
  {
    category: "Responsible computing",
    title: "AI Risk Management Framework",
    publisher: "National Institute of Standards and Technology",
    href: "https://www.nist.gov/itl/ai-risk-management-framework",
    description:
      "A voluntary framework for considering risks to people and organizations throughout the use of AI systems.",
    boundary:
      "A reference for human review and visible limitations. Listing it does not imply certification or a completed conformity assessment.",
  },
  {
    category: "Data handling",
    title: "OpenAI API data controls",
    publisher: "OpenAI · Official API documentation",
    href: "https://developers.openai.com/api/docs/guides/your-data",
    description:
      "Explains provider storage and abuse-monitoring behavior for API requests. Our optional processing uses store: false.",
    boundary:
      "That setting is not a promise of zero retention. Review provider policy before sharing sensitive conversations.",
  },
];

export function SourcesPage() {
  return (
    <>
      <Header />
      <main id="main" className="standards-page sources-page">
        <header className="standards-introduction">
          <h1>
            Follow the claim.
            <br />
            Find the source.
          </h1>
          <p>
            Research behind the method. Guidance behind protective actions. Each
            reference has a clear role and a clear limit.
          </p>
        </header>
        <div className="source-register">
          {sources.map((source) => (
            <article key={source.href}>
              <div className="source-context">
                <span>{source.category}</span>
                <p>{source.publisher}</p>
              </div>
              <div className="source-detail">
                <h2>
                  <a href={source.href} target="_blank" rel="noreferrer">
                    {source.title}
                    <span aria-hidden="true"> ↗</span>
                  </a>
                </h2>
                <p>{source.description}</p>
                <p className="source-boundary">
                  <strong>In VEYRA</strong>
                  {source.boundary}
                </p>
              </div>
            </article>
          ))}
        </div>
        <aside className="standards-note">
          <h2>
            References establish context.
            <br />
            Evidence supports a finding.
          </h2>
          <p>
            These sources inform our design. They do not validate VEYRA’s
            detection accuracy. Every investigation still needs the original
            messages, the surrounding context and your judgment.
          </p>
          <a href="/methodology" className="text-link">
            Read the methodology <span aria-hidden="true">↗</span>
          </a>
        </aside>
      </main>
      <Footer />
    </>
  );
}

const principles = [
  {
    title: "Start with permission.",
    text: "Investigate conversations you are entitled to access and process. Someone sharing a message with you does not automatically give permission to publish their identity or their private history.",
  },
  {
    title: "Collect less. Protect more.",
    text: "Remove names, contact details, account numbers and unrelated messages before processing. Use local analysis when the material should remain on your device. Review the exact text before consenting to optional OpenAI processing.",
  },
  {
    title: "Treat findings as interpretations.",
    text: "A quotation can be exact while an interpretation is wrong. Check the complete exchange, consider innocent explanations and distinguish an observed request from an inferred motive. A graph connection is not proof of fraud.",
  },
  {
    title: "Keep people out of the crossfire.",
    text: "Do not use an investigation to harass, threaten, impersonate, expose private information or make public accusations. Avoid irreversible decisions about a person based only on an automated assessment.",
  },
  {
    title: "Preserve the context.",
    text: "Keep an authorized original when it is needed for a report. Record corrections, missing messages and uncertainty. Share only the evidence a trusted recipient needs, and avoid editing an excerpt in a way that changes its meaning.",
  },
  {
    title: "Verify through a separate channel.",
    text: "Pause before following a request for money, credentials or documents. Find the organization through an independent official channel. Use the platform’s own reporting tools when appropriate. VEYRA does not contact a sender or submit a report on your behalf.",
  },
];

export function CyberEthicsPage() {
  return (
    <>
      <Header />
      <main id="main" className="standards-page ethics-page">
        <header className="standards-introduction">
          <h1>
            Investigate the pattern.
            <br />
            Respect the person.
          </h1>
          <p>
            Cybersecurity should reduce harm. Use VEYRA to understand a
            conversation, protect sensitive information and make a considered
            next move.
          </p>
        </header>
        <div className="ethics-principles">
          {principles.map((principle, index) => (
            <section key={principle.title}>
              <span aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h2>{principle.title}</h2>
                <p>{principle.text}</p>
              </div>
            </section>
          ))}
        </div>
        <aside className="standards-note">
          <h2>
            Human judgment
            <br />
            stays in the loop.
          </h2>
          <p>
            Our approach draws on the{" "}
            <a
              href="https://www.acm.org/code-of-ethics"
              target="_blank"
              rel="noreferrer"
            >
              ACM Code of Ethics
            </a>{" "}
            and the{" "}
            <a
              href="https://www.nist.gov/itl/ai-risk-management-framework"
              target="_blank"
              rel="noreferrer"
            >
              NIST AI Risk Management Framework
            </a>
            . These are principles for responsible use, not a claim of
            certification.
          </p>
          <a href="/sources" className="text-link">
            Explore the sources <span aria-hidden="true">↗</span>
          </a>
        </aside>
      </main>
      <Footer />
    </>
  );
}
