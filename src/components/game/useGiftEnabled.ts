"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket";

/** Réglage admin « Cadeau Noël » : vrai seulement quand le serveur confirme qu'il est activé. */
export function useGiftEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    let alive = true;
    const query = () => {
      if (!socket.connected) return;
      socket.emit("gift:status", {}, (res: { enabled?: boolean }) => {
        if (alive && typeof res?.enabled === "boolean") setEnabled(res.enabled);
      });
    };
    const onChanged = (payload: { enabled?: boolean }) => {
      if (typeof payload?.enabled === "boolean") setEnabled(payload.enabled);
    };
    socket.on("connect", query);
    socket.on("gift:enabled-changed", onChanged);
    query();
    return () => {
      alive = false;
      socket.off("connect", query);
      socket.off("gift:enabled-changed", onChanged);
    };
  }, []);

  return enabled;
}