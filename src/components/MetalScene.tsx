import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";

function materials() {
  const studio = document.createElement("canvas");
  studio.width = 1024;
  studio.height = 512;
  const light = studio.getContext("2d")!;
  light.fillStyle = "#687077";
  light.fillRect(0, 0, 1024, 512);
  for (const [x, y, w, h, color] of [
    [0, 0, 260, 512, "#e1e6ea"],
    [340, 0, 310, 235, "#ffffff"],
    [720, 120, 95, 340, "#272e37"],
    [860, 0, 165, 400, "#c8c7c0"],
  ] as const) {
    light.fillStyle = color;
    light.fillRect(x, y, w, h);
  }
  const environment = new THREE.CanvasTexture(studio);
  environment.mapping = THREE.EquirectangularReflectionMapping;
  environment.colorSpace = THREE.SRGBColorSpace;
  const grain = document.createElement("canvas");
  grain.width = 512;
  grain.height = 512;
  const context = grain.getContext("2d")!;
  context.fillStyle = "#898989";
  context.fillRect(0, 0, 512, 512);
  let seed = 8409;
  for (let i = 0; i < 1600; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const value = 100 + (seed % 70);
    context.strokeStyle = `rgba(${value},${value},${value},.25)`;
    context.beginPath();
    context.moveTo(0, seed % 512);
    context.lineTo(512, (seed % 512) + 0.4);
    context.stroke();
  }
  const brushed = new THREE.CanvasTexture(grain);
  brushed.wrapS = brushed.wrapT = THREE.RepeatWrapping;
  brushed.repeat.set(1.4, 2);
  return { environment, brushed };
}
function armGeometry(mirror: boolean, rib: number) {
  const shape = new THREE.Shape();
  const start = rib / 3 + 0.012,
    end = (rib + 1) / 3 - 0.012;
  const interpolate = (a: number[], b: number[], t: number) =>
    a.map((value, index) => value + (b[index] - value) * t);
  const points = [
    interpolate([-2.5, 2], [-1.18, 2], start),
    interpolate([-2.5, 2], [-1.18, 2], end),
    interpolate([-0.64, -2.12], [0.53, -1.82], end),
    interpolate([-0.64, -2.12], [0.53, -1.82], start),
  ];
  points.forEach(([x, y], i) => {
    if (!i) shape.moveTo(mirror ? -x : x, y);
    else shape.lineTo(mirror ? -x : x, y);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.85,
    bevelEnabled: true,
    bevelSegments: 5,
    steps: 1,
    bevelSize: 0.035,
    bevelThickness: 0.055,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -0.425 + rib * 0.08);
  geometry.computeVertexNormals();
  return geometry;
}
function Sculpture({
  intro,
  cameraMotion,
}: {
  intro: boolean;
  cameraMotion: boolean;
}) {
  const root = useRef<THREE.Group>(null),
    left = useRef<THREE.Group>(null),
    right = useRef<THREE.Group>(null);
  const fracture = useRef<THREE.Mesh>(null);
  const { camera, invalidate, gl, size } = useThree();
  const compact = size.width <= 700;
  const portrait = compact && cameraMotion;
  const resource = useMemo(
    () => ({
      ...materials(),
      left: [0, 1, 2].map((rib) => armGeometry(false, rib)),
      right: [0, 1, 2].map((rib) => armGeometry(true, rib)),
    }),
    [],
  );
  useEffect(() => {
    const object = root.current!,
      a = left.current!,
      b = right.current!,
      seam = fracture.current!;
    const resting = {
      x: compact ? 0 : 2.35,
      y: portrait ? 1.65 : 0.05,
      scale: portrait ? 0.51 : compact ? 1.25 : 0.92,
    };
    const pose = { gap: 0.24, lookX: compact ? 0 : 0.3, lookY: 0.05 };
    const update = () => {
      a.position.set(-pose.gap, pose.gap * 0.3, 0.1);
      b.position.set(pose.gap, -pose.gap * 0.25, -0.15);
      camera.lookAt(pose.lookX, pose.lookY, 0);
      invalidate();
    };
    object.position.set(resting.x, resting.y, 0);
    object.rotation.set(0.23, -0.52, -0.16);
    object.scale.setScalar(resting.scale);
    camera.position.set(0, 0, 9.5);
    seam.scale.set(1, 1, 1);
    update();
    if (!intro) return;
    object.position.set(0, 0, 0);
    object.scale.setScalar(compact ? 1.3 : 1.8);
    object.rotation.set(0.12, -0.85, -0.38);
    camera.position.set(-0.25, 0.2, 7);
    pose.gap = 0.015;
    seam.scale.setScalar(0.001);
    update();
    const timeline = gsap.timeline({ onUpdate: update });
    timeline
      .to(
        object.rotation,
        { y: -0.45, z: -0.2, duration: 1.5, ease: "power2.inOut" },
        0,
      )
      .to(
        camera.position,
        { z: 6, x: 0.2, duration: 1.5, ease: "power2.inOut" },
        0,
      )
      .to(pose, { gap: 0.68, duration: 1.5, ease: "power3.inOut" }, 1.5)
      .to(
        seam.scale,
        { x: 1, y: 1, z: 1, duration: 0.6, ease: "power2.out" },
        2.2,
      )
      .to(
        object.rotation,
        { x: -0.08, y: 0.2, z: -0.12, duration: 1.5, ease: "power3.inOut" },
        3,
      )
      .to(
        object.scale,
        { x: 1.1, y: 1.1, z: 1.1, duration: 1.5, ease: "power3.inOut" },
        3,
      )
      .to(
        camera.position,
        { z: 1.1, x: 0.1, y: -0.2, duration: 1.5, ease: "power3.inOut" },
        3,
      )
      .to(
        camera.position,
        { z: 9.5, x: 0, y: 0, duration: 1.4, ease: "power3.inOut" },
        4.5,
      )
      .to(
        object.position,
        { x: resting.x, y: resting.y, duration: 1.4, ease: "power3.inOut" },
        4.5,
      )
      .to(
        object.rotation,
        { x: 0.23, y: -0.52, z: -0.16, duration: 1.4, ease: "power3.inOut" },
        4.5,
      )
      .to(
        object.scale,
        {
          x: resting.scale,
          y: resting.scale,
          z: resting.scale,
          duration: 1.4,
          ease: "power3.inOut",
        },
        4.5,
      )
      .to(pose, { gap: 0.24, duration: 1.1, ease: "power3.inOut" }, 5.9);
    return () => {
      timeline.kill();
    };
  }, [intro, camera, invalidate, compact, portrait]);
  useEffect(() => {
    if (
      intro ||
      !cameraMotion ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const target = { x: 0, y: 0 };
    const update = () => {
      camera.position.x = target.x;
      camera.position.y = target.y;
      camera.lookAt(compact ? 0 : 0.3, 0.05, 0);
      invalidate();
    };
    const x = gsap.quickTo(target, "x", {
      duration: compact ? 0.9 : 0.5,
      ease: "power2.out",
      onUpdate: update,
    });
    const y = gsap.quickTo(target, "y", {
      duration: compact ? 0.9 : 0.5,
      ease: "power2.out",
      onUpdate: update,
    });
    const move = (e: PointerEvent) => {
      if (compact && (e.clientY > innerHeight * 0.38 || document.hidden))
        return;
      drift?.kill();
      x((e.clientX / innerWidth - 0.5) * 0.45);
      y(-(e.clientY / innerHeight - 0.5) * 0.3);
    };
    const reset = () => {
      x(0);
      y(0);
    };
    const element = gl.domElement;
    const coarse = matchMedia("(pointer: coarse)").matches;
    const drift = compact
      ? gsap.to(target, {
          x: 0.12,
          y: 0.055,
          duration: 5,
          repeat: 1,
          yoyo: true,
          ease: "sine.inOut",
          onUpdate: update,
        })
      : null;
    const visibility = () => {
      if (document.hidden) drift?.pause();
      else drift?.resume();
    };
    window.addEventListener(coarse ? "pointerdown" : "pointermove", move, {
      passive: true,
    });
    window.addEventListener("pointerup", reset, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    element.addEventListener("pointerleave", reset);
    return () => {
      window.removeEventListener(coarse ? "pointerdown" : "pointermove", move);
      window.removeEventListener("pointerup", reset);
      document.removeEventListener("visibilitychange", visibility);
      element.removeEventListener("pointerleave", reset);
      drift?.kill();
      x.tween.kill();
      y.tween.kill();
    };
  }, [intro, cameraMotion, camera, invalidate, gl, compact]);
  useEffect(
    () => () => {
      resource.environment.dispose();
      resource.brushed.dispose();
      resource.left.forEach((geometry) => geometry.dispose());
      resource.right.forEach((geometry) => geometry.dispose());
    },
    [resource],
  );
  const titanium = {
    color: "#bfc5ca",
    metalness: 1,
    roughness: 0.3,
    envMap: resource.environment,
    envMapIntensity: 1.35,
    bumpMap: resource.brushed,
    bumpScale: 0.005,
  };
  return (
    <group ref={root}>
      {[false, true].map((mirror) => (
        <group key={String(mirror)} ref={mirror ? right : left}>
          {(mirror ? resource.right : resource.left).map((geometry, index) => (
            <mesh key={index} geometry={geometry}>
              <meshPhysicalMaterial
                {...titanium}
                color={["#a6afb8", "#d0d3d4", "#8d9ba8"][index]}
                anisotropy={0.7}
                anisotropyRotation={Math.PI / 2}
                clearcoat={0.1}
              />
            </mesh>
          ))}
          {(mirror ? resource.right : resource.left).map((geometry, index) => (
            <mesh
              key={index}
              geometry={geometry}
              position={[0, 0, -0.57]}
              scale={[0.975, 0.975, 0.17]}
            >
              <meshStandardMaterial
                {...titanium}
                color="#252a2f"
                roughness={0.35}
              />
            </mesh>
          ))}
          {[0.26, 0.8, 1.34].map((y, i) => (
            <mesh
              key={i}
              position={[(mirror ? 1 : -1) * (0.75 + y * 0.52), y, 0.68]}
              rotation={[0, 0, 0]}
            >
              <torusGeometry args={[0.075, 0.014, 8, 24]} />
              <meshStandardMaterial {...titanium} color="#32383e" />
            </mesh>
          ))}
        </group>
      ))}
      <mesh
        ref={fracture}
        position={[0.08, -0.8, 0.57]}
        rotation={[0, 0, -0.42]}
      >
        <boxGeometry args={[0.075, 1.48, 0.13]} />
        <meshStandardMaterial
          color="#a8312b"
          metalness={0.75}
          roughness={0.26}
          envMap={resource.environment}
        />
      </mesh>
      <mesh position={[-0.25, 0.3, -0.5]} rotation={[0, 0, 0.2]}>
        <boxGeometry args={[2.5, 0.045, 0.07]} />
        <meshStandardMaterial {...titanium} color="#2c3237" />
      </mesh>
      {[
        [
          [-1.1, 0.95, -0.62],
          [1.1, 0.9, -0.62],
        ],
        [
          [-1.1, 0.95, -0.62],
          [0.12, -0.55, -0.62],
        ],
        [
          [1.1, 0.9, -0.62],
          [0.12, -0.55, -0.62],
        ],
        [
          [-0.62, -0.12, -0.62],
          [0.68, 0.24, -0.62],
        ],
      ].map(([from, to], index) => {
        const a = new THREE.Vector3(...from),
          b = new THREE.Vector3(...to);
        const direction = b.clone().sub(a);
        return (
          <mesh
            key={index}
            position={a.clone().add(b).multiplyScalar(0.5)}
            quaternion={new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              direction.clone().normalize(),
            )}
          >
            <cylinderGeometry args={[0.028, 0.028, direction.length(), 12]} />
            <meshStandardMaterial {...titanium} color="#88939d" />
          </mesh>
        );
      })}
      {[
        [-1.1, 0.95, -0.62],
        [1.1, 0.9, -0.62],
        [0.12, -0.55, -0.62],
      ].map((position, index) => (
        <mesh
          key={index}
          position={new THREE.Vector3(...position)}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.095, 0.095, 0.12, 6]} />
          <meshStandardMaterial {...titanium} />
        </mesh>
      ))}
    </group>
  );
}
function CompileScene({
  onCompiled,
  onUnavailable,
}: {
  onCompiled: () => void;
  onUnavailable: () => void;
}) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let active = true;
    const unavailable = () => onUnavailable();
    gl.domElement.addEventListener("webglcontextlost", unavailable);

    void gl
      .compileAsync(scene, camera)
      .then(() => {
        if (active) onCompiled();
      })
      .catch(() => {
        if (active) onUnavailable();
      });
    return () => {
      active = false;
      gl.domElement.removeEventListener("webglcontextlost", unavailable);
    };
  }, [gl, scene, camera, onCompiled, onUnavailable]);
  return null;
}
export default function MetalScene({
  intro,
  cameraMotion = false,
  onReady,
  onUnavailable,
}: {
  intro: boolean;
  cameraMotion?: boolean;
  onComplete?: () => void;
  onReady: () => void;
  onUnavailable: () => void;
}) {
  const [compiled, setCompiled] = useState(false);
  const compact = matchMedia("(max-width: 700px), (pointer: coarse)").matches;
  const finishCompilation = useCallback(() => setCompiled(true), []);
  useEffect(() => {
    if (!compiled) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(onReady);
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [compiled, onReady]);
  return (
    <>
      {!compiled && (
        <picture>
          <source media="(max-width: 700px)" srcSet="/mechanism-mobile.webp" />
          <img
            className="static-mechanism"
            src="/mechanism.webp"
            width="1920"
            height="1080"
            alt=""
          />
        </picture>
      )}
      <Canvas
        data-scene-ready={compiled}
        style={{ position: "absolute", inset: 0, opacity: compiled ? 1 : 0 }}
        aria-hidden="true"
        dpr={compact ? 1 : [1, 1.5]}
        frameloop={compiled ? "demand" : "never"}
        camera={{ position: [0, 0, 9.5], fov: 39 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      >
        <ambientLight intensity={0.3} />
        <directionalLight
          position={[-3, 7, 6]}
          intensity={4.5}
          color="#e6edf2"
        />
        <directionalLight
          position={[6, -1, -2]}
          intensity={5}
          color="#94a4b6"
        />
        <directionalLight
          position={[0, -4, 4]}
          intensity={1.4}
          color="#c7c2b9"
        />
        <Sculpture intro={intro} cameraMotion={cameraMotion} />
        <CompileScene
          onCompiled={finishCompilation}
          onUnavailable={onUnavailable}
        />
      </Canvas>
    </>
  );
}
