import {
  Component,
  lazy,
  Suspense,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
const MetalScene = lazy(() => import("./MetalScene"));
const still = () => {};
function needsStaticRender() {
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData
  )
    return true;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", {
    failIfMajorPerformanceCaveat: true,
  });
  if (!context) return true;
  const debug = context.getExtension("WEBGL_debug_renderer_info");
  const renderer = debug
    ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL))
    : "";
  context.getExtension("WEBGL_lose_context")?.loseContext();
  return /swiftshader|llvmpipe|software|microsoft basic render/i.test(renderer);
}

export function StaticMechanism({ onReady }: { onReady?: () => void } = {}) {
  return (
    <picture>
      <source media="(max-width: 700px)" srcSet="/mechanism-mobile.webp" />
      <img
        className="static-mechanism"
        src="/mechanism.webp"
        width="1920"
        height="1080"
        alt=""
        fetchPriority="high"
        onLoad={onReady}
        onError={onReady}
      />
    </picture>
  );
}
class SceneBoundary extends Component<
  { children: ReactNode; onReady?: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <StaticMechanism onReady={this.props.onReady} />
    ) : (
      this.props.children
    );
  }
}
export default function Artwork({
  intro,
  cameraMotion = false,
  onReady = still,
}: {
  intro: boolean;
  onComplete?: () => void;
  cameraMotion?: boolean;
  onReady?: () => void;
}) {
  const [lightweight, setLightweight] = useState(needsStaticRender);
  const fallback = useCallback(() => setLightweight(true), []);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => {
      if (motion.matches) setLightweight(true);
    };
    motion.addEventListener("change", changed);
    return () => motion.removeEventListener("change", changed);
  }, []);
  return (
    <div
      className={`artwork${intro ? " sculpture-opening" : ""}`}
      role="img"
      aria-label="Interlocking brushed-titanium forms separated by a red fracture. An original sculpture representing a break in deception."
    >
      {lightweight ? (
        <StaticMechanism onReady={onReady} />
      ) : (
        <SceneBoundary onReady={onReady}>
          <Suspense fallback={<StaticMechanism />}>
            <MetalScene
              intro={intro}
              cameraMotion={cameraMotion}
              onReady={onReady}
              onUnavailable={fallback}
            />
          </Suspense>
        </SceneBoundary>
      )}
    </div>
  );
}
