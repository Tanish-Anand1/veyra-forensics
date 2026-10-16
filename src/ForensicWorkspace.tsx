import { useEffect, useMemo, useState, useRef } from "react";
import { Header } from "./Layout";
import TrustGraph from "./components/TrustGraph";
import ConversationTrace from "./components/ConversationTrace";
import EvidenceFocus from "./components/EvidenceFocus";
import { throughMessage, edgeId, inspectSelection } from "./evidence";
import { assess } from "../shared/engine";
import { scenarioDescriptions, scenarioOptions } from "./scenarios";
import { SaveInvestigation } from "./Investigations";
import type { Analysis, Scenario } from "../shared/schema";
import "./forensics.css";

export default function ForensicWorkspace({
  initial,
  initialTitle = "",
  onNew,
}: {
  initial: Analysis;
  initialTitle?: string;
  onNew?: () => void;
}) {
  const metadata = initial.imported!;
  const [scenario, setScenario] = useState<Scenario>("original");
  const [step, setStep] = useState(initial.messages.length),
    [selected, setSelected] = useState<string | null>(null),
    [tab, setTab] = useState<"summary" | "evidence" | "timeline">("summary");
  const [playing, setPlaying] = useState(false),
    [pdfBusy, setPdfBusy] = useState(false),
    [notice, setNotice] = useState(
      "Analysis complete. Select a connection to trace its reviewed source.",
    );
  const current = useMemo(() => throughMessage(initial, step), [initial, step]);
  const reportPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    reportPanel.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [tab, selected]);
  const assessment = assess(current.findings, scenario);
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      setSelected(null);
      setStep((value) => {
        if (value >= initial.messages.length) {
          setPlaying(false);
          return value;
        }
        return value + 1;
      });
    }, 950);
    return () => clearTimeout(timer);
  }, [playing, step, initial.messages.length]);
  function select(id: string) {
    setSelected(id);
    setTab("evidence");
    setPlaying(false);
    if (window.innerWidth < 850)
      requestAnimationFrame(() =>
        document
          .querySelector(".forensic-report")
          ?.scrollIntoView({ block: "start", behavior: "instant" }),
      );
  }
  function reveal(id: string) {
    const relationship = initial.edges.find(
      (edge) =>
        edge.from === id && initial.findings.some((f) => f.id === edge.to),
    );
    setSelected(relationship ? edgeId(relationship) : id);
    const index = initial.messages.findIndex((m) => m.id === id);
    if (index >= step) setStep(index + 1);
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLButtonElement>(
        `[data-message="${id}"]`,
      );
      target?.focus({ preventScroll: true });
      if (window.innerWidth < 850)
        document
          .querySelector(".forensic-transcript")
          ?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  async function pdf() {
    setPdfBusy(true);
    setNotice("Preparing the PDF report locally…");
    try {
      const { downloadReportPDF } = await import("./report-pdf");
      await downloadReportPDF(
        initial,
        initialTitle || "Conversation investigation",
      );
      setNotice(
        "PDF exported with the analyzed message evidence attached as UTF-8 JSON. Original files are not included.",
      );
    } catch {
      setNotice(
        "The PDF could not be prepared. Your investigation is still available; retry or export the evidence JSON.",
      );
    } finally {
      setPdfBusy(false);
    }
  }
  function json() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(initial, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "veyra-investigation.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(
      "Evidence JSON exported. It contains the reviewed selection and source references; store it carefully.",
    );
  }
  const selectionDetail = inspectSelection(initial, selected);
  const selectedMessage = initial.messages.find(
    (m) => m.id === selected || m.id === selectionDetail?.messageIds[0],
  );
  const source = selectedMessage ? metadata.sources[selectedMessage.id] : null;
  return (
    <div className="forensic-workspace">
      <Header app />
      <main id="main" className="forensic-main">
        <div className="forensic-heading">
          <div>
            <span className="mono">
              CONVERSATION FORENSICS / INVESTIGATION WORKSPACE
            </span>
            <h1>
              Follow the <em>evidence.</em>
            </h1>
          </div>
          <span className="forensic-method mono">
            {initial.provenance.mode === "openai"
              ? `MODEL EXTRACTION / ${initial.provenance.model}`
              : "LOCAL RULES / NO TEXT MODEL CALL"}
          </span>
        </div>
        <div className="forensic-coverage">
          <strong>
            {initial.messages.length.toLocaleString()} of{" "}
            {metadata.totalMessages.toLocaleString()} messages analyzed
          </strong>
          <span>
            {metadata.segments} chronological segment
            {metadata.segments === 1 ? "" : "s"} · {initial.findings.length}{" "}
            grounded indicators
          </span>
          {initial.messages.length < metadata.totalMessages && (
            <p>
              Partial history.{" "}
              {metadata.totalMessages - initial.messages.length} messages were
              not analyzed. Findings describe only the reviewed selection.
            </p>
          )}
          <details>
            <summary>Selection and source notes</summary>
            <p>{metadata.selection}</p>
            <ul>
              {metadata.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </details>
        </div>
        <div className="forensic-toolbar">
          <div>
            <SaveInvestigation
              analysis={initial}
              text={initial.messages
                .map((m) => `${m.sender}: ${m.text}`)
                .join("\n")}
              initialTitle={initialTitle}
              onSaved={() =>
                setNotice(
                  "The reviewed selection, source references and report are now saved to your private account.",
                )
              }
            />
            <button onClick={pdf} disabled={pdfBusy}>
              {pdfBusy ? "Preparing PDF…" : "Export PDF ↗"}
            </button>
            <button onClick={json}>Export evidence ↗</button>
            <details className="forensic-assumptions">
              <summary>Counterfactual explorer</summary>
              <div className="counterfactual">
                <label htmlFor="import-scenario">
                  Apply a transparent assumption
                </label>
                <select
                  id="import-scenario"
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value as Scenario)}
                >
                  {scenarioOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className={scenario === "original" ? "" : "scenario-notice"}>
                  {scenarioDescriptions[scenario]}
                </p>
                <p role="status">
                  {scenario === "original"
                    ? "Original assessment"
                    : "Hypothetical assessment"}
                  : <strong>{assessment.label}</strong>. Saved reports and
                  exports always retain the original evidence.
                </p>
              </div>
            </details>
          </div>
          {onNew ? (
            <button onClick={onNew}>Start another import ↗</button>
          ) : (
            <a href="/investigate/import">New import ↗</a>
          )}
        </div>
        <div className="forensic-notice" role="status">
          {notice}
        </div>
        <div className="forensic-replay">
          <button
            onClick={() => {
              if (step === initial.messages.length) setStep(1);
              setPlaying((v) => !v);
              setSelected(null);
            }}
          >
            {playing ? "Pause replay Ⅱ" : "Replay conversation ▷"}
          </button>
          <button
            aria-label="Previous imported message"
            disabled={step <= 1}
            onClick={() => {
              setStep((v) => v - 1);
              setSelected(null);
              setPlaying(false);
            }}
          >
            ←
          </button>
          <label className="mono" htmlFor="forensic-replay">
            {step} / {initial.messages.length}
          </label>
          <input
            id="forensic-replay"
            aria-label="Replay imported conversation through message"
            type="range"
            min={1}
            max={initial.messages.length}
            value={step}
            onChange={(e) => {
              setStep(Number(e.target.value));
              setSelected(null);
              setPlaying(false);
            }}
          />
          <button
            aria-label="Next imported message"
            disabled={step >= initial.messages.length}
            onClick={() => {
              setStep((v) => v + 1);
              setSelected(null);
              setPlaying(false);
            }}
          >
            →
          </button>
          <span>
            {step < initial.messages.length
              ? "Replay applies local prefix rules; full-context model interpretations appear at completion."
              : "Full reviewed selection"}
          </span>
        </div>
        <div className="forensic-layout">
          <section
            className="forensic-transcript"
            aria-label="Reviewed conversation source"
          >
            <div className="region-heading">
              <span className="mono">SOURCE / 01</span>
              <h2>Conversation</h2>
            </div>
            <ConversationTrace
              analysis={initial}
              step={step}
              selected={selected}
              onSelect={select}
              label="REVIEWED IMPORT · ORIGINAL FILES NOT RETAINED"
            />
          </section>
          <section
            className="forensic-graph"
            aria-label="Evidence-linked TrustGraph"
          >
            <TrustGraph
              autoFocus
              analysis={current}
              layout={initial}
              selected={selected}
              onSelect={select}
              scenario={scenario}
            />
          </section>
          <section
            ref={reportPanel}
            className="forensic-report"
            aria-label="Investigation report"
          >
            <div
              className="forensic-tabs"
              role="tablist"
              aria-label="Imported report views"
            >
              {(["summary", "evidence", "timeline"] as const).map(
                (value, index) => (
                  <button
                    key={value}
                    id={`forensic-tab-${value}`}
                    role="tab"
                    aria-selected={tab === value}
                    aria-controls="forensic-report-panel"
                    tabIndex={tab === value ? 0 : -1}
                    onClick={() => setTab(value)}
                    onKeyDown={(e) => {
                      if (
                        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                          e.key,
                        )
                      ) {
                        e.preventDefault();
                        const items = [
                          "summary",
                          "evidence",
                          "timeline",
                        ] as const;
                        const next =
                          e.key === "Home"
                            ? 0
                            : e.key === "End"
                              ? 2
                              : (index + (e.key === "ArrowRight" ? 1 : 2)) % 3;
                        setTab(items[next]);
                        document
                          .getElementById(`forensic-tab-${items[next]}`)
                          ?.focus();
                      }
                    }}
                  >
                    {value}
                  </button>
                ),
              )}
            </div>
            <div
              id="forensic-report-panel"
              role="tabpanel"
              aria-labelledby={`forensic-tab-${tab}`}
            >
              {tab === "summary" && (
                <div className={`assessment-block ${assessment.level}`}>
                  <span className="mono">EVIDENCE ASSESSMENT</span>
                  <h2>{assessment.label}</h2>
                  <p>{assessment.summary}</p>
                  {scenario !== "original" && (
                    <p className="scenario-notice">
                      Hypothetical view. No independent verification has
                      occurred.
                    </p>
                  )}
                  <small>
                    Indicators are not proof of fraud. Identity and intent
                    remain unverified.
                  </small>
                </div>
              )}
              {scenario !== "original" && tab !== "summary" && (
                <p className="scenario-notice">
                  Hypothetical view. No independent verification has occurred.
                </p>
              )}
              {tab === "summary" ? (
                <div className="forensic-summary">
                  <h3>
                    {metadata.summaries.length > 1
                      ? "Chronological segment summaries"
                      : "Conversation summary"}
                  </h3>
                  {step < initial.messages.length ? (
                    <p>
                      Replay is showing only evidence available at this point.
                      Complete the replay to see full-context model summaries.
                    </p>
                  ) : metadata.summaries.length ? (
                    metadata.summaries.map((s) => (
                      <article key={s.segment}>
                        <span className="mono">
                          SEGMENT {s.segment} / MODEL INTERPRETATION
                        </span>
                        <p>{s.summary.text}</p>
                        <div className="summary-sources">
                          {s.summary.evidence.map((e, i) => (
                            <button key={i} onClick={() => reveal(e.messageId)}>
                              Source{" "}
                              {initial.messages.findIndex(
                                (m) => m.id === e.messageId,
                              ) + 1}{" "}
                              ↗
                            </button>
                          ))}
                        </div>
                      </article>
                    ))
                  ) : (
                    <p>
                      {initial.provenance.mode === "local"
                        ? "Local rules identify explicit textual patterns. No AI-generated summary was requested."
                        : "No supported narrative summary was returned. Inspect the cited evidence directly."}
                    </p>
                  )}
                  <h3>Uncertainties and limits</h3>
                  <p>
                    Speaker labels and timestamps came from an export or
                    user-reviewed screenshot transcription. No independent
                    identity, URL ownership or reputation verification was
                    performed. User edits and redactions may change context.
                  </p>
                  {Object.entries(metadata.sources)
                    .filter(([, s]) => s.uncertainties.length)
                    .slice(0, 20)
                    .map(([id, s]) => (
                      <div className="report-uncertainty" key={id}>
                        <button onClick={() => reveal(id)}>
                          Review source{" "}
                          {initial.messages.findIndex((m) => m.id === id) + 1} ↗
                        </button>
                        <ul>
                          {s.uncertainties.map((u, i) => (
                            <li key={i}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </div>
              ) : tab === "evidence" ? (
                <>
                  <EvidenceFocus
                    analysis={current}
                    selected={selected}
                    scenario={scenario}
                    onReveal={reveal}
                  />
                  {source && (
                    <div className="forensic-source-detail">
                      <h3>Original source reference</h3>
                      <p>{source.timestampLabel || "Timestamp not supplied"}</p>
                      {source.sources.map((item, i) => (
                        <p key={i}>
                          {item.name}
                          <br />
                          {item.kind === "text"
                            ? `Lines ${item.firstLine}–${item.lastLine}`
                            : `Image ${item.imageId}, region ${item.region?.map((n) => Math.round(n * 100)).join("%, ")}%`}
                        </p>
                      ))}
                      <p>
                        Displayed text is the confirmed reconstruction. Original
                        files and image pixels are not retained in this report.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <ol className="forensic-timeline">
                  {initial.timeline.slice(0, step).map((point, index) => {
                    const findings = point.findings.filter((id) =>
                      current.findings.some((f) => f.id === id),
                    );
                    return (
                      <li key={point.messageId}>
                        <button
                          onClick={() => {
                            const finding = findings[0];
                            const connection = initial.edges.find(
                              (e) =>
                                e.from === point.messageId && e.to === finding,
                            );
                            select(
                              connection ? edgeId(connection) : point.messageId,
                            );
                          }}
                        >
                          <span className="mono">
                            {String(index + 1).padStart(3, "0")} /{" "}
                            {metadata.sources[point.messageId]
                              ?.timestampLabel || "TIME UNSUPPLIED"}
                          </span>
                          <strong>{initial.messages[index].sender}</strong>
                          <span>
                            {findings.length
                              ? findings
                                  .map(
                                    (id) =>
                                      current.findings.find((f) => f.id === id)!
                                        .title,
                                  )
                                  .join(" · ")
                              : "No new grounded indicator at this point"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
