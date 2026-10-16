import { useEffect, useRef } from "react";
import gsap from "gsap";
import Wordmark from "./Wordmark";

export default function Opening({
  running,
  onFinish,
}: {
  running: boolean;
  onFinish: () => void;
}) {
  const title = useRef<HTMLDivElement>(null);
  const tagline = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!running || !title.current || !tagline.current) return;

    gsap.ticker.lagSmoothing(0);
    const word = title.current,
      caption = tagline.current;
    const destination = document.querySelector<HTMLElement>(
      ".auth-header .veyra-wordmark",
    )!;
    const from = word.getBoundingClientRect(),
      to = destination.getBoundingClientRect();
    const timeline = gsap.timeline({
      onComplete: onFinish,
      onUpdate: () => {
        word.dataset.filmTime = timeline.time().toFixed(2);
      },
    });
    timeline
      .set(word, { autoAlpha: 0, clipPath: "inset(0 100% 0 0)", y: 24 })
      .set(caption, { autoAlpha: 0, y: 12 })
      .to(
        ".auth-sculpture",
        { opacity: 0.18, duration: 0.5, ease: "power2.inOut" },
        4.3,
      )
      .to(
        word,
        {
          autoAlpha: 1,
          clipPath: "inset(0 0% 0 0)",
          y: 0,
          duration: 0.7,
          ease: "power3.out",
        },
        4.3,
      )
      .to(
        caption,
        { autoAlpha: 1, y: 0, duration: 0.5, ease: "power3.out" },
        4.8,
      )
      .to(caption, { autoAlpha: 0, duration: 0.35 }, 6)
      .to(
        word,
        {
          x: to.left - from.left,
          y: to.top - from.top,
          scale: to.width / from.width,
          duration: 1,
          ease: "power3.inOut",
        },
        6,
      )
      .to(
        ".auth-entry, .auth-header > a:last-child, .auth-footer",
        { opacity: 1, duration: 0.6, ease: "power2.out" },
        6.4,
      )
      .to(
        ".auth-sculpture",
        { opacity: 1, duration: 0.6, ease: "power2.out" },
        6.4,
      );
    return () => {
      timeline.kill();
      gsap.set([word, caption], { clearProps: "all" });
      gsap.set(
        ".auth-sculpture, .auth-entry, .auth-header > a:last-child, .auth-footer",
        { clearProps: "opacity" },
      );
    };
  }, [running, onFinish]);
  return (
    <div
      className={`opening-film${running ? " film-running" : ""}`}
      role="region"
      aria-label="VEYRA cinematic opening"
    >
      <div ref={title} className="opening-wordmark">
        <Wordmark />
      </div>
      <p ref={tagline} className="opening-tagline">
        SEE THROUGH DECEPTION.
      </p>
      <button className="skip-intro" onClick={onFinish}>
        Skip intro
      </button>
    </div>
  );
}
