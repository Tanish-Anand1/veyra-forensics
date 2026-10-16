import { useEffect, useRef } from "react";
import type { Analysis } from "../../shared/schema";
import { inspectSelection } from "../evidence";

export default function ConversationTrace({
  analysis,
  selected,
  onSelect,
  step = analysis.messages.length,
  onStep,
  label = "SOURCE TRANSCRIPT",
}: {
  analysis: Analysis;
  selected: string | null;
  onSelect: (id: string) => void;
  step?: number;
  onStep?: (step: number) => void;
  label?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const detail = inspectSelection(analysis, selected);
  const selectedIds = detail?.messageIds ?? [];
  const firstId = selectedIds[0];
  const previousStep = useRef(step);
  useEffect(() => {
    const targetId =
      firstId ??
      (previousStep.current !== step
        ? analysis.messages[step - 1]?.id
        : undefined);
    previousStep.current = step;
    const target = container.current?.querySelector<HTMLElement>(
      `[data-message="${targetId}"]`,
    );
    const panel = container.current;
    if (!target || !panel) return;

    panel.scrollTo({
      top:
        panel.scrollTop +
        target.getBoundingClientRect().top -
        panel.getBoundingClientRect().top -
        18,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [firstId, step, analysis.messages]);
  return (
    <div className="conversation-trace">
      <div className="trace-heading mono">
        <span>{label}</span>
        <span>
          {step} / {analysis.messages.length}
        </span>
      </div>
      <div className="trace-messages" ref={container}>
        {analysis.messages.map((m, i) => {
          const active = selectedIds.includes(m.id);
          const quotes =
            detail?.quotes
              .filter((e) => e.messageId === m.id)
              .map((e) => e.quote) ?? [];
          const quote = quotes[0];
          const at = quote ? m.text.indexOf(quote) : -1;
          return (
            <button
              key={m.id}
              data-message={m.id}
              className={`trace-message ${active ? "source-selected" : ""} ${i >= step ? "unrevealed" : ""}`}
              onClick={() => onSelect(m.id)}
              disabled={i >= step}
              aria-pressed={active}
            >
              <span className="trace-meta">
                <span className="mono">{m.id.toUpperCase()}</span>
                <strong>{m.sender}</strong>
                <span aria-hidden="true">↗</span>
              </span>
              <span className="trace-text">
                {active && at >= 0 ? (
                  <>
                    {m.text.slice(0, at)}
                    <mark>{quote}</mark>
                    {m.text.slice(at + quote!.length)}
                  </>
                ) : (
                  m.text
                )}
              </span>
              {active && (
                <span className="mono source-caption">LINKED EVIDENCE</span>
              )}
              {analysis.imported?.sources[m.id] && (
                <span className="trace-source">
                  {analysis.imported.sources[m.id].timestampLabel ||
                    "Timestamp not supplied"}
                  <br />
                  {analysis.imported.sources[m.id].sources
                    .map((s) =>
                      s.kind === "text"
                        ? `${s.name} · lines ${s.firstLine}–${s.lastLine}`
                        : `${s.name} · screenshot region`,
                    )
                    .join(" / ")}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {onStep && (
        <div className="replay-controls">
          <button
            aria-label="Previous message"
            disabled={step <= 1}
            onClick={() => onStep(step - 1)}
          >
            ←
          </button>
          <label className="mono" htmlFor="message-replay">
            MESSAGE {step}
          </label>
          <input
            id="message-replay"
            aria-label="Replay conversation through message"
            type="range"
            min="1"
            max={analysis.messages.length}
            value={step}
            onChange={(e) => onStep(Number(e.target.value))}
          />
          <button
            aria-label="Next message"
            disabled={step >= analysis.messages.length}
            onClick={() => onStep(step + 1)}
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
