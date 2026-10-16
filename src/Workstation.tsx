import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./Layout";
import TrustGraph from "./components/TrustGraph";
import ConversationTrace from "./components/ConversationTrace";
import EvidenceFocus from "./components/EvidenceFocus";
import { throughMessage, isAnalysis } from "./evidence";
import {
  assess,
  buildAnalysis,
  kindLabels,
  parseMessages,
  redact,
  scenarioFindings,
} from "../shared/engine";
import { MAX_CHARS } from "../shared/constants";
import type { Analysis, Scenario } from "../shared/schema";
import { samples } from "../shared/samples";
import { protectiveActions } from "../shared/actions";
import {
  SaveInvestigation,
  pendingReport,
  clearPending,
  type SavedReport,
} from "./Investigations";

import { scenarioDescriptions } from "./scenarios";

export default function Workstation({
  initial,
}: { initial?: SavedReport } = {}) {
  const [restored] = useState(() => initial ?? pendingReport());
  const [text, setText] = useState<string>(restored?.text ?? samples[1].text);
  const [sample, setSample] = useState(restored ? "" : "b");
  const [mode, setMode] = useState<"local" | "openai">("local");
  const [consent, setConsent] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(
    restored?.analysis ?? null,
  );
  const [step, setStep] = useState(restored?.analysis.messages.length ?? 1);
  const current = useMemo(
    () => (analysis ? throughMessage(analysis, step) : null),
    [analysis, step],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    restored
      ? "Report restored. Review the original evidence or edit and analyze again."
      : "Simulated case B loaded. Run analysis to inspect its evidence.",
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario>("original");
  const [tab, setTab] = useState<"summary" | "evidence" | "timeline">(
    "summary",
  );
  const [status, setStatus] = useState<{
    configured: boolean;
    model: string;
  } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const requestGeneration = useRef(0);
  const selectEvidence = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => {
      const region = document.querySelector<HTMLElement>(".report-region");
      if (region) region.scrollTop = 0;
      if (window.innerWidth <= 850) {
        region?.scrollIntoView({ block: "start", behavior: "instant" });
        region
          ?.querySelector<HTMLElement>(".node-inspector h3")
          ?.focus({ preventScroll: true });
      }
    });
  };
  const revealSource = (id: string) => {
    setSelected(id);
    requestAnimationFrame(() => {
      const source = document.querySelector<HTMLButtonElement>(
        `.trace-message[data-message="${id}"]`,
      );
      source?.focus({ preventScroll: true });
      if (window.innerWidth <= 850)
        document
          .querySelector(".conversation-trace")
          ?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  };
  useEffect(() => {
    if (!analysis) return;
    const heading = document.getElementById("graph-title");
    heading?.focus({ preventScroll: true });
    heading
      ?.closest(".workspace-grid")
      ?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [analysis]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/status", { signal: controller.signal })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
    return () => {
      controller.abort();
      abort.current?.abort();
    };
  }, []);
  const invalidate = () => {
    clearPending();
    requestGeneration.current++;
    abort.current?.abort();
    setBusy(false);
    setAnalysis(null);
    setSelected(null);
    setScenario("original");
    setError("");
  };
  const changeText = (value: string) => {
    invalidate();
    setText(value);
    setSample("");
    setNotice("Input changed. Run analysis for the updated conversation.");
  };
  async function run(input = text) {
    setError("");
    if (input.trim().length < 8 || input.length > MAX_CHARS) {
      setError("Enter 8 to 18,000 characters before analyzing.");
      return;
    }
    if (mode === "openai" && !consent) {
      setError("Read and accept the OpenAI processing notice first.");
      return;
    }
    let messages;
    try {
      messages = parseMessages(input);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    const generation = ++requestGeneration.current;
    setTab("summary");
    setBusy(true);
    setSelected(null);
    setScenario("original");
    setAnalysis(null);
    try {
      if (mode === "local") {
        const result = buildAnalysis(messages);
        setAnalysis(result);
        setStep(result.messages.length);
        setNotice(
          `Analyzed ${messages.length} messages in this browser. No conversation content was transmitted.`,
        );
      } else {
        abort.current?.abort();
        const controller = new AbortController();
        abort.current = controller;
        const timer = window.setTimeout(() => controller.abort(), 42000);
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: input, mode, consent }),
            signal: controller.signal,
          });
          const data = await res.json().catch(() => null);
          if (generation !== requestGeneration.current) return;
          if (!res.ok)
            throw new Error(
              res.status === 429
                ? "Analysis request limit reached. Wait one minute and retry, or use local checks."
                : data?.error ||
                    "Analysis could not complete. Please retry or use local checks.",
            );
          if (!isAnalysis(data))
            throw new Error(
              "The analysis service returned an unexpected response. Retry or use local checks.",
            );
          setAnalysis(data);
          setStep(data.messages.length);
          setNotice(
            `OpenAI extraction completed. ${data.messages.length} messages analyzed with quotation validation.`,
          );
        } finally {
          clearTimeout(timer);
        }
      }
    } catch (e) {
      if (generation !== requestGeneration.current) return;
      setNotice(
        "No report generated. Your conversation remains available to edit or retry.",
      );
      setError(
        (e as Error).name === "AbortError"
          ? "Analysis was interrupted or timed out. Your input is still here. Retry or use local checks."
          : (e as Error).message,
      );
    } finally {
      if (generation === requestGeneration.current) setBusy(false);
    }
  }
  function download() {
    if (!analysis) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(analysis, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "veyra-evidence.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "Report exported. It contains your submitted messages; store it carefully.",
    );
  }
  const assessment = analysis ? assess(current!.findings, scenario) : null;
  const visibleFindings = analysis
    ? scenarioFindings(current!.findings, scenario)
    : [];
  const priority = [
    "credentials",
    "payment",
    "documents",
    "secrecy",
    "inconsistency",
    "urgency",
    "destination",
    "identity",
    "claim",
    "trust",
  ];
  const recommendations = [
    ...new Set(
      [...visibleFindings]
        .sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind))
        .map((finding) => protectiveActions[finding.kind]),
    ),
  ].slice(0, 3);

  let messages: ReturnType<typeof parseMessages>;
  try {
    messages = parseMessages(text);
  } catch {
    messages = [];
  }
  return (
    <div className="workstation-page">
      <Header app />
      <main id="main" className="workstation">
        <div className="work-title">
          <div>
            <span className="mono">ANALYSIS WORKSTATION</span>
            <h1>
              Follow the <em>evidence.</em>
            </h1>
          </div>
          <div className="workspace-meta">
            <span className="mono">
              {analysis && step < analysis.messages.length
                ? "REPLAY / LOCAL PREFIX CHECKS"
                : (analysis?.provenance.mode ?? mode) === "local"
                  ? "LOCAL RULE-BASED ANALYSIS"
                  : "OPENAI STRUCTURED EXTRACTION"}
            </span>
            <span>Indicators are not proof of fraud.</span>
          </div>
        </div>
        <a className="workspace-import-link" href="/investigate/import">
          Import a WhatsApp export or screenshots ↗
        </a>
        <div className="workspace-toolbar">
          <span className="mono">
            CONVERSATION → RELATIONSHIPS → ASSESSMENT
          </span>
          <div>
            <SaveInvestigation
              key={analysis?.provenance.analyzedAt ?? "empty"}
              analysis={analysis}
              text={text}
              initialTitle={restored?.title}
              onSaved={() =>
                setNotice(
                  "Investigation saved to your private account. Its conversation and report are now stored on the server.",
                )
              }
            />
            <button onClick={download} disabled={!analysis || busy}>
              Export evidence ↗
            </button>
            <button
              onClick={() => {
                invalidate();
                setText("");
                setSample("");
                setConsent(false);
                setNotice("Conversation and results cleared from this page.");
              }}
            >
              Clear session
            </button>
          </div>
        </div>
        <div className="workspace-grid">
          <section
            className="conversation-region"
            aria-labelledby="conversation-heading"
          >
            <div className="region-heading">
              <span className="mono">INPUT / 01</span>
              <h2 id="conversation-heading">Conversation</h2>
            </div>
            {analysis && (
              <ConversationTrace
                label={
                  sample
                    ? `SIMULATED CASE ${sample.toUpperCase()}`
                    : "SOURCE TRANSCRIPT"
                }
                analysis={analysis}
                step={step}
                selected={selected}
                onSelect={setSelected}
                onStep={(next) => {
                  setStep(next);
                  setSelected(null);
                }}
              />
            )}
            <details className="composer" open={!analysis || Boolean(error)}>
              <summary>
                {analysis
                  ? "Edit conversation / run again"
                  : "Prepare your conversation"}
                <span aria-hidden="true">↗</span>
              </summary>
              <div className="conversation-input">
                <label className="field-label" htmlFor="sample">
                  Explore a simulated case
                </label>
                <select
                  id="sample"
                  value={sample}
                  onChange={(e) => {
                    const s = samples.find((s) => s.id === e.target.value);
                    if (!s) {
                      changeText("");
                      document.getElementById("conversation")?.focus();
                      return;
                    }
                    invalidate();
                    setSample(s.id);
                    setText(s.text);
                    setNotice(
                      `Simulated case ${s.id.toUpperCase()} loaded. Run analysis to inspect its evidence.`,
                    );
                  }}
                >
                  <option value="">Your own conversation</option>
                  {samples.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id.toUpperCase()} / {s.title}
                    </option>
                  ))}
                </select>
                <button
                  className="own-conversation"
                  onClick={() => {
                    changeText("");
                    document.getElementById("conversation")?.focus();
                  }}
                >
                  Start with your own text <span aria-hidden="true">↗</span>
                </button>
                <div className="input-label-row">
                  <label className="field-label" htmlFor="conversation">
                    {sample ? "SIMULATED EXAMPLE" : "YOUR CONVERSATION"}
                  </label>
                  <button onClick={() => file.current?.click()}>
                    Upload .txt ↗
                  </button>
                </div>
                <textarea
                  id="conversation"
                  value={text}
                  maxLength={MAX_CHARS}
                  placeholder={
                    "Sender: Paste a message here.\nYou: Add the reply on a new line."
                  }
                  onChange={(e) => changeText(e.target.value)}
                  aria-describedby="input-help"
                  spellCheck={false}
                />
                <input
                  className="sr-only"
                  ref={file}
                  type="file"
                  accept=".txt,text/plain"
                  aria-label="Upload a text conversation"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (
                      !f.name.toLowerCase().endsWith(".txt") ||
                      f.size > 72000
                    ) {
                      setError(
                        "Choose a .txt file up to 72 KB, containing no more than 18,000 characters.",
                      );
                      e.target.value = "";
                      return;
                    }
                    try {
                      const value = await f.text();
                      if (value.length > MAX_CHARS) {
                        setError(
                          "The file has more than 18,000 characters. Shorten it and try again.",
                        );
                      } else changeText(value);
                    } catch {
                      setError(
                        "This file could not be read. Paste the text instead.",
                      );
                    }
                    e.target.value = "";
                  }}
                />
                <div className="input-details mono">
                  <span>{text.length.toLocaleString()} / 18,000</span>
                  <span>{messages.length} MESSAGES</span>
                </div>
                <p id="input-help" className="small-copy">
                  One message per line. Optional format: Sender: message.
                  Maximum 60 messages.
                </p>
                <button
                  className="redact-button"
                  onClick={() => {
                    const r = redact(text);
                    if (r.count) changeText(r.text);
                    setNotice(
                      `${r.count} common sensitive pattern${r.count === 1 ? "" : "s"} redacted locally. Review manually: names, addresses and all identifiers may remain.`,
                    );
                  }}
                >
                  Redact common sensitive data <span aria-hidden="true">↗</span>
                </button>
                <fieldset className="mode-field">
                  <legend>Analysis method</legend>
                  <label>
                    <input
                      type="radio"
                      name="mode"
                      value="local"
                      checked={mode === "local"}
                      onChange={() => setMode("local")}
                    />
                    <span>
                      Local checks
                      <small>Runs in this browser. No model call.</small>
                    </span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="mode"
                      value="openai"
                      checked={mode === "openai"}
                      onChange={() => setMode("openai")}
                    />
                    <span>
                      OpenAI + local checks
                      <small>
                        {status
                          ? `${status.model} · ${status.configured ? "server key configured" : "server key needed"}`
                          : "Checking server configuration…"}
                      </small>
                    </span>
                  </label>
                </fieldset>
                {mode === "openai" && (
                  <div className="consent-notice">
                    <p>
                      This sends the current text to this server and OpenAI.
                      Automated analysis can be incorrect. Redact sensitive
                      information first.{" "}
                      <a href="/privacy" target="_blank" rel="noreferrer">
                        Read privacy details ↗
                      </a>
                    </p>
                    <label>
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      I consent to sending this conversation to OpenAI.
                    </label>
                  </div>
                )}
                <button
                  className="button primary analyze-button"
                  disabled={
                    busy || !text.trim() || (mode === "openai" && !consent)
                  }
                  onClick={() => run()}
                >
                  {busy ? "ANALYZING EVIDENCE…" : "ANALYZE CONVERSATION"}
                  <span aria-hidden="true">↗</span>
                </button>
                {busy && (
                  <button
                    className="cancel-button"
                    onClick={() => {
                      requestGeneration.current++;
                      abort.current?.abort();
                      setBusy(false);
                      setNotice(
                        "Analysis canceled. Your input remains on this page.",
                      );
                    }}
                  >
                    Cancel analysis
                  </button>
                )}
                {error && (
                  <div role="alert" className="error-message">
                    <strong>Analysis needs attention</strong>
                    <p>{error}</p>
                    <button onClick={() => run()}>Retry analysis ↗</button>
                  </div>
                )}
              </div>
            </details>
            <div role="status" className="status-message">
              {notice}
            </div>
            <details className="message-history">
              <summary>
                Message history <span className="mono">{messages.length}</span>
              </summary>
              {messages.map((m) => (
                <div key={m.id} className="history-message">
                  <span className="mono">
                    {m.id.toUpperCase()} / {m.sender}
                  </span>
                  <p>{m.text}</p>
                  <button
                    disabled={busy}
                    onClick={() => run(`${m.sender}: ${m.text}`)}
                  >
                    Analyze this message ↗
                  </button>
                </div>
              ))}
            </details>
          </section>
          <section className="graph-region" aria-labelledby="graph-title">
            <div className="region-heading">
              <span className="mono">CONNECT / 02</span>
              <h2 id="graph-title" tabIndex={-1}>
                TrustGraph
              </h2>
            </div>
            <div className="graph-reserved" aria-busy={busy}>
              {analysis ? (
                <TrustGraph
                  key={analysis.provenance.analyzedAt}
                  analysis={current!}
                  layout={analysis}
                  selected={selected}
                  onSelect={selectEvidence}
                  scenario={scenario}
                />
              ) : busy ? (
                <div
                  className="analysis-skeleton"
                  aria-label="Analysis in progress"
                >
                  <div className="skeleton-line" />
                  <div className="skeleton-graph">
                    {Array.from({ length: 8 }, (_, i) => (
                      <span
                        key={i}
                        style={{
                          left: `${15 + (i % 3) * 30}%`,
                          top: `${20 + Math.floor(i / 3) * 25}%`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="mono">
                    EXTRACTING AND VALIDATING EVIDENCE
                  </span>
                  <p>The graph and report will appear here.</p>
                </div>
              ) : (
                <div className="graph-empty">
                  <svg
                    width="120"
                    height="110"
                    viewBox="0 0 120 110"
                    aria-hidden="true"
                  >
                    <path
                      d="M20 24L60 54 100 20M60 54l32 42m-32-42-43 35"
                      stroke="#65746a"
                      fill="none"
                    />
                    <g fill="#151819" stroke="#a7aea8">
                      <circle cx="20" cy="24" r="6" />
                      <circle cx="100" cy="20" r="6" />
                      <circle cx="92" cy="96" r="6" />
                      <circle cx="17" cy="89" r="6" />
                      <rect x="53" y="47" width="14" height="14" />
                    </g>
                  </svg>
                  <h3>
                    Every connection
                    <br />
                    <em>starts with evidence.</em>
                  </h3>
                  <p>
                    Analyze a conversation to build its graph.
                    <br />
                    Each node will link back to your input.
                  </p>
                  <span className="mono">NO RESULTS YET</span>
                </div>
              )}
            </div>
            <div className="counterfactual">
              <span className="mono">COUNTERFACTUAL EXPLORER</span>
              <h3>
                What <em>changes?</em>
              </h3>
              <label className="field-label" htmlFor="scenario">
                Apply a transparent assumption
              </label>
              <select
                id="scenario"
                value={scenario}
                disabled={!analysis}
                onChange={(e) => setScenario(e.target.value as Scenario)}
              >
                <option value="original">Original evidence</option>
                <option value="no-payment">
                  What if no payment was requested?
                </option>
                <option value="identity-confirmed">
                  What if the identity were confirmed?
                </option>
                <option value="domain-unrelated">
                  What if the domain were unrelated?
                </option>
                <option value="destination-confirmed">
                  What if the official destination were confirmed?
                </option>
                <option value="urgency-excluded">
                  What if the deadline were unsubstantiated?
                </option>
              </select>
              <p className={scenario !== "original" ? "scenario-notice" : ""}>
                {scenarioDescriptions[scenario]}
              </p>
              {assessment && (
                <div className="scenario-result" aria-live="polite">
                  <span className="mono">
                    {scenario === "original" ? "ORIGINAL" : "HYPOTHETICAL"}
                  </span>
                  <strong>{assessment.label}</strong>
                  <span>{visibleFindings.length} retained observations</span>
                </div>
              )}
            </div>
          </section>
          <section className="report-region" aria-labelledby="report-title">
            <div className="region-heading">
              <span className="mono">UNDERSTAND / 03</span>
              <h2 id="report-title">Intelligence report</h2>
            </div>
            <div
              className="report-tabs"
              role="tablist"
              aria-label="Report sections"
            >
              {(["summary", "evidence", "timeline"] as const).map((t) => (
                <button
                  key={t}
                  id={`tab-${t}`}
                  role="tab"
                  aria-selected={tab === t}
                  aria-controls="report-panel"
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => {
                    setTab(t);
                    setSelected(null);
                  }}
                  onKeyDown={(e) => {
                    const tabs = ["summary", "evidence", "timeline"] as const;
                    let i = tabs.indexOf(tab);
                    if (e.key === "ArrowRight") i = (i + 1) % 3;
                    else if (e.key === "ArrowLeft") i = (i + 2) % 3;
                    else if (e.key === "Home") i = 0;
                    else if (e.key === "End") i = 2;
                    else return;
                    e.preventDefault();
                    setTab(tabs[i]);
                    setSelected(null);
                    document.getElementById(`tab-${tabs[i]}`)?.focus();
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            {current && selected && (
              <EvidenceFocus
                analysis={current}
                selected={selected}
                scenario={scenario}
                onReveal={revealSource}
              />
            )}
            <div
              id="report-panel"
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              tabIndex={0}
              className="report-content"
              aria-busy={busy}
            >
              {!analysis ? (
                busy ? (
                  <div className="report-skeleton">
                    <span className="mono">PREPARING REPORT</span>
                    {Array.from({ length: 6 }, (_, i) => (
                      <div className="skeleton-line" key={i} />
                    ))}
                  </div>
                ) : (
                  <div className="report-empty">
                    <span className="mono">
                      {error ? "NO REPORT GENERATED" : "AWAITING ANALYSIS"}
                    </span>
                    <h3>
                      Clarity,
                      <br />
                      <em>with context.</em>
                    </h3>
                    <p>
                      {error
                        ? "The request did not complete. Your text is retained. Retry analysis or choose local checks."
                        : tab === "summary"
                          ? "Findings, uncertainty and protective steps will appear after you analyze the input."
                          : tab === "evidence"
                            ? "Exact quotations and links to their original messages will appear after analysis."
                            : "Chronological changes in the observed indicators will appear after analysis."}
                    </p>
                    <span>No verdict is assumed.</span>
                  </div>
                )
              ) : (
                <>
                  {tab === "summary" && (
                    <>
                      {current?.brief && scenario === "original" && (
                        <div className="conversation-brief">
                          <span className="mono">
                            CONVERSATION BRIEF / AI INTERPRETATION
                          </span>
                          <p>{current.brief.text}</p>
                          <div>
                            {current.brief.evidence.map((e, i) => (
                              <button
                                key={i}
                                onClick={() => revealSource(e.messageId)}
                              >
                                SOURCE {e.messageId.toUpperCase()} ↗
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div
                        className={`assessment-block ${assessment?.level === "elevated" ? "is-critical" : ""}`}
                      >
                        <span className="mono">
                          {scenario !== "original"
                            ? "HYPOTHETICAL ASSESSMENT"
                            : "OVERALL ASSESSMENT"}
                        </span>
                        <h3>{assessment?.label}</h3>
                        <p>{assessment?.summary}</p>
                      </div>
                      <div className="report-section">
                        <span className="mono">OBSERVED WARNING SIGNS</span>
                        {visibleFindings.filter(
                          (f) =>
                            !["trust", "claim", "identity"].includes(f.kind),
                        ).length ? (
                          [
                            ...new Set(
                              visibleFindings
                                .filter(
                                  (f) =>
                                    !["trust", "claim", "identity"].includes(
                                      f.kind,
                                    ),
                                )
                                .map((f) => f.kind),
                            ),
                          ].map((kind) => (
                            <button
                              className="finding-link"
                              key={kind}
                              onClick={() =>
                                selectEvidence(
                                  visibleFindings.find((f) => f.kind === kind)!
                                    .id,
                                )
                              }
                            >
                              <span>{kindLabels[kind]}</span>
                              <span aria-hidden="true">↗</span>
                            </button>
                          ))
                        ) : (
                          <p>
                            No high-consequence pattern detected by the
                            available checks.
                          </p>
                        )}
                      </div>
                      <div className="report-section">
                        <span className="mono">PROTECTIVE NEXT STEPS</span>
                        <ol className="recommendations">
                          {recommendations.length ? (
                            recommendations.map((recommendation) => (
                              <li key={recommendation}>{recommendation}</li>
                            ))
                          ) : (
                            <li>
                              Review the original conversation. Independently
                              confirm any future request for money, account
                              access or personal documents. No sender identity
                              has been verified.
                            </li>
                          )}
                        </ol>
                      </div>
                      <details className="report-details">
                        <summary>Potential next-stage risks</summary>
                        <p>
                          {visibleFindings.some((f) => f.kind === "credentials")
                            ? "Sharing authentication material can enable account access. If you already shared it, change the affected credentials through the official service and contact its support."
                            : visibleFindings.some((f) =>
                                  ["payment", "documents"].includes(f.kind),
                                )
                              ? "Acting on an unverified payment or document request may expose money or personal information. This is a possible consequence, not a prediction."
                              : "The next stage cannot be predicted from this exchange. New requests or evidence could change the assessment."}
                        </p>
                      </details>
                      <details className="report-details">
                        <summary>Unverified claims & uncertainty</summary>
                        {visibleFindings
                          .filter((f) => ["identity", "claim"].includes(f.kind))
                          .map((f) => (
                            <button
                              className="finding-link"
                              key={f.id}
                              onClick={() => setSelected(f.id)}
                            >
                              {f.title}
                              <span>↗</span>
                            </button>
                          ))}
                        <p>
                          No sender identity, institutional relationship, URL
                          reputation or destination ownership has been
                          independently verified.
                        </p>
                      </details>
                      <details className="report-details">
                        <summary>Method & limitations</summary>
                        <p>
                          {analysis.provenance.mode === "openai"
                            ? `Structured extraction by ${analysis.provenance.model}, supplemented by deterministic rules. Model interpretations are marked INFERRED.`
                            : "Deterministic English-language pattern checks run in this browser. They are limited and may miss context, other languages, subtle pressure or deceptive intent."}{" "}
                          Exact quotation checks establish presence in the text,
                          not truth.{" "}
                          {analysis.provenance.rejectedFindings > 0 &&
                            `${analysis.provenance.rejectedFindings} unsupported model findings were rejected.`}{" "}
                          No live websites were visited. No accuracy benchmark
                          or fraud probability is claimed.
                        </p>
                      </details>
                    </>
                  )}
                  {tab === "evidence" && (
                    <>
                      <div className="report-section">
                        <span className="mono">
                          {visibleFindings.length} TRACEABLE OBSERVATIONS
                        </span>
                        {visibleFindings.length === 0 && (
                          <p>
                            There are no extracted findings for this input.
                            Review the conversation directly.
                          </p>
                        )}
                        {visibleFindings.map((f) => (
                          <article className="evidence-finding" key={f.id}>
                            <span className="mono">
                              {f.classification} /{" "}
                              {f.source === "model" ? "MODEL" : "RULE"}
                            </span>
                            <button onClick={() => selectEvidence(f.id)}>
                              {f.title} ↗
                            </button>
                            <p>{f.explanation}</p>
                            {f.evidence.map((e, i) => (
                              <blockquote key={i}>
                                <cite className="mono">
                                  <button
                                    onClick={() => revealSource(e.messageId)}
                                    aria-label={`Show source message ${e.messageId.toUpperCase()}`}
                                  >
                                    {e.messageId.toUpperCase()} / SHOW MESSAGE ↗
                                  </button>
                                </cite>
                                “{e.quote}”
                              </blockquote>
                            ))}
                          </article>
                        ))}
                      </div>
                      {current!.destinations.length > 0 && (
                        <details open className="report-details">
                          <summary>Parsed destinations</summary>
                          {current!.destinations.map((d) => (
                            <div key={d.id} className="destination-detail">
                              <span className="mono">ACTUAL HOSTNAME</span>
                              <code>{d.hostname}</code>
                              <p>
                                Not visited. Ownership and reputation unknown.
                              </p>
                              <code>{d.raw}</code>
                            </div>
                          ))}
                        </details>
                      )}
                    </>
                  )}
                  {tab === "timeline" && (
                    <div className="timeline-report">
                      <span className="mono">CHRONOLOGICAL EVIDENCE</span>
                      <p>
                        Earlier steps run independent local checks on only those
                        messages. The complete conversation includes its AI
                        interpretation when available.
                      </p>
                      {analysis.timeline.map((t, i) => {
                        const prefix = throughMessage(analysis, i + 1);
                        const level = assess(prefix.findings, scenario);
                        return (
                          <button
                            key={t.messageId}
                            onClick={() => {
                              setStep(i + 1);
                              setSelected(t.messageId);
                            }}
                            className={
                              i < step && level.level === "elevated"
                                ? "is-critical"
                                : ""
                            }
                          >
                            <span className="mono">
                              {String(i + 1).padStart(2, "0")} /{" "}
                              {analysis.messages[i].sender}
                            </span>
                            <strong>
                              {i < step ? level.label : "Not included yet"}
                            </strong>
                            <span>
                              {i < step
                                ? `${prefix.findings.length} cumulative observations`
                                : "Select to include this message"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="report-provenance mono">
                    {current!.provenance.mode === "local"
                      ? "LOCAL RULES"
                      : current!.provenance.model}{" "}
                    / {current!.messages.length} MESSAGES
                    <br />
                    {scenario === "original"
                      ? "ORIGINAL EVIDENCE"
                      : "HYPOTHETICAL VIEW"}
                    {step < analysis.messages.length && (
                      <p>
                        REPLAY / PREFIX CHECKS
                        <br />
                        AI interpretation returns with the complete
                        conversation.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
        <div className="work-bottom">
          <span>
            Review evidence. Verify independently. Retain your judgment.
          </span>
          <nav aria-label="Workstation information">
            <a href="/methodology">Methodology</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
          </nav>
        </div>
      </main>
    </div>
  );
}
