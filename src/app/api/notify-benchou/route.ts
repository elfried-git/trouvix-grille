import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/notify-benchou
// Called by the game-service when a player challenges Benchou Ferrari.
// In production: connect this to an email service (SendGrid, Mailgun, AWS SES, etc.)
// or a webhook (Discord, Slack, Telegram bot).
//
// For now (sandbox): logs the notification + returns the challenge details.
// To enable email: set BENCHOU_EMAIL + EMAIL_SERVICE_API_KEY env vars
// and uncomment the email-sending code below.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { challengerName, roomCode, totalRounds, challengeId } = body;

    if (!challengerName || !roomCode) {
      return NextResponse.json(
        { error: "Le nom du joueur et le code du salon sont requis" },
        { status: 400 }
      );
    }

    const gameUrl = `${req.nextUrl.origin}/?join=${roomCode}`;

    // === NOTIFICATION CONTENT ===
    const notification = {
      to: process.env.BENCHOU_EMAIL || "benchou@trouvix.com",
      subject: `🎮 ${challengerName} sollicite une partie de Trouvix Grille`,
      body: `
Bonjour Benchou Ferrari,

${challengerName} vient de vous défier sur Trouvix Grille !

Détails du défi :
- Joueur : ${challengerName}
- Match en ${totalRounds} rounds
- Code du salon : ${roomCode}

Cliquez ici pour rejoindre la partie :
${gameUrl}

Le défi expire si la salle est fermée.

— Trouvix Grille
      `.trim(),
      challengeId,
      roomCode,
      gameUrl,
      timestamp: new Date().toISOString(),
    };

    // Log the notification (visible in server logs)
    console.log("📧 [NOTIFY BENCHOU]", {
      challenger: challengerName,
      roomCode,
      gameUrl,
    });

    // === EMAIL SENDING (uncomment + configure in production) ===
    // if (process.env.EMAIL_SERVICE_API_KEY) {
    //   await fetch("https://api.sendgrid.com/v3/mail/send", {
    //     method: "POST",
    //     headers: {
    //       Authorization: `Bearer ${process.env.EMAIL_SERVICE_API_KEY}`,
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({
    //       personalizations: [{ to: [{ email: notification.to }] }],
    //       from: { email: "noreply@trouvix.com" },
    //       subject: notification.subject,
    //       content: [{ type: "text/plain", value: notification.body }],
    //     }),
    //   });
    // }

    // === DISCORD/SLACK WEBHOOK (uncomment + configure in production) ===
    // if (process.env.BENCHOU_WEBHOOK_URL) {
    //   await fetch(process.env.BENCHOU_WEBHOOK_URL, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       content: `🎮 **${challengerName}** vous défie sur Trouvix Grille !\nMatch en ${totalRounds} rounds\nRejoignez : ${gameUrl}`,
    //     }),
    //   });
    // }

    return NextResponse.json({
      ok: true,
      message: "Notification logged",
      gameUrl,
    });
  } catch (err) {
    console.error("[notify-benchou] error:", err);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
