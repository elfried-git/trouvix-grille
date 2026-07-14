"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
  readOnly?: boolean;
  className?: string;
}

export function StarRating({
  value,
  onChange,
  size = 24,
  readOnly = false,
  className,
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const isInteractive = !readOnly && !!onChange;
  const displayValue = hover || value;

  return (
    <div
      role={isInteractive ? "radiogroup" : undefined}
      aria-label={isInteractive ? "Noter de 1 à 5 étoiles" : undefined}
      className={cn("inline-flex items-center gap-0.5", className)}
      onMouseLeave={() => isInteractive && setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue;
        return (
          <button
            key={star}
            type="button"
            disabled={!isInteractive}
            onClick={() => isInteractive && onChange?.(star)}
            onMouseEnter={() => isInteractive && setHover(star)}
            aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
            aria-checked={isInteractive && value === star}
            role={isInteractive ? "radio" : undefined}
            className={cn(
              "transition-transform",
              isInteractive && "cursor-pointer hover:scale-110",
              !isInteractive && "cursor-default"
            )}
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "text-amber-400/30"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}