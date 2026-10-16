import { useEffect, useState } from "react";
import { useAuth } from "./session";
import { Header } from "./Layout";
import Workstation from "./Workstation";
import type { Analysis } from "../shared/schema";
import { isAnalysis } from "./evidence";
import ForensicWorkspace from "./ForensicWorkspace";
import { appLocation, navigate } from "./navigation";
import { removeSession } from "./browser-storage";

export type SavedReport = { text: string; analysis: Analysis; title: string };
const pendingKey = "chainbreak-pending-save";
export function pendingReport(): SavedReport | null {
  if (new URLSearchParams(appLocation().search).get("resume") !== "1")
    return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
    if (
      value &&
      value.expires > Date.now() &&
      typeof value.text === "string" &&
      value.text.length <= (value.analysis?.imported ? 100_000 : 18_000) &&
      isAnalysis(value.analysis)
    )
      return value;
    sessionStorage.removeItem(pendingKey);
  } catch {
    return null;
  }
  return null;
}
export function clearPending() {
  removeSession(pendingKey);
}

export function SaveInvestigation({
  analysis,
  text,
  initialTitle = "",
  onSaved,
}: {
  analysis: Analysis | null;
  text: string;
  initialTitle?: string;
  onSaved?: () => void;
}) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(
    initialTitle || `Investigation · ${new Date().toLocaleDateString()}`,
  );
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  async function save() {
    if (!analysis || !consent || !title.trim()) return;
    setBusy(true);
    setError("");
    if (!auth.user || auth.error) {
      try {
        sessionStorage.setItem(
          pendingKey,
          JSON.stringify({
            text,
            analysis,
            title,
            expires: Date.now() + 30 * 60 * 1000,
          }),
        );
        navigate(
          analysis.imported
            ? "/login?next=%2Finvestigate%2Fimport%3Fresume%3D1"
            : "/login?next=%2Fanalyze%3Fresume%3D1",
        );
      } catch {
        setError(
          "This browser blocked temporary storage. Export your evidence before signing in, or enable session storage and retry.",
        );
        setBusy(false);
      }
      return;
    }
    try {
      const model =
        analysis.provenance.mode === "openai"
          ? analysis.provenance.model
          : undefined;
      const response = await fetch("/api/investigations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(analysis.imported
            ? {
                kind: "imported",
                messages: analysis.messages,
                imported: analysis.imported,
              }
            : {}),
          title: title.trim(),
          ...(!analysis.imported ? { text } : {}),
          analyzedAt: analysis.provenance.analyzedAt,
          ...(model
            ? {
                model,
                extraction: {
                  summary: analysis.brief ?? null,
                  findings: analysis.findings
                    .filter((f) => f.source === "model")
                    .map(({ kind, title, explanation, evidence }) => ({
                      kind,
                      title,
                      explanation,
                      evidence,
                    })),
                },
              }
            : {}),
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        await auth.refresh();
        throw new Error(
          "Your session has ended. Your report is still here. Sign in again to save it.",
        );
      }
      if (!response.ok)
        throw new Error(
          data.error || "The investigation could not be saved. Please retry.",
        );
      setSaved(data.id);
      clearPending();
      setOpen(false);
      onSaved?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="save-control">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!analysis || busy || Boolean(saved)}
        aria-expanded={open}
        aria-controls="save-investigation"
      >
        {saved ? "Investigation saved ✓" : "Save investigation"}
      </button>
      {saved && (
        <a className="saved-record-link" href={`/investigations/${saved}`}>
          Open saved report ↗
        </a>
      )}
      {open && analysis && (
        <section
          id="save-investigation"
          className="save-panel"
          aria-labelledby="save-title"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) {
              setOpen(false);
              e.currentTarget.parentElement?.querySelector("button")?.focus();
            }
          }}
        >
          <h2 id="save-title">Keep this investigation.</h2>
          <label htmlFor="investigation-title">Investigation title</label>
          <input
            id="investigation-title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label className="save-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              {auth.user
                ? "Save this conversation and report to my private account. I can delete them from my history."
                : "Keep this report temporarily in this browser tab while I sign in (up to 30 minutes). I will confirm before it is saved to my account."}
            </span>
          </label>
          {auth.error && <p role="alert">{auth.error}</p>}
          {error && <p role="alert">{error}</p>}
          <div>
            <button
              className="button primary"
              disabled={busy || !consent || !title.trim() || auth.loading}
              onClick={() => void save()}
            >
              {busy
                ? "Saving…"
                : auth.user && !auth.error
                  ? "Save to my account ↗"
                  : "Sign in and keep report ↗"}
            </button>
            <button disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export function SavedInvestigationPage({ id }: { id: string }) {
  const auth = useAuth();
  const { user, loading, error: sessionError, refresh } = auth;
  const [record, setRecord] = useState<
    (SavedReport & { owner: string }) | null
  >(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (loading || sessionError) return;
    if (!user) {
      navigate(
        `/login?next=${encodeURIComponent(`/investigations/${id}`)}&error=SessionRequired`,
        { replace: true },
      );
      return;
    }
    const controller = new AbortController();
    fetch(`/api/investigations/${encodeURIComponent(id)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          await refresh();
          return;
        }
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "The investigation could not be loaded.",
          );
        if (!isAnalysis(data.analysis))
          throw new Error("This saved report could not be read.");
        setRecord({
          text: data.source_text,
          analysis: data.analysis,
          title: data.title,
          owner: user.id,
        });
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [id, user, loading, sessionError, refresh, retry]);
  if (record && record.owner === auth.user?.id && !auth.error)
    return record.analysis.imported ? (
      <ForensicWorkspace
        key={id}
        initial={record.analysis}
        initialTitle={record.title}
      />
    ) : (
      <Workstation key={id} initial={record} />
    );
  return (
    <>
      <Header app />
      <main id="main" className="information">
        <span className="mono">PRIVATE INVESTIGATION</span>
        <h1>
          Return to <em>the evidence.</em>
        </h1>
        <p role={error || auth.error ? "alert" : "status"}>
          {error || auth.error || "Opening your saved investigation…"}
        </p>
        {(error || auth.error) && (
          <button
            className="button primary"
            onClick={() => {
              void auth.refresh();
              setRetry((v) => v + 1);
            }}
          >
            Retry ↗
          </button>
        )}
        <a className="text-link" href="/history">
          Back to history ↗
        </a>
      </main>
    </>
  );
}
