"use client";

import { isPhotoAvatar } from "@/lib/types";

interface AvatarProps {
  avatar: string; // empty string = plain colored bubble; data URL = uploaded photo
  color: string; // background color (used for the bubble / fallback)
  size?: number; // pixel size (default 36)
  emojiSize?: string; // tailwind text size class for emoji (default text-lg)
  ring?: boolean; // show white ring (default true)
  className?: string;
}

export function Avatar({
  avatar,
  color,
  size = 36,
  emojiSize = "text-lg",
  ring = true,
  className = "",
}: AvatarProps) {
  const isPhoto = isPhotoAvatar(avatar);
  const isEmpty = !avatar; // plain colored bubble, no photo, no emoji
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${
        ring ? "ring-2 ring-white/20" : ""
      } ${className}`}
      style={{ backgroundColor: color, width: size, height: size }}
    >
      {isPhoto ? (
        <img
          src={avatar}
          alt="Avatar"
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : isEmpty ? null : (
        <span className={emojiSize}>{avatar}</span>
      )}
    </div>
  );
}
