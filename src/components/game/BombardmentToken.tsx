"use client";

import Image from "next/image";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

interface BombardmentTokenProps {
  enabled: boolean;
  hasTargets: boolean;
  playerId: string;
}

export function BombardmentToken({
  enabled,
  hasTargets,
  playerId,
}: BombardmentTokenProps) {
  const canDrag = enabled && hasTargets;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `bombardment-${playerId}`,
    disabled: !canDrag,
    data: { type: "bombardment" },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={canDrag ? "Glisser la boule de feu sur la grille pour bombarder" : "Boule de feu disponible"}
      title={
        !enabled
          ? "Boule de feu disponible à ton prochain tour"
          : !hasTargets
            ? "Aucun carré adverse presque formé"
            : "Glisse la boule de feu sur la grille pour bombarder"
      }
      {...listeners}
      {...attributes}
      tabIndex={canDrag ? 0 : -1}
      style={{
        transform: CSS.Translate.toString(transform),
        touchAction: "none",
      }}
      className={`inline-flex h-7 w-7 shrink-0 select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
        canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-60"
      } ${isDragging ? "opacity-30" : ""}`}
    >
      <Image
        src="/images/boule-de-feu.png"
        alt=""
        width={224}
        height={230}
        draggable={false}
        className="pointer-events-none h-full w-full object-contain"
      />
    </button>
  );
}
