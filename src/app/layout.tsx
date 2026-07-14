import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Trouvix Grille",
  description:
    "Trouvix Grille : le jeu du carré. Place tes pions où tu veux dans la grille, forme un carré de 4 pions (2×2) pour marquer, 10 secondes par coup, pause à tout moment, de 2 à 6 joueurs, match à 5/10/15 rounds.",
  keywords: [
    "Trouvix Grille",
    "Trouvix",
    "jeu du carré",
    "jeu de pions",
    "jeu de société",
    "placement libre",
    "chrono",
    "pause",
    "multi-joueurs",
  ],
  authors: [{ name: "Trouvix" }],
  icons: {
    icon: "/trouvix-logo.svg",
    apple: "/trouvix-logo.svg",
  },
  openGraph: {
    title: "Trouvix Grille",
    description:
      "Place tes pions librement, forme un carré 2×2, 10s par coup, pause à tout moment, 2 à 6 joueurs.",
    type: "website",
    images: ["/trouvix-logo.svg"],
  },
  twitter: {
    card: "summary",
    title: "Trouvix Grille",
    description:
      "Place tes pions librement, forme un carré 2×2, 10s par coup, pause à tout moment, 2 à 6 joueurs.",
    images: ["/trouvix-logo.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* Preload Benchou Ferrari photo for instant display */}
        <link rel="preload" as="image" href="/benchou-ferrari-small.jpg" fetchPriority="high" />
        {/* Preload logo */}
        <link rel="preload" as="image" href="/trouvix-logo.svg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
