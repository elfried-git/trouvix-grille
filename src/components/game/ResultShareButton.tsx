"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createResultImage, type ResultImagePlayer } from "@/lib/result-image";

interface ResultShareButtonProps {
  players: ResultImagePlayer[];
  tiedPlayerIds?: string[];
}

function downloadImage(file: File) {
  const imageUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = imageUrl;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
}

export function ResultShareButton({ players, tiedPlayerIds = [] }: ResultShareButtonProps) {
  const [isPreparing, setIsPreparing] = useState(false);

  const shareResult = async () => {
    setIsPreparing(true);
    try {
      const image = await createResultImage(players, tiedPlayerIds);
      if (
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [image] })
      ) {
        await navigator.share({ files: [image], title: "Résultat de partie Trouvix" });
        toast.success("Image du résultat partagée !");
      } else {
        downloadImage(image);
        toast.success("Image téléchargée. Tu peux maintenant la partager sur tes réseaux.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Impossible de créer ou partager l’image du résultat.", error);
      toast.error("Impossible de partager l’image. Réessaie.");
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <Button
      onClick={shareResult}
      size="lg"
      disabled={isPreparing}
      className="h-12 bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 text-base text-white shadow-md hover:from-violet-500 hover:to-fuchsia-400"
    >
      <Share2 className="mr-2 h-5 w-5" />
      {isPreparing ? "Préparation de l’image..." : "Partager le résultat"}
    </Button>
  );
}
