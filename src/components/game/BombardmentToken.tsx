"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

interface BombardmentTokenProps {
  enabled: boolean;
  hasTargets: boolean;
  onBombard: () => void;
  onDraggingChange: (dragging: boolean) => void;
}

function isPointOnBoard(x: number, y: number) {
  const board = document.querySelector<HTMLElement>("[data-bombardment-board]");
  const bounds = board?.getBoundingClientRect();
  return !!bounds &&
    x >= bounds.left &&
    x <= bounds.right &&
    y >= bounds.top &&
    y <= bounds.bottom;
}

export function BombardmentToken({
  enabled,
  hasTargets,
  onBombard,
  onDraggingChange,
}: BombardmentTokenProps) {
  const [dragging, setDragging] = useState(false);
  const [overBoard, setOverBoard] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const pointerIdRef = useRef<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dragging) return;

    const finishDrag = (event: PointerEvent, shouldDrop: boolean) => {
      if (event.pointerId !== pointerIdRef.current) return;
      const droppedOnBoard = shouldDrop &&
        isPointOnBoard(event.clientX, event.clientY) &&
        enabled &&
        hasTargets;
      pointerIdRef.current = null;
      setDragging(false);
      setOverBoard(false);
      onDraggingChange(false);
      if (droppedOnBoard) onBombard();
    };

    const handleMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerIdRef.current) return;
      if (previewRef.current) {
        previewRef.current.style.transform = `translate3d(${event.clientX - 24}px, ${event.clientY - 24}px, 0)`;
      }
      const overBoard = isPointOnBoard(event.clientX, event.clientY);
      setOverBoard((previous) => previous === overBoard ? previous : overBoard);
    };
    const handleUp = (event: PointerEvent) => finishDrag(event, true);
    const handleCancel = (event: PointerEvent) => finishDrag(event, false);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
    };
  }, [dragging, enabled, hasTargets, onBombard, onDraggingChange]);

  useEffect(() => () => {
    if (pointerIdRef.current !== null) {
      pointerIdRef.current = null;
      onDraggingChange(false);
    }
  }, [onDraggingChange]);

  const startDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!enabled || !hasTargets) return;
    pointerIdRef.current = event.pointerId;
    setPosition({ x: event.clientX, y: event.clientY });
    setDragging(true);
    onDraggingChange(true);
  };

  return (
    <>
      <span
        role="img"
        aria-label={enabled && hasTargets ? "Boule de feu disponible, à glisser sur la grille" : "Boule de feu disponible à ton prochain tour"}
        title={enabled && hasTargets ? "Glisse la boule de feu sur la grille pour bombarder" : "Boule de feu disponible quand ce joueur pourra jouer"}
        onPointerDown={startDrag}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        className={`inline-flex h-7 w-7 shrink-0 touch-none select-none ${
          enabled && hasTargets ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-60"
        }`}
      >
        <Image
          src="/images/boule-de-feu.png"
          alt=""
          width={224}
          height={230}
          draggable={false}
          className="pointer-events-none h-full w-full object-contain"
        />
      </span>
      {dragging && typeof document !== "undefined" && createPortal(
        <div
          ref={previewRef}
          aria-hidden="true"
          className={`pointer-events-none fixed left-0 top-0 z-[100] h-12 w-12 ${
            overBoard ? "drop-shadow-[0_0_12px_rgba(251,146,60,0.95)]" : "opacity-90"
          }`}
          style={{ transform: `translate3d(${position.x - 24}px, ${position.y - 24}px, 0)` }}
        >
          <Image
            src="/images/boule-de-feu.png"
            alt=""
            width={224}
            height={230}
            className="h-full w-full object-contain"
          />
        </div>,
        document.body,
      )}
    </>
  );
}
