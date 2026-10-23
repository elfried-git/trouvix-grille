let audioContext: AudioContext | null = null;

export async function enableNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported";
  }

  const permissionRequest = Notification.permission === "default"
    ? Notification.requestPermission()
    : Promise.resolve(Notification.permission);

  try {
    const AudioContextConstructor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextConstructor) {
      audioContext ??= new AudioContextConstructor();
      if (audioContext.state === "suspended") await audioContext.resume();
    }
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch (error) {
    console.warn("[admin-notifications] service worker unavailable", error);
  }

  return permissionRequest;
}

export async function notifyAdminChallenge(challengerName: string, challengeId: string) {
  if (typeof window === "undefined") return;

  if ("Notification" in window && Notification.permission === "granted") {
    const options: NotificationOptions = {
      body: `${challengerName} vous invite à jouer. Ouvrez Trouvix pour répondre.`,
      icon: "/trouvix-logo.svg",
      tag: challengeId,
      data: { url: "/" },
    };
    try {
      const registration = await navigator.serviceWorker?.getRegistration("/");
      if (registration) await registration.showNotification("🎮 Nouveau défi Trouvix", options);
      else new Notification("🎮 Nouveau défi Trouvix", options);
    } catch (error) {
      console.warn("[admin-notifications] could not show notification", error);
    }
  }

  if (audioContext?.state === "running") {
    const now = audioContext.currentTime;
    [880, 1175, 880].forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      const start = now + index * 0.18;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      oscillator.connect(gain);
      gain.connect(audioContext!.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  }
}

export async function notifyRoomCreated(hostName: string, roomCode: string, maxPlayers: number) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;

  const options: NotificationOptions = {
    body: `${hostName} vient de créer un salon (${maxPlayers} joueurs). Touchez pour le rejoindre.`,
    icon: "/trouvix-logo.svg",
    tag: `room-${roomCode}`,
    data: { url: `/?salon=${encodeURIComponent(roomCode)}` },
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration("/");
    if (registration) await registration.showNotification("🎲 Nouveau salon Trouvix", options);
    else new Notification("🎲 Nouveau salon Trouvix", options);
  } catch (error) {
    console.warn("[notifications] could not show room notification", error);
  }
}
