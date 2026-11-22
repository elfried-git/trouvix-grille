import type { GiftSpaceView } from "./gift-draw";

// Genre des participants au Cadeau Noël. Partagé par le client et les serveurs de jeu.

export const GIFT_GENDERS = ["masculin", "feminin"] as const;
export type GiftGender = (typeof GIFT_GENDERS)[number];

export const GIFT_GENDER_LABELS: Record<GiftGender, string> = {
  masculin: "Masculin",
  feminin: "Féminin",
};

export function isGiftGender(value: unknown): value is GiftGender {
  return typeof value === "string" && (GIFT_GENDERS as readonly string[]).includes(value);
}

/** Vue d'un espace avec le genre de chaque participant (visible par tous). */
export type GiftSpaceViewWithGender = Omit<GiftSpaceView, "participants"> & {
  participants: (GiftSpaceView["participants"][number] & { gender: GiftGender | null })[];
};
