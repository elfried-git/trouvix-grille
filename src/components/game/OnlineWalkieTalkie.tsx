"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { Mic, MicOff, Radio, Volume2, VolumeX } from "lucide-react";

const VOICE_SAMPLE_RATE = 16000;
const PROCESSOR_BUFFER_SIZE = 4096;

interface OnlineWalkieTalkieProps {
  roomCode: string;
  playerId: string;
}

type VoiceAudioPayload = { roomCode: string; playerId: string; chunk: ArrayBuffer | Uint8Array };

export function OnlineWalkieTalkie({ roomCode, playerId }: OnlineWalkieTalkieProps) {
  const [speakerId, setSpeakerId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [pressing, setPressing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const pressedRef = useRef(false);
  const transmittingRef = useRef(false);
  const listeningRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const presenceRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const scheduledAudioRef = useRef(new Set<AudioBufferSourceNode>());
  const playbackAtRef = useRef(0);
  const endPlaybackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getAudioContext = useCallback(() => {
    if (contextRef.current) return contextRef.current;
    const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextConstructor) throw new Error("Ce navigateur ne prend pas en charge l’audio en direct.");
    const context = new AudioContextConstructor() as AudioContext;
    contextRef.current = context;
    return context;
  }, []);

  const stopMicrophone = useCallback((notifyServer = true) => {
    transmittingRef.current = false;
    processorRef.current?.disconnect();
    micSourceRef.current?.disconnect();
    highPassRef.current?.disconnect();
    presenceRef.current?.disconnect();
    compressorRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    processorRef.current = null;
    micSourceRef.current = null;
    highPassRef.current = null;
    presenceRef.current = null;
    compressorRef.current = null;
    silentGainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (notifyServer) getSocket().emit("voice-stop");
    if (!listeningRef.current && contextRef.current?.state === "running") {
      void contextRef.current.suspend().catch(() => {});
    }
    setPressing(false);
  }, []);

  const clearRemotePlayback = useCallback(() => {
    if (endPlaybackTimerRef.current) clearTimeout(endPlaybackTimerRef.current);
    endPlaybackTimerRef.current = null;
    for (const source of scheduledAudioRef.current) {
      try { source.stop(); } catch {}
      source.disconnect();
    }
    scheduledAudioRef.current.clear();
    playbackAtRef.current = 0;
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const onVoiceStarted = ({ roomCode: eventRoomCode, playerId: nextSpeakerId }: { roomCode: string; playerId: string }) => {
      if (eventRoomCode !== roomCode) return;
      setSpeakerId(nextSpeakerId);
      setVoiceError(null);
      clearRemotePlayback();
    };
    const onVoiceEnded = ({ roomCode: eventRoomCode, playerId: endedPlayerId }: { roomCode: string; playerId: string }) => {
      if (eventRoomCode !== roomCode) return;
      setSpeakerId((current) => current === endedPlayerId ? null : current);
      if (endedPlayerId === playerId && pressedRef.current) {
        pressedRef.current = false;
        stopMicrophone(false);
      }
      if (endPlaybackTimerRef.current) clearTimeout(endPlaybackTimerRef.current);
      endPlaybackTimerRef.current = setTimeout(clearRemotePlayback, 180);
    };
    const onVoiceAudio = ({ roomCode: eventRoomCode, playerId: senderId, chunk }: VoiceAudioPayload) => {
      if (eventRoomCode !== roomCode) return;
      if (senderId === playerId || !listeningRef.current) return;
      const context = contextRef.current;
      if (!context || context.state !== "running") return;
      const bytes = chunk instanceof ArrayBuffer
        ? new Uint8Array(chunk)
        : chunk instanceof Uint8Array
          ? new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
          : null;
      if (!bytes || bytes.byteLength < 2 || bytes.byteLength % 2 !== 0) return;

      const samples = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
      const audioBuffer = context.createBuffer(1, samples.length, VOICE_SAMPLE_RATE);
      const channel = audioBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 32768;

      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(context.destination);
      const startAt = Math.max(context.currentTime + 0.06, playbackAtRef.current);
      playbackAtRef.current = startAt + audioBuffer.duration;
      scheduledAudioRef.current.add(source);
      source.onended = () => {
        scheduledAudioRef.current.delete(source);
        source.disconnect();
      };
      source.start(startAt);
    };
    const onDisconnect = () => {
      pressedRef.current = false;
      stopMicrophone(false);
      setSpeakerId(null);
      clearRemotePlayback();
    };

    socket.on("voice-started", onVoiceStarted);
    socket.on("voice-ended", onVoiceEnded);
    socket.on("voice-audio", onVoiceAudio);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("voice-started", onVoiceStarted);
      socket.off("voice-ended", onVoiceEnded);
      socket.off("voice-audio", onVoiceAudio);
      socket.off("disconnect", onDisconnect);
      pressedRef.current = false;
      stopMicrophone();
      clearRemotePlayback();
      if (endPlaybackTimerRef.current) clearTimeout(endPlaybackTimerRef.current);
      if (contextRef.current) void contextRef.current.close();
      contextRef.current = null;
    };
  }, [clearRemotePlayback, playerId, roomCode, stopMicrophone]);

  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  useEffect(() => {
    const stopWhenHidden = () => {
      if (document.visibilityState !== "visible" && pressedRef.current) {
        pressedRef.current = false;
        stopMicrophone();
      }
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => document.removeEventListener("visibilitychange", stopWhenHidden);
  }, [stopMicrophone]);

  const toggleListening = async () => {
    setVoiceError(null);
    try {
      const context = getAudioContext();
      if (listening) {
        await context.suspend();
        listeningRef.current = false;
        clearRemotePlayback();
        setListening(false);
      } else {
        await context.resume();
        listeningRef.current = true;
        setListening(true);
      }
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Impossible d’activer l’écoute.");
    }
  };

  const startTalking = async () => {
    if (pressedRef.current || (speakerId && speakerId !== playerId)) return;
    pressedRef.current = true;
    setPressing(true);
    setVoiceError(null);

    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Le micro nécessite un navigateur compatible et une connexion HTTPS.");
      }
      const context = getAudioContext();
      void context.resume();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      if (!pressedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      await context.resume();
      streamRef.current = stream;
      const socket = getSocket();
      const lease = await new Promise<{ ok?: boolean; error?: string }>((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
          settled = true;
          resolve({ ok: false, error: "Le canal vocal ne répond pas. Réessaie." });
        }, 5000);
        socket.emit("voice-start", {}, (response: { ok?: boolean; error?: string }) => {
          if (settled) {
            if (response?.ok) socket.emit("voice-stop");
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve(response ?? {});
        });
      });
      if (!lease.ok) throw new Error(lease.error || "Le canal vocal est occupé.");
      if (!pressedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        socket.emit("voice-stop");
        return;
      }

      const micSource = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
      const highPass = context.createBiquadFilter();
      highPass.type = "highpass";
      highPass.frequency.value = 160;
      highPass.Q.value = 0.7;
      const presence = context.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 2800;
      presence.Q.value = 0.9;
      presence.gain.value = 2.5;
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 18;
      compressor.ratio.value = 2.5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      const silentGain = context.createGain();
      silentGain.gain.value = 0;
      processor.onaudioprocess = (event) => {
        if (!transmittingRef.current) return;
        const input = event.inputBuffer.getChannelData(0);
        const ratio = context.sampleRate / VOICE_SAMPLE_RATE;
        const sampleCount = Math.floor(input.length / ratio);
        const pcm = new Int16Array(sampleCount);
        for (let i = 0; i < sampleCount; i++) {
          const start = Math.floor(i * ratio);
          const end = Math.min(input.length, Math.floor((i + 1) * ratio));
          let total = 0;
          for (let j = start; j < end; j++) total += input[j];
          const value = Math.max(-1, Math.min(1, total / Math.max(1, end - start)));
          pcm[i] = value < 0 ? value * 32768 : value * 32767;
        }
        socket.emit("voice-audio", pcm.buffer);
      };
      micSource.connect(highPass);
      highPass.connect(presence);
      presence.connect(compressor);
      compressor.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);
      micSourceRef.current = micSource;
      processorRef.current = processor;
      highPassRef.current = highPass;
      presenceRef.current = presence;
      compressorRef.current = compressor;
      silentGainRef.current = silentGain;
      transmittingRef.current = true;
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop());
      pressedRef.current = false;
      stopMicrophone();
      setVoiceError(error instanceof Error ? error.message : "Impossible d’utiliser le micro.");
    }
  };

  const stopTalking = () => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    stopMicrophone();
  };

  const anotherPlayerSpeaking = !!speakerId && speakerId !== playerId;

  return (
    <div className="mx-auto flex w-full max-w-[min(560px,calc(100vw-1.5rem))] flex-wrap items-center justify-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-sky-100/80 sm:flex-none">
        <Radio className={`h-4 w-4 shrink-0 ${speakerId ? "animate-pulse text-emerald-300" : "text-sky-300"}`} />
        <span className="truncate">Talkie-walkie</span>
      </div>
      <button
        type="button"
        onClick={() => void toggleListening()}
        aria-label={listening ? "Désactiver l’écoute vocale" : "Activer l’écoute vocale"}
        title={listening ? "Désactiver l’écoute" : "Activer l’écoute"}
        className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${listening ? "border-sky-300/50 bg-sky-400/15 text-sky-100" : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"}`}
      >
        {listening ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        <span>{listening ? "Écoute activée" : "Activer l’écoute"}</span>
      </button>
      <button
        type="button"
        disabled={anotherPlayerSpeaking}
        onPointerDown={(event) => {
          event.preventDefault();
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
          void startTalking();
        }}
        onPointerUp={stopTalking}
        onPointerCancel={stopTalking}
        onKeyDown={(event) => {
          if ((event.key === " " || event.key === "Enter") && !event.repeat) {
            event.preventDefault();
            void startTalking();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            stopTalking();
          }
        }}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={pressing ? "Tu parles. Relâche pour couper le micro." : "Maintenir pour parler"}
        aria-pressed={pressing}
        className={`inline-flex h-10 touch-none select-none items-center justify-center gap-1.5 rounded-full border px-4 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${pressing ? "border-rose-300 bg-rose-600 text-white shadow-[0_0_18px_rgba(244,63,94,0.55)]" : "border-emerald-300/40 bg-emerald-600/20 text-emerald-100 hover:bg-emerald-600/35"}`}
      >
        {pressing ? <Mic className="h-4 w-4 animate-pulse" /> : <MicOff className="h-4 w-4" />}
        <span>{pressing ? "Tu parles…" : "Maintenir pour parler"}</span>
      </button>
      {voiceError && <p role="status" className="w-full text-center text-xs text-rose-200">{voiceError}</p>}
    </div>
  );
}
