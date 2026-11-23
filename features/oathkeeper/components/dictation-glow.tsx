"use client";
/* Dictation glow: while the mic listens, voice-glow's VoiceBeam (https://libraries.dev/voice, MIT, Copyright (c) 2026
 * Jakub Antalik; vendored 0.5.0 in features/oathkeeper/vendor/voice-glow) draws its dither look along the input's bottom
 * edge, following the input's radius. It replaces the teal glimm band. The "default" preset (a chat input) at every
 * width: "mobile" is built for a whole phone screen and, on a 402px composer, fills the input and runs under the
 * send button. Mounted when listening starts and unmounted when
 * its fade-out ends, so nothing animates at rest.
 *   listening → the beam reacts to the voice: a getUserMedia stream opened only for the meter (never shared with
 *               SpeechRecognition, every track stopped on stop/pause/unmount). If capture is refused or fails, or on
 *               iOS where a second capture can end the recognition, a gentle level getter drives it instead;
 *   finishing → the lobes gather into one beam that sweeps the input (processing);
 *   paused    → the beam freezes where it is and the meter's stream is stopped;
 *   stopped   → VoiceBeam fades out, then the whole thing unmounts.
 * prefers-reduced-motion: VoiceBeam drops the breathing, flow and hue drift itself; the processing beam holds at the
 * centre instead of sweeping and the pointer magnet is off.
 * The dock's recording pill mounts the same glow (type "pill", its capsule radius) on its black face. */
import { useEffect, useRef, useState } from "react";
import { VoiceBeam, type VoiceBeamMotion, type VoiceBeamType } from "../vendor/voice-glow";

export type DictationGlowPhase = "idle" | "listening" | "finishing";

const SWEEP_MS = 2600; // one processing sweep, there and back

/** `type` and `radius` fit the beam to its host: the composer's input (default, 10px) or the dock's recording pill ("pill", a full-radius capsule). */
export function DictationGlow({ phase, paused = false, type = "default", radius = 10 }: { phase: DictationGlowPhase; paused?: boolean; type?: VoiceBeamType; radius?: number }) {
  const active = phase !== "idle";
  const [present, setPresent] = useState(active);
  if (active && !present) setPresent(true);
  return present ? <Beam phase={phase} paused={paused} type={type} radius={radius} onGone={() => setPresent(false)}/> : null;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/* iOS / iPadOS Safari can end webkitSpeechRecognition when the page opens a second capture. */
const isIOS = () => typeof navigator !== "undefined" && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

function Beam({ phase, paused, type, radius, onGone }: { phase: DictationGlowPhase; paused: boolean; type: VoiceBeamType; radius: number; onGone: () => void }) {
  const active = phase !== "idle";
  const listening = phase === "listening";
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [reduced] = useState(reducedMotion);
  const gone = useRef(onGone);
  const finishingSince = useRef(0);
  useEffect(() => { gone.current = onGone; });

  // The meter's own capture: only while listening and not paused. Failure is silent (the level getter takes over).
  const metering = listening && !paused;
  useEffect(() => {
    if (!metering || isIOS() || !navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false, opened: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => {
      if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
      opened = s; setStream(s);
    }, () => {});
    return () => { cancelled = true; opened?.getTracks().forEach((t) => t.stop()); setStream(null); };
  }, [metering]);

  useEffect(() => { finishingSince.current = phase === "finishing" ? performance.now() : 0; }, [phase === "finishing"]);

  // Safety net: if the fade-out's animationend never arrives, still unmount.
  useEffect(() => {
    if (active) return;
    const timer = window.setTimeout(() => gone.current(), 1200);
    return () => window.clearTimeout(timer);
  }, [active]);

  const level = () => {
    if (reduced) return 0.3;
    const t = performance.now() / 1000;
    return 0.26 + 0.1 * Math.sin(t * 2.1) + 0.06 * Math.sin(t * 5.3 + 1);
  };
  const motion = (): VoiceBeamMotion | null => {
    const since = finishingSince.current;
    if (!since) return null;
    const gather = Math.min(1, (performance.now() - since) / 320);
    const offset = reduced ? 0 : 0.7 * Math.sin(((performance.now() - since) / SWEEP_MS) * Math.PI * 2);
    return { gather, offset, heldLevel: 0.55, stretch: reduced ? 0 : 0.3 * Math.abs(Math.cos(((performance.now() - since) / SWEEP_MS) * Math.PI * 2)) };
  };

  return <div aria-hidden="true" data-dictation-glow="" data-listening={listening || undefined} className="pointer-events-none absolute inset-0">
    <VoiceBeam
      look="dither"
      type={type}
      theme="dark"
      active={active}
      paused={paused}
      stream={stream}
      level={level}
      motion={motion}
      pixelMagnet={reduced ? 0 : undefined}
      onDeactivate={() => gone.current()}
      style={{ position: "absolute", inset: 0 }}
    >
      <div className="h-full w-full" style={{ borderRadius: radius }}/>
    </VoiceBeam>
  </div>;
}
