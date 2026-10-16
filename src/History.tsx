import { useCallback, useEffect, useState } from "react";
import { Header } from "./Layout";
import { useAuth } from "./session";
import { navigate } from "./navigation";

type RecordSummary = {
  id: string;
  title: string;
  created_at: string;
  assessment: string;
};
export function HistoryPage() {
  const auth = useAuth();
  const { user, refresh } = auth;
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [owner, setOwner] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [updating, setUpdating] = useState(false);
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch("/api/investigations");
      const data = await response.json();
      if (response.status === 401) {
        await refresh();
        return;
      }
      if (!response.ok)
        throw new Error(data.error || "History could not be loaded.");
      setRecords(data.investigations);
      setOwner(user.id);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user, refresh]);
  useEffect(() => {
    if (!auth.loading && !auth.user && !auth.error)
      navigate("/login?next=%2Fhistory&error=SessionRequired", {
        replace: true,
      });
  }, [auth.loading, auth.user, auth.error]);
  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    return () => clearTimeout(initial);
  }, [load]);
  async function remove(id: string) {
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/investigations/${id}`, {
        method: "DELETE",
      });
      if (response.status === 401) {
        await auth.refresh();
        return;
      }
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Deletion failed. Please retry.",
        );
      setRecords((r) => r.filter((v) => v.id !== id));
      setPending(null);
      setNotice("Investigation permanently deleted.");
      document.getElementById("history-title")?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }
  async function rename(id: string) {
    setUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/investigations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (response.status === 401) {
        await auth.refresh();
        return;
      }
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Rename failed. Please retry.");
      setRecords((items) =>
        items.map((item) =>
          item.id === id ? { ...item, title: data.title } : item,
        ),
      );
      setRenaming(null);
      setNotice("Investigation renamed.");
      document.getElementById("history-title")?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUpdating(false);
    }
  }
  return (
    <>
      <Header app />
      <main id="main" className="history-page">
        <div className="history-heading">
          <div>
            <span className="mono">YOUR PRIVATE WORKSPACE</span>
            <h1 id="history-title" tabIndex={-1}>
              Follow your <em>threads.</em>
            </h1>
            <p>Saved evidence. A fresh perspective whenever you return.</p>
          </div>
          <a className="button primary" href="/analyze">
            New investigation ↗
          </a>
        </div>
        {auth.error ? (
          <p role="alert">
            {auth.error}{" "}
            <button className="text-link" onClick={() => void auth.refresh()}>
              Retry ↗
            </button>
          </p>
        ) : auth.loading || !auth.user || loading || owner !== auth.user.id ? (
          <p role="status">Opening your workspace…</p>
        ) : (
          <>
            <div className="archive-bar mono">
              <span>{records.length} / 100 SAVED INVESTIGATIONS</span>
              <span>VISIBLE ONLY TO YOUR ACCOUNT</span>
            </div>
            {records.length ? (
              <ol className="investigation-list">
                {records.map((record, i) => (
                  <li key={record.id}>
                    <span className="archive-number mono">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <a
                      className="archive-record"
                      href={`/investigations/${record.id}`}
                    >
                      <h2>{record.title}</h2>
                      <span>
                        {record.assessment} ·{" "}
                        {new Date(record.created_at).toLocaleDateString(
                          undefined,
                          { year: "numeric", month: "short", day: "numeric" },
                        )}
                      </span>
                    </a>
                    {renaming === record.id ? (
                      <form
                        className="history-rename"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void rename(record.id);
                        }}
                      >
                        <label
                          className="sr-only"
                          htmlFor={`rename-${record.id}`}
                        >
                          New investigation title
                        </label>
                        <input
                          id={`rename-${record.id}`}
                          value={newTitle}
                          maxLength={120}
                          disabled={updating}
                          onChange={(e) => setNewTitle(e.target.value)}
                        />
                        <button
                          type="submit"
                          disabled={updating || !newTitle.trim()}
                        >
                          {updating ? "Renaming…" : "Save title"}
                        </button>
                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => setRenaming(null)}
                        >
                          Cancel rename
                        </button>
                      </form>
                    ) : (
                      <button
                        className="archive-rename"
                        aria-label={`Rename ${record.title}`}
                        onClick={() => {
                          setRenaming(record.id);
                          setNewTitle(record.title);
                          setPending(null);
                          requestAnimationFrame(() =>
                            document
                              .getElementById(`rename-${record.id}`)
                              ?.focus(),
                          );
                        }}
                      >
                        Rename
                      </button>
                    )}
                    {pending === record.id ? (
                      <div className="archive-delete">
                        <span id={`delete-${record.id}`}>
                          Delete this investigation permanently?
                        </span>
                        <button
                          onClick={() => void remove(record.id)}
                          disabled={deleting}
                          aria-describedby={`delete-${record.id}`}
                        >
                          {deleting ? "Deleting…" : "Confirm delete"}
                        </button>
                        <button
                          disabled={deleting}
                          onClick={() => setPending(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="archive-remove"
                        onClick={() => setPending(record.id)}
                        aria-label={`Delete ${record.title}`}
                      >
                        Delete
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="archive-empty">
                <span className="mono">NO THREADS SAVED YET</span>
                <h2>
                  A little distance.
                  <br />
                  <em>A clearer picture.</em>
                </h2>
                <p>
                  Run an analysis, then choose Save investigation. Your messages
                  are stored only when you choose to save.
                </p>
                <a className="text-link" href="/analyze">
                  Open the workstation ↗
                </a>
              </div>
            )}
          </>
        )}
        {error && (
          <p role="alert">
            {error}{" "}
            <button className="text-link" onClick={() => void load()}>
              Retry ↗
            </button>
          </p>
        )}
        <p role="status">{notice}</p>
      </main>
    </>
  );
}
