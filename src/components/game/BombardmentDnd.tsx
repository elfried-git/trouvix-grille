"use client";

import Image from "next/image";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import type { ReactNode } from "react";

interface BombardmentDndProviderProps {
  children: ReactNode;
  onBombard: () => void;
}

export function BombardmentDndProvider({
  children,
  onBombard,
}: BombardmentDndProviderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (active.data.current?.type === "bombardment" && over?.id === "bombardment-board") {
      onBombard();
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        <Image
          src="/images/boule-de-feu.png"
          alt=""
          aria-hidden="true"
          width={224}
          height={230}
          className="h-20 w-20 scale-125 object-contain drop-shadow-[0_0_16px_rgba(251,146,60,0.95)]"
        />
      </DragOverlay>
    </DndContext>
  );
}

interface BombardmentDropZoneProps {
  children: ReactNode;
  className: string;
}

export function BombardmentDropZone({
  children,
  className,
}: BombardmentDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({ id: "bombardment-board" });

  return (
    <div
      ref={setNodeRef}
      data-bombardment-board
      className={`${className} ${isOver ? "ring-4 ring-orange-400/80" : ""}`}
    >
      {children}
    </div>
  );
}
