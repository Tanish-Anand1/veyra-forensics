import type { Analysis, Scenario } from "../../shared/schema";
import { inspectSelection } from "../evidence";
import { scenarioFindings } from "../../shared/engine";

export default function EvidenceFocus({
  analysis,
  selected,
  scenario = "original",
  onReveal,
}: {
  analysis: Analysis;
  selected: string | null;
  scenario?: Scenario;
  onReveal?: (messageId: string) => void;
}) {
  const detail = inspectSelection(analysis, selected);
  const excluded =
    detail?.finding &&
    !scenarioFindings(analysis.findings, scenario).some(
      (f) => f.id === detail.finding!.id,
    );
  return (
    <section
      className={`node-inspector ${detail ? "has-selection" : ""}`}
      aria-label="Selected evidence"
      aria-live="polite"
    >
      <div className="panel-bar mono">
        <span>
          {detail?.edge ? "CONNECTION INSPECTOR" : "EVIDENCE INSPECTOR"}
        </span>
        <span>{detail?.node.classification ?? "SELECT A CONNECTION"}</span>
      </div>
      {detail ? (
        <>
          <div className="inspection-body">
            <span className="mono inspection-kicker">
              {detail.edge
                ? `${detail.edge.from.toUpperCase()} → ${detail.edge.to.toUpperCase()}`
                : detail.node.type.toUpperCase()}
            </span>
            <h3 tabIndex={-1}>{detail.node.label}</h3>
            {excluded && (
              <p className="scenario-notice">
                Excluded from this hypothetical assessment. Original evidence
                remains below.
              </p>
            )}
            <span className="mono">EXACT SOURCE</span>
            {detail.quotes.map((e, i) => (
              <blockquote key={`${e.messageId}-${i}`}>
                <cite className="mono">
                  {onReveal ? (
                    <button
                      className="source-reference"
                      onClick={() => onReveal(e.messageId)}
                      aria-label={`Show source message ${e.messageId.toUpperCase()}`}
                    >
                      {e.messageId.toUpperCase()} ↗
                    </button>
                  ) : (
                    e.messageId.toUpperCase()
                  )}{" "}
                  /{" "}
                  {analysis.messages.find((m) => m.id === e.messageId)?.sender}
                </cite>
                “
                {analysis.messages.find((m) => m.id === e.messageId)?.text ??
                  e.quote}
                ”
              </blockquote>
            ))}
            <div className="inspection-reason">
              <span className="mono">WHY IT MATTERS</span>
              <p>{detail.node.detail}</p>
            </div>
            <div className="protective-action">
              <span className="mono">PROTECTIVE ACTION ↗</span>
              <p>{detail.action}</p>
            </div>
            <p className="inspection-limit">
              {detail.finding?.source === "model"
                ? "Model interpretation. Quotation presence validated; meaning may be incorrect."
                : "Text-based observation. Identity, intent and legitimacy remain unverified."}
            </p>
          </div>
        </>
      ) : (
        <div className="inspection-body inspection-empty">
          <span className="inspection-number" aria-hidden="true">
            03
          </span>
          <h3>
            Trace it
            <br />
            <em>to the source.</em>
          </h3>
          <p>
            Select a connection or observation. Its exact message, reasoning and
            protective action appear here.
          </p>
          <span className="mono">EVIDENCE BEFORE CERTAINTY</span>
        </div>
      )}
    </section>
  );
}
