import { useEffect, useMemo, useState } from "react";
import TrustGraph from "./components/TrustGraph";
import ConversationTrace from "./components/ConversationTrace";
import EvidenceFocus from "./components/EvidenceFocus";
import { edgeId, throughMessage } from "./evidence";
import { buildAnalysis, parseMessages } from "../shared/engine";
import { samples } from "../shared/samples";

export default function CaseStudy({
  startSignal = 0,
}: {
  startSignal?: number;
}) {
  const [step, setStep] = useState(1);
  const [selection, setSelection] = useState<string | null>(null);
  const [playing, setPlaying] = useState(startSignal > 0);
  const [replayNote, setReplayNote] = useState(
    "Step through the exchange. Follow the evidence as it arrives.",
  );
  const canonical = useMemo(
    () => buildAnalysis(parseMessages(samples[1].text)),
    [],
  );
  const analysis = useMemo(
    () => throughMessage(canonical, step),
    [canonical, step],
  );
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      const next = Math.min(step + 1, canonical.messages.length);
      const before = throughMessage(canonical, step);
      const after = throughMessage(canonical, next);
      setStep(next);
      if (
        before.assessment.level !== "elevated" &&
        after.assessment.level === "elevated"
      ) {
        const finding = after.findings.find((f) =>
          ["payment", "credentials", "documents"].includes(f.kind),
        );
        const connection = after.edges.find((e) => e.to === finding?.id);
        if (connection) setSelection(edgeId(connection));
        setPlaying(false);
        setReplayNote(
          "Request + pressure detected. Replay paused at the triggering evidence.",
        );
      } else if (next === canonical.messages.length) {
        setPlaying(false);
        setReplayNote(
          "Exchange complete. Select a connection to investigate its source.",
        );
      }
    }, 2100);
    return () => clearTimeout(timer);
  }, [playing, step, canonical]);
  const changeStep = (next: number) => {
    setPlaying(false);
    setSelection(null);
    setStep(next);
    setReplayNote(
      "Replay paused. Select a connection to investigate its source.",
    );
  };
  return (
    <section className="case-section" id="system" aria-labelledby="case-title">
      <div className="section-intro">
        <h2 id="case-title">
          The story changes.
          <br />
          <em>The evidence connects.</em>
        </h2>
        <div>
          <p>
            Follow a believable offer as it becomes a consequential request.
            Select any connection to see exactly what supports it.
          </p>
          <button
            className="text-link"
            onClick={() => {
              if (step === canonical.messages.length) setStep(1);
              setSelection(null);
              setPlaying((p) => !p);
              setReplayNote(
                playing
                  ? "Replay paused."
                  : "Replaying conversation. New evidence will build the graph.",
              );
            }}
          >
            {playing ? "PAUSE REPLAY Ⅱ" : "PLAY CONVERSATION ↗"}
          </button>
          <p className="replay-note mono" role="status">
            {replayNote}
          </p>
        </div>
      </div>
      <p className="demo-bar">
        Fictional scholarship conversation. Findings are computed in your
        browser.
      </p>
      <div className="case-layout">
        <ConversationTrace
          analysis={canonical}
          step={step}
          selected={selection}
          onSelect={(id) => {
            setPlaying(false);
            setSelection(id);
          }}
          onStep={changeStep}
        />
        <div className="case-graph">
          <TrustGraph
            analysis={analysis}
            layout={canonical}
            selected={selection}
            onSelect={(id) => {
              setPlaying(false);
              setSelection(id);
            }}
            compact
          />
          <div
            className={`case-assessment ${analysis.assessment.level === "elevated" ? "is-critical" : ""}`}
            aria-live="polite"
          >
            <span className="mono">THROUGH MESSAGE {step}</span>
            <h3>{analysis.assessment.label}</h3>
            <p>{analysis.assessment.summary}</p>
          </div>
        </div>
        <EvidenceFocus analysis={analysis} selected={selection} />
      </div>
    </section>
  );
}
