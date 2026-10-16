import {
  useEffect,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import type { Analysis, Scenario } from "../../shared/schema";
import { scenarioFindings } from "../../shared/engine";
import { edgeId } from "../evidence";

type Point = { x: number; y: number; z: number };
const curve = (a: Point, b: Point) =>
  `M${a.x + 17} ${a.y}C${(a.x + b.x) / 2} ${a.y},${(a.x + b.x) / 2} ${b.y},${b.x - 22} ${b.y}`;
function graphLabel(title: string, limit = 19) {
  const words = title.split(" ");
  const lines = [""];
  for (const word of words) {
    if (
      lines[lines.length - 1].length + word.length > limit &&
      lines[lines.length - 1]
    )
      lines.push("");
    lines[lines.length - 1] += (lines[lines.length - 1] ? " " : "") + word;
  }
  return lines
    .slice(0, 2)
    .map((line, i) =>
      line.length > limit + 2
        ? line.slice(0, limit) + "…"
        : i === 1 && lines.length > 2
          ? line + "…"
          : line,
    );
}
type GraphProps = {
  analysis: Analysis;
  layout?: Analysis;
  selected: string | null;
  onSelect: (id: string) => void;
  scenario?: Scenario;
  compact?: boolean;
  narrow?: boolean;
  autoFocus?: boolean;
};

function chapter(source: Analysis, messageIds: Set<string>): Analysis {
  const findings = source.findings.filter((finding) =>
    finding.evidence.some((e) => messageIds.has(e.messageId)),
  );
  const included = new Set([
    ...messageIds,
    ...findings.flatMap((f) => f.evidence.map((e) => e.messageId)),
  ]);
  const findingIds = new Set(findings.map((finding) => finding.id));
  const nodes = source.nodes
    .filter((node) =>
      node.findingId
        ? findingIds.has(node.findingId)
        : node.messageIds.some((id) => included.has(id)),
    )
    .map((node) => ({
      ...node,
      messageIds: node.messageIds.filter((id) => included.has(id)),
    }));
  const nodeIds = new Set(nodes.map((node) => node.id));
  return {
    ...source,
    findings,
    nodes,
    messages: source.messages.filter((m) => included.has(m.id)),
    edges: source.edges.filter(
      (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to),
    ),
  };
}

export default function TrustGraph(props: GraphProps) {
  const layout = props.layout ?? props.analysis;
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 600px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const pageSize = mobile ? 1 : 6;
  const [navigation, setNavigation] = useState({
    page: mobile ? props.analysis.messages.length - 1 : 0,
    selection: props.selected,
    step: props.analysis.messages.length,
  });
  const [overview, setOverview] = useState(false);
  const long = layout.messages.length > (mobile ? 1 : 10);
  const edge = layout.edges.find((item) => edgeId(item) === props.selected);
  const selectedNode = layout.nodes.find(
    (node) => node.id === (edge?.to ?? props.selected),
  );
  const index = layout.messages.findIndex((m) =>
    selectedNode?.messageIds.includes(m.id),
  );
  const maxPage = Math.max(
    0,
    Math.ceil(props.analysis.messages.length / pageSize) - 1,
  );
  const page = Math.min(
    maxPage,
    props.selected !== navigation.selection && index >= 0
      ? Math.floor(index / pageSize)
      : mobile && navigation.step !== props.analysis.messages.length
        ? maxPage
        : navigation.page,
  );
  const windowIds = new Set(
    layout.messages
      .slice(page * pageSize, page * pageSize + pageSize)
      .map((m) => m.id),
  );
  return (
    <div className="graph-window">
      {long && (
        <div className="graph-chapters" aria-label="Graph message chapters">
          <div>
            <span className="mono">
              {overview
                ? "WHOLE CONVERSATION"
                : mobile
                  ? `MESSAGE ${page + 1} / ${props.analysis.messages.length}`
                  : `MESSAGES ${page * pageSize + 1}–${Math.min(page * pageSize + pageSize, props.analysis.messages.length)} / ${props.analysis.messages.length}`}
            </span>
            <span>Cross-message evidence stays connected.</span>
          </div>
          {!overview && (
            <>
              <button
                aria-label="Previous graph chapter"
                disabled={page === 0}
                onClick={() =>
                  setNavigation({
                    page: page - 1,
                    selection: props.selected,
                    step: props.analysis.messages.length,
                  })
                }
              >
                ←
              </button>
              <button
                aria-label="Next graph chapter"
                disabled={page >= maxPage}
                onClick={() =>
                  setNavigation({
                    page: page + 1,
                    selection: props.selected,
                    step: props.analysis.messages.length,
                  })
                }
              >
                →
              </button>
            </>
          )}
          <button onClick={() => setOverview((value) => !value)}>
            {overview ? "Readable chapters" : "Whole graph"}
          </button>
        </div>
      )}
      <GraphCanvas
        key={`${page}-${overview}-${mobile}`}
        {...props}
        narrow={mobile}
        analysis={
          long && !overview
            ? chapter(props.analysis, windowIds)
            : props.analysis
        }
        layout={long && !overview ? chapter(layout, windowIds) : layout}
      />
    </div>
  );
}

function GraphCanvas({
  analysis,
  layout = analysis,
  selected,
  onSelect,
  scenario = "original",
  compact = false,
  narrow = false,
  autoFocus = false,
}: GraphProps) {
  const [angle, setAngle] = useState(0);
  const drag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    ratio: number;
  } | null>(null);
  const stage = useRef<SVGGElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  const seenEdges = useRef(new Set<string>());
  const previousProjection = useRef(new Map<string, Point>());
  const uid = useId().replace(/:/g, "");
  const active = new Set(
    scenarioFindings(analysis.findings, scenario).map((f) => f.id),
  );
  const positions = useMemo(() => {
    const result = new Map<string, Point>();
    if (narrow) {
      const sources = layout.nodes.filter((node) =>
        node.id.startsWith("sender"),
      );
      const messages = layout.nodes.filter((node) => node.type === "message");
      const observations = layout.nodes.filter(
        (node) => !node.id.startsWith("sender") && node.type !== "message",
      );
      sources.forEach((node, i) =>
        result.set(node.id, { x: 65, y: 85 + i * 85, z: 30 }),
      );
      messages.forEach((node, i) =>
        result.set(node.id, {
          x: 65,
          y: 220 + sources.length * 25 + i * 100,
          z: 0,
        }),
      );
      observations.forEach((node, i) =>
        result.set(node.id, { x: 300, y: 100 + i * 95, z: -20 }),
      );
      return {
        points: result,
        height: Math.max(
          660,
          120 + observations.length * 95,
          270 + messages.length * 100 + sources.length * 25,
        ),
      };
    }
    const groups = [
      layout.nodes.filter((n) => n.id.startsWith("sender")),
      layout.nodes.filter((n) => n.type === "message"),
      layout.nodes.filter(
        (n) =>
          !n.id.startsWith("sender") &&
          ["identity", "tactic", "claim"].includes(n.type),
      ),
      layout.nodes.filter((n) => n.type === "action"),
      layout.nodes.filter((n) => n.type === "destination"),
    ];
    const height = Math.max(660, ...groups.map((g) => g.length * 82));
    groups.forEach((group, column) =>
      group.forEach((n, i) => {
        const z = [70, 0, -55, 55, -100][column];
        result.set(n.id, {
          x: [100, 310, 550, 790, 740][column],
          y:
            column === 4
              ? height - 15 + i * 82
              : 65 + (i + 0.5) * ((height - 170) / Math.max(group.length, 1)),
          z,
        });
      }),
    );
    return { points: result, height: height + 40 };
  }, [layout, narrow]);
  const canvasWidth = narrow ? 600 : 1000;
  const fittedZoom = Math.min(1, 700 / positions.height);
  const [zoom, setZoom] = useState(fittedZoom);
  const [pan, setPan] = useState({
    x: (canvasWidth - canvasWidth * fittedZoom) / 2,
    y: 0,
  });
  const projected = useMemo(
    () =>
      new Map(
        [...positions.points].map(([id, p]) => {
          const center = canvasWidth / 2;
          const x = p.x - center;
          const z = p.z + Math.sin(angle) * x;
          return [
            id,
            {
              x:
                center +
                x * Math.cos(angle) +
                p.z * Math.sin(angle) +
                p.z * 0.16,
              y: p.y - z * 0.3,
              z,
            },
          ];
        }),
      ),
    [positions, angle, canvasWidth],
  );
  const selectedEdge = analysis.edges.find((e) => edgeId(e) === selected);
  const anchors = selectedEdge
    ? [selectedEdge.from, selectedEdge.to]
    : selected
      ? [selected]
      : [];
  const connected = new Set([
    ...anchors,
    ...analysis.edges
      .filter((e) => anchors.includes(e.from) || anchors.includes(e.to))
      .flatMap((e) => [e.from, e.to]),
  ]);
  useLayoutEffect(() => {
    if (!stage.current) return;
    const motion = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    const fresh = [
      ...stage.current.querySelectorAll<SVGGElement>("[data-node]"),
    ].filter((el) => !seen.current.has(el.dataset.node!));
    fresh.forEach((el) => seen.current.add(el.dataset.node!));
    const freshEdges = [
      ...stage.current.querySelectorAll<SVGGElement>("[data-edge]"),
    ].filter((el) => !seenEdges.current.has(el.dataset.edge!));
    freshEdges.forEach((el) => seenEdges.current.add(el.dataset.edge!));
    const previous = previousProjection.current;
    previousProjection.current = projected;
    const context = gsap.context(() => {
      if (motion) {
        freshEdges.forEach((edge, i) =>
          gsap.fromTo(
            edge.querySelector(".graph-edge"),
            { strokeDasharray: 1, strokeDashoffset: 1 },
            {
              strokeDashoffset: 0,
              duration: 0.6,
              delay: i * Math.min(0.025, 0.5 / Math.max(1, freshEdges.length)),
              clearProps: "strokeDasharray,strokeDashoffset",
            },
          ),
        );
        if (previous.size && previous !== projected) {
          stage
            .current!.querySelectorAll<SVGGElement>("[data-node]")
            .forEach((el) => {
              const a = previous.get(el.dataset.node!);
              const b = projected.get(el.dataset.node!);
              if (a && b)
                gsap.fromTo(
                  el,
                  { attr: { transform: `translate(${a.x} ${a.y})` } },
                  {
                    attr: { transform: `translate(${b.x} ${b.y})` },
                    duration: 0.5,
                    ease: "power2.inOut",
                  },
                );
            });
          analysis.edges.forEach((edge) => {
            const a = previous.get(edge.from);
            const b = previous.get(edge.to);
            const nextA = projected.get(edge.from)!;
            const nextB = projected.get(edge.to)!;
            const el = [
              ...stage.current!.querySelectorAll<SVGGElement>("[data-edge]"),
            ].find((item) => item.dataset.edge === edgeId(edge));
            if (a && b && el)
              gsap.fromTo(
                el.querySelectorAll("path"),
                { attr: { d: curve(a, b) } },
                {
                  attr: { d: curve(nextA, nextB) },
                  duration: 0.5,
                  ease: "power2.inOut",
                },
              );
          });
        }
      }
      if (motion && fresh.length)
        gsap.fromTo(
          fresh,
          { opacity: 0 },
          {
            opacity: 1,
            duration: 0.6,
            stagger: Math.min(0.035, 0.5 / fresh.length),
            clearProps: "opacity",
          },
        );
      gsap.to(stage.current, {
        attr: { transform: `translate(${pan.x} ${pan.y}) scale(${zoom})` },
        duration: motion ? 0.28 : 0,
        ease: "power2.out",
        overwrite: true,
      });
    }, surface);
    return () => context.revert();
  }, [analysis, zoom, pan, projected]);
  const focus = useCallback(
    (id: string | null) => {
      const edge = analysis.edges.find((item) => edgeId(item) === id);
      const points = (edge ? [edge.from, edge.to] : [id || ""])
        .map((key) => projected.get(key))
        .filter((point): point is Point => Boolean(point));
      if (!points.length || !surface.current) return;
      const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
      const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
      const distance =
        points.length > 1 ? Math.abs(points[1].x - points[0].x) : 0;
      const nextZoom = Math.min(
        1.35,
        (canvasWidth * 0.7) / Math.max(1, distance),
      );
      setZoom(nextZoom);
      const svg = surface
        .current!.querySelector("svg")!
        .getBoundingClientRect();
      const viewport = surface
        .current!.querySelector(".graph-stage")!
        .getBoundingClientRect();
      const ratio = Math.min(svg.width / canvasWidth, svg.height / 760);
      setPan({
        x:
          (viewport.left + viewport.width / 2 - svg.left) / ratio -
          x * nextZoom,
        y: viewport.height / 2 / ratio - y * nextZoom,
      });
    },
    [analysis.edges, projected, canvasWidth],
  );
  useEffect(() => {
    if (!autoFocus || !selected) return;
    const frame = requestAnimationFrame(() => focus(selected));
    return () => cancelAnimationFrame(frame);
  }, [autoFocus, selected, focus]);
  return (
    <div ref={surface} className={`graph-surface ${compact ? "compact" : ""}`}>
      <div className="graph-heading mono">
        <span>
          TRUSTGRAPH <span className="graph-sub">/ SPATIAL EVIDENCE MAP</span>
        </span>
        <span>
          {analysis.nodes.length} NODES · {analysis.edges.length} LINKS
        </span>
      </div>
      <div className="graph-stage">
        <div className="graph-orientation mono">
          <span>01 / SOURCE</span>
          <span>{narrow ? "02 / EVIDENCE + REQUESTS" : "02 / PATTERN"}</span>
          {!narrow && <span>03 / REQUEST</span>}
        </div>
        <svg
          className={`trust-graph ${narrow ? "graph-narrow" : ""}`}
          preserveAspectRatio="xMidYMin meet"
          viewBox={`0 0 ${canvasWidth} 760`}
          role="group"
          aria-label="Interactive evidence graph. Select a node or connection to reveal exact messages, reasoning and protective actions. Drag to pan."
          onPointerDown={(e) => {
            if ((e.target as Element).closest("[role=button]")) return;
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              px: pan.x,
              py: pan.y,
              ratio:
                canvasWidth / e.currentTarget.getBoundingClientRect().width,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (d)
              stage.current?.setAttribute(
                "transform",
                `translate(${d.px + (e.clientX - d.x) * d.ratio} ${d.py + (e.clientY - d.y) * d.ratio}) scale(${zoom})`,
              );
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            if (d)
              setPan({
                x: d.px + (e.clientX - d.x) * d.ratio,
                y: d.py + (e.clientY - d.y) * d.ratio,
              });
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
            stage.current?.setAttribute(
              "transform",
              `translate(${pan.x} ${pan.y}) scale(${zoom})`,
            );
          }}
        >
          <defs>
            <marker
              id={`arrow-${uid}`}
              markerWidth="5"
              markerHeight="5"
              refX="4"
              refY="2.5"
              orient="auto"
            >
              <path d="M0 0L5 2.5 0 5Z" fill="currentColor" />
            </marker>
          </defs>
          <g
            ref={stage}
            transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}
          >
            {analysis.edges.map((e) => {
              const a = projected.get(e.from)!;
              const b = projected.get(e.to)!;
              const id = edgeId(e);
              const highlighted =
                selected === id ||
                (selected && (e.from === selected || e.to === selected));
              const muted =
                !active.has(e.to) &&
                analysis.findings.some((f) => f.id === e.to);
              const source = analysis.nodes.find((n) => n.id === e.from)!;
              const target = analysis.nodes.find((n) => n.id === e.to)!;
              const d = curve(a, b);
              const critical = analysis.findings.some(
                (f) =>
                  f.id === e.to &&
                  [
                    "payment",
                    "credentials",
                    "documents",
                    "inconsistency",
                    "secrecy",
                    "urgency",
                  ].includes(f.kind),
              );
              return (
                <g
                  key={id}
                  data-edge={id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected === id}
                  aria-label={`Inspect connection: ${source.label} to ${target.label}. ${e.label}.`}
                  className={`edge-control ${highlighted ? "is-selected" : ""} ${critical ? "critical" : ""} ${muted ? "removed" : ""} ${selected && !highlighted ? "edge-dimmed" : ""}`}
                  onClick={() => onSelect(id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(id);
                    }
                  }}
                >
                  <path className="edge-hit" d={d} />
                  <path
                    className="graph-edge-shadow"
                    d={d}
                    transform="translate(0 5)"
                  />
                  <path
                    className="graph-edge"
                    pathLength={1}
                    d={d}
                    markerEnd={`url(#arrow-${uid})`}
                  />
                  <title>
                    {source.label} → {target.label}: {e.label}
                  </title>
                </g>
              );
            })}
            {[...analysis.nodes]
              .sort((a, b) => projected.get(a.id)!.z - projected.get(b.id)!.z)
              .map((n) => {
                const p = projected.get(n.id)!;
                const finding = analysis.findings.find(
                  (f) => f.id === n.findingId,
                );
                const critical =
                  finding &&
                  [
                    "payment",
                    "credentials",
                    "documents",
                    "secrecy",
                    "inconsistency",
                    "urgency",
                  ].includes(finding.kind);
                const muted = finding && !active.has(finding.id);
                const chosen = anchors.includes(n.id);
                const label = graphLabel(
                  n.label,
                  n.type === "action" || n.id.startsWith("sender") ? 16 : 19,
                );
                return (
                  <g
                    key={n.id}
                    data-node={n.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${label.join(" ")} ${n.type === "message" ? n.id.toUpperCase() : n.classification}. ${n.label}. Inspect evidence.`}
                    aria-pressed={chosen}
                    className={`graph-node ${critical ? "critical" : ""} ${muted ? "muted" : ""} ${selected && !connected.has(n.id) ? "dimmed" : ""} ${chosen ? "selected" : ""}`}
                    transform={`translate(${p.x} ${p.y})`}
                    onClick={() => onSelect(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(n.id);
                      }
                    }}
                    onFocus={() => {
                      if (
                        p.y * zoom + pan.y > 715 ||
                        p.y * zoom + pan.y < 40 ||
                        p.x * zoom + pan.x > canvasWidth - 80 ||
                        p.x * zoom + pan.x < 50
                      )
                        setPan({
                          x: canvasWidth / 2 - p.x * zoom,
                          y: 380 - p.y * zoom,
                        });
                    }}
                  >
                    <rect
                      className="node-hit"
                      x="-28"
                      y="-30"
                      width="208"
                      height="64"
                      rx="2"
                    />
                    <path
                      className="node-shadow"
                      d="M-19 -16L12 -16 26 -2 26 20 -6 20 -19 7Z"
                      transform="translate(0 8)"
                    />
                    {n.type === "identity" || n.type === "claim" ? (
                      <>
                        <path
                          className="node-top"
                          d="M-22 -9L-6 -22 17 -14 23 5 7 19 -16 10Z"
                        />
                        <path
                          className="node-face"
                          d="M-22 -9L-6 -15 17 -7 23 5 7 12 -16 4Z"
                        />
                        <circle className="node-inset" cx="1" cy="-1" r="7" />
                      </>
                    ) : n.type === "action" || critical ? (
                      <>
                        <path
                          className="node-top"
                          d="M0 -24L23 -2 0 20 -23 -2Z"
                        />
                        <path
                          className="node-side"
                          d="M-23 -2L0 20 23 -2 23 7 0 29 -23 7Z"
                        />
                        <path className="node-inset" d="M0 -12V3m0 6v2" />
                      </>
                    ) : (
                      <>
                        <path
                          className="node-top"
                          d="M-21 -19L13 -19 23 -9 -11 -9Z"
                        />
                        <path
                          className="node-side"
                          d="M13 -19L23 -9 23 19 13 9Z"
                        />
                        <path className="node-face" d="M-21 -19H13V9H-21Z" />
                        <path
                          className="node-inset"
                          d={
                            n.type === "message"
                              ? "M-14 -10H5m-19 6H2m-16 6H5"
                              : "M-13 -5H5m-9 -8V3"
                          }
                        />
                      </>
                    )}
                    <text
                      className="node-label"
                      x="35"
                      y={label.length > 1 ? -4 : 2}
                    >
                      {label.map((line, i) => (
                        <tspan key={i} x="35" dy={i ? 23 : 0}>
                          {line.trim()}{" "}
                        </tspan>
                      ))}
                    </text>
                    <text
                      className="node-classification"
                      x="35"
                      y={label.length > 1 ? 37 : 25}
                    >
                      {" "}
                      {n.type === "message"
                        ? n.id.toUpperCase()
                        : n.classification}
                    </text>
                    <title>
                      {n.label}: {n.detail}
                    </title>
                  </g>
                );
              })}
          </g>
        </svg>
        <span className="graph-stage-caption mono">
          DRAG TO EXPLORE · SELECT A LINK TO TRACE ITS SOURCE
        </span>
      </div>
      <div className="graph-controls">
        <div>
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.1, z - 0.2))}
          >
            −
          </button>
          <span className="mono">{Math.round(zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(2.6, z + 0.2))}
          >
            +
          </button>
        </div>
        <button
          aria-label="Orbit: Rotate spatial graph"
          onClick={() => setAngle((a) => (a > 0 ? -0.22 : 0.22))}
        >
          Orbit ↻
        </button>
        <button onClick={() => focus(selected)} disabled={!selected}>
          Focus selection
        </button>
        <button
          onClick={() => {
            setZoom(fittedZoom);
            setPan({ x: (canvasWidth - canvasWidth * fittedZoom) / 2, y: 0 });
            setAngle(0);
          }}
        >
          Reset view
        </button>
      </div>
      <div className="graph-legend mono">
        <span>⬡ IDENTITY / CLAIM</span>
        <span>▤ MESSAGE</span>
        <span>⊞ OBSERVATION / DESTINATION</span>
        <span className="danger-text">◇ REQUEST / PRESSURE</span>
      </div>
    </div>
  );
}
