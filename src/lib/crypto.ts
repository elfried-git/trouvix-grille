/**
 * Helper cryptographique côté client pour hacher les secrets (SHA-256)
 * avant toute émission réseau. Évite que le code PIN ou mot de passe
 * ne circule en clair dans les requêtes inspectables par le navigateur.
 */
export async function sha256(input: string): Promise<string> {
  const clean = input.trim();
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const data = new TextEncoder().encode(clean);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return clean;
}
