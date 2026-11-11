"use client";

// Online-room voice chat ("talkie-walkie" relay).
// Capture: mic -> 16 kHz mono PCM16 chunks (~100 ms) -> Socket.IO "voice-chunk".
// Playback: each remote player gets a small scheduled queue so chunks play back-to-back.
// No WebRTC: audio goes through the game service, nothing is stored server-side.

import { getSocket } from "@/lib/socket";

const TARGET_RATE = 16000;
const CHUNK_SAMPLES = 1600; // 100 ms at 16 kHz
const JITTER_S = 0.15; // lead time before first chunk plays
const MAX_LAG_S = 0.6; // if we fall further behind than this, skip ahead

export type VoiceStatus = "off" | "on" | "denied" | "unsupported" | "error";

type Listener = (status: VoiceStatus) => void;
const listeners = new Set<Listener>();
let status: VoiceStatus = "off";

function setStatus(next: VoiceStatus) {
  status = next;
  for (const l of listeners) l(next);
}

export function onVoiceStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}

export function getVoiceStatus(): VoiceStatus {
  return status;
}

// ---------- Playback ----------
let playCtx: AudioContext | null = null;
const nextStartTime = new Map<string, number>();

function getPlayCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!playCtx) {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;
    playCtx = new Ctor();
  }
  return playCtx;
}

// Browsers only let audio start after a user gesture: resume on the first tap/key.
if (typeof window !== "undefined") {
  const unlock = () => {
    getPlayCtx()?.resume().catch(() => {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
}

export function playVoiceChunk(playerId: string, data: ArrayBuffer) {
  const ctx = getPlayCtx();
  if (!ctx || !data || data.byteLength < 2) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const pcm = new Int16Array(data, 0, Math.floor(data.byteLength / 2));
  const buffer = ctx.createBuffer(1, pcm.length, TARGET_RATE);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 32768;

  const now = ctx.currentTime;
  let start = nextStartTime.get(playerId) ?? 0;
  if (start < now) start = now + JITTER_S; // underrun or first chunk: rebuild the cushion
  else if (start > now + MAX_LAG_S) start = now + JITTER_S; // too far behind: drop lag

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start(start);
  nextStartTime.set(playerId, start + buffer.duration);
}

// ---------- Capture ----------
let micStream: MediaStream | null = null;
let micCtx: AudioContext | null = null;
let micNode: ScriptProcessorNode | null = null;
let micSource: MediaStreamAudioSourceNode | null = null;
let micSink: GainNode | null = null;
let starting: Promise<void> | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

// Tell the room whether our mic is open. Re-sent every 2 s so late joiners
// and reconnected clients learn the state; receivers expire it after ~5 s.
function announce(on: boolean) {
  getSocket().emit("voice-state", { on });
}

// Resolve or fail a promise after `ms`, so a request the browser never answers
// (common on mobile without a fresh tap) cannot leave the mic stuck "starting".
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error("Timeout micro");
      err.name = "TimeoutError";
      reject(err);
    }, ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export async function startVoice(): Promise<void> {
  if (micStream) return;
  if (starting) return starting;
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    setStatus("unsupported");
    return;
  }
  // Create the audio context synchronously: when called from a tap, the browser
  // treats it as the user gesture that lets audio run on mobile.
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  const ctx: AudioContext = new Ctor();
  void ctx.resume().catch(() => {});
  starting = (async () => {
    try {
      const stream = await withTimeout(
        navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        }),
        10000,
      );
      void ctx.resume().catch(() => {});

      const source = ctx.createMediaStreamSource(stream);
      const node = ctx.createScriptProcessor(4096, 1, 1);
      const sink = ctx.createGain();
      sink.gain.value = 0; // keeps the processor pulling audio without playing the mic back

      const ratio = ctx.sampleRate / TARGET_RATE;
      let acc = 0;
      let count = 0;
      let phase = 0;
      let out: number[] = [];

      node.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        for (let i = 0; i < input.length; i++) {
          acc += input[i];
          count++;
          phase += 1;
          if (phase >= ratio) {
            out.push(acc / count);
            acc = 0;
            count = 0;
            phase -= ratio;
          }
        }
        while (out.length >= CHUNK_SAMPLES) {
          const block = out.slice(0, CHUNK_SAMPLES);
          out = out.slice(CHUNK_SAMPLES);
          const pcm = new Int16Array(CHUNK_SAMPLES);
          for (let k = 0; k < CHUNK_SAMPLES; k++) {
            const s = Math.max(-1, Math.min(1, block[k]));
            pcm[k] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          getSocket().emit("voice-chunk", { data: pcm.buffer });
        }
      };

      source.connect(node);
      node.connect(sink);
      sink.connect(ctx.destination);

      micStream = stream;
      micCtx = ctx;
      micSource = source;
      micNode = node;
      micSink = sink;
      setStatus("on");
      announce(true);
      heartbeat = setInterval(() => announce(true), 2000);
    } catch (err) {
      // Only a real permission refusal is "denied"; a missing or busy device is a different failure.
      const name = (err as { name?: string })?.name ?? "";
      console.warn("[voice] micro indisponible:", name, err);
      setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
      void ctx.close().catch(() => {});
    } finally {
      starting = null;
    }
  })();
  return starting;
}

export function stopVoice(): void {
  const wasOn = micStream !== null;
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  if (wasOn) announce(false);
  if (micNode) micNode.onaudioprocess = null;
  micSource?.disconnect();
  micNode?.disconnect();
  micSink?.disconnect();
  micStream?.getTracks().forEach((t) => t.stop());
  micCtx?.close().catch(() => {});
  micStream = null;
  micCtx = null;
  micSource = null;
  micNode = null;
  micSink = null;
  setStatus("off");
}

export function isVoiceOn(): boolean {
  return micStream !== null;
}
