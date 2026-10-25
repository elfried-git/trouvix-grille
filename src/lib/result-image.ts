export interface ResultImagePlayer {
  id: string;
  name: string;
  color: string;
  score: number;
}

const WIDTH = 1080;
const HEIGHT = 1350;
const OUTPUT_SCALE = 2;
const FONT = 'Arial, "Helvetica Neue", sans-serif';
const CYAN = "#39d8ff";
const GOLD = "#ffd166";

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initialSize: number,
  weight = 700,
) {
  let size = initialSize;
  context.font = `${weight} ${size}px ${FONT}`;
  while (context.measureText(text).width > maxWidth && size > 22) {
    size -= 2;
    context.font = `${weight} ${size}px ${FONT}`;
  }
  return size;
}

function trackedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  const width = [...text].reduce(
    (total, character) => total + context.measureText(character).width + spacing,
    -spacing,
  );
  let cursor = x - width / 2;
  for (const character of text) {
    context.fillText(character, cursor, y);
    cursor += context.measureText(character).width + spacing;
  }
}

function drawCrown(context: CanvasRenderingContext2D, x: number, y: number, color: string) {
  context.save();
  context.translate(x, y);
  context.fillStyle = color;
  context.shadowColor = color;
  context.shadowBlur = 18;
  context.beginPath();
  context.moveTo(-30, 14);
  context.lineTo(-38, -15);
  context.lineTo(-16, -3);
  context.lineTo(0, -29);
  context.lineTo(16, -3);
  context.lineTo(38, -15);
  context.lineTo(30, 14);
  context.closePath();
  context.fill();
  context.fillRect(-30, 19, 60, 7);
  context.restore();
}

function drawBackground(context: CanvasRenderingContext2D) {
  const background = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, "#06132d");
  background.addColorStop(0.48, "#071a38");
  background.addColorStop(1, "#040a18");
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = context.createRadialGradient(540, 500, 20, 540, 500, 800);
  glow.addColorStop(0, "rgba(0, 125, 255, 0.2)");
  glow.addColorStop(0.55, "rgba(0, 90, 220, 0.08)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.save();
  context.strokeStyle = "rgba(73, 174, 255, 0.045)";
  context.lineWidth = 1;
  for (let x = 50; x < WIDTH; x += 46) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, HEIGHT);
    context.stroke();
  }
  for (let y = 26; y < HEIGHT; y += 46) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WIDTH, y);
    context.stroke();
  }

  context.strokeStyle = "rgba(47, 165, 255, 0.42)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(1040, 140, 260, 1.2, 2.8);
  context.stroke();
  context.beginPath();
  context.arc(14, 1195, 300, 4.4, 6.1);
  context.stroke();
  context.restore();

  context.strokeStyle = "rgba(80, 195, 255, 0.65)";
  context.lineWidth = 2;
  roundedRect(context, 26, 26, WIDTH - 52, HEIGHT - 52, 34);
  context.stroke();
}

function drawBrandHeader(context: CanvasRenderingContext2D, logo: HTMLImageElement) {
  const headerGradient = context.createLinearGradient(68, 62, 1012, 176);
  headerGradient.addColorStop(0, "rgba(12, 43, 87, 0.92)");
  headerGradient.addColorStop(0.55, "rgba(8, 29, 61, 0.94)");
  headerGradient.addColorStop(1, "rgba(10, 23, 49, 0.9)");
  context.fillStyle = headerGradient;
  roundedRect(context, 68, 58, 944, 132, 28);
  context.fill();
  context.strokeStyle = "rgba(62, 191, 255, 0.48)";
  context.lineWidth = 2;
  context.stroke();

  context.save();
  context.shadowColor = "rgba(28, 157, 255, 0.6)";
  context.shadowBlur = 24;
  context.drawImage(logo, 91, 75, 98, 98);
  context.restore();

  context.textAlign = "left";
  context.fillStyle = "#ffffff";
  context.font = `800 34px ${FONT}`;
  context.fillText("TROUVIX", 215, 120);
  context.fillStyle = "rgba(200, 232, 255, 0.86)";
  context.font = `600 17px ${FONT}`;
  context.fillText("LE JEU DU CARRÉ", 217, 151);

  const pillGradient = context.createLinearGradient(700, 84, 977, 154);
  pillGradient.addColorStop(0, "rgba(20, 112, 210, 0.4)");
  pillGradient.addColorStop(1, "rgba(13, 56, 119, 0.4)");
  context.fillStyle = pillGradient;
  roundedRect(context, 722, 91, 254, 62, 31);
  context.fill();
  context.strokeStyle = "rgba(57, 216, 255, 0.55)";
  context.lineWidth = 1.5;
  context.stroke();
  context.fillStyle = CYAN;
  context.font = `700 16px ${FONT}`;
  trackedText(context, "RÉSULTAT DE PARTIE", 849, 129, 1.7);
}

async function loadLogo() {
  const logo = new Image();
  logo.src = new URL("/trouvix-logo.svg", window.location.href).href;
  await logo.decode();
  return logo;
}

export async function createResultImage(
  players: ResultImagePlayer[],
  tiedPlayerIds: string[] = [],
): Promise<File> {
  if (players.length === 0) {
    throw new Error("Aucun joueur à afficher sur la carte de résultat.");
  }

  const ranked = [...players].sort((a, b) => b.score - a.score);
  const maxScore = ranked[0].score;
  const tiedPlayers = tiedPlayerIds.length > 1
    ? ranked.filter((player) => tiedPlayerIds.includes(player.id))
    : ranked.filter((player) => player.score === maxScore);
  const isTie = tiedPlayers.length > 1;
  const winner = isTie ? null : ranked[0];
  const logo = await loadLogo();

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * OUTPUT_SCALE;
  canvas.height = HEIGHT * OUTPUT_SCALE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Le navigateur ne peut pas créer l’image du résultat.");
  context.scale(OUTPUT_SCALE, OUTPUT_SCALE);

  drawBackground(context);
  drawBrandHeader(context, logo);

  const heroGradient = context.createLinearGradient(112, 235, 968, 592);
  heroGradient.addColorStop(0, "rgba(10, 62, 128, 0.88)");
  heroGradient.addColorStop(0.48, "rgba(8, 36, 82, 0.93)");
  heroGradient.addColorStop(1, "rgba(7, 23, 55, 0.96)");
  context.fillStyle = heroGradient;
  roundedRect(context, 92, 226, 896, 366, 34);
  context.fill();
  context.save();
  context.shadowColor = "rgba(21, 168, 255, 0.45)";
  context.shadowBlur = 24;
  context.strokeStyle = "rgba(57, 216, 255, 0.72)";
  context.lineWidth = 2;
  context.stroke();
  context.restore();

  context.save();
  context.strokeStyle = "rgba(57, 216, 255, 0.18)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(540, 410, 225, 0.35, 2.8);
  context.stroke();
  context.beginPath();
  context.arc(540, 410, 250, 3.4, 5.9);
  context.stroke();
  context.restore();

  const winnerColor = isTie ? CYAN : (winner?.color || GOLD);
  const status = isTie ? "MATCH NUL" : "CHAMPION";
  context.fillStyle = "rgba(57, 216, 255, 0.12)";
  roundedRect(context, 414, 253, 252, 42, 21);
  context.fill();
  context.strokeStyle = "rgba(57, 216, 255, 0.38)";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = CYAN;
  context.font = `800 17px ${FONT}`;
  trackedText(context, status, WIDTH / 2, 281, 3.2);

  drawCrown(context, WIDTH / 2, 348, isTie ? CYAN : GOLD);

  const title = winner
    ? winner.name.trim() || "Joueur"
    : tiedPlayers.map((player) => player.name.trim() || "Joueur").join("  ·  ");
  const titleSize = fitText(context, title, 820, isTie ? 62 : 88);
  context.font = `800 ${titleSize}px ${FONT}`;
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.shadowColor = "rgba(31, 174, 255, 0.5)";
  context.shadowBlur = 18;
  context.fillText(title, WIDTH / 2, 446, 820);
  context.shadowBlur = 0;

  const scoreLabel = `${maxScore} ${maxScore === 1 ? "POINT" : "POINTS"}`;
  context.font = `800 27px ${FONT}`;
  const scoreWidth = context.measureText(scoreLabel).width + 56;
  const scorePillGradient = context.createLinearGradient(
    WIDTH / 2 - scoreWidth / 2,
    472,
    WIDTH / 2 + scoreWidth / 2,
    526,
  );
  scorePillGradient.addColorStop(0, "#ffd166");
  scorePillGradient.addColorStop(1, "#ffad36");
  context.fillStyle = scorePillGradient;
  roundedRect(context, WIDTH / 2 - scoreWidth / 2, 474, scoreWidth, 54, 27);
  context.fill();
  context.fillStyle = "#10213d";
  context.font = `800 25px ${FONT}`;
  context.textAlign = "center";
  context.fillText(scoreLabel, WIDTH / 2, 509);

  context.fillStyle = "#ffffff";
  context.font = `800 24px ${FONT}`;
  context.textAlign = "left";
  context.fillText("CLASSEMENT", 108, 642);
  context.fillStyle = CYAN;
  context.beginPath();
  context.arc(966, 633, 5, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(198, 225, 255, 0.7)";
  context.font = `700 15px ${FONT}`;
  context.textAlign = "right";
  context.fillText("SCORE", 950, 641);

  const listTop = 674;
  const rowGap = 10;
  const availableRowsHeight = 626;
  const rowHeight = Math.min(
    100,
    Math.floor((availableRowsHeight - rowGap * Math.max(0, ranked.length - 1)) / ranked.length),
  );
  const lineX = 148;
  context.strokeStyle = "rgba(57, 216, 255, 0.24)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(lineX, listTop + rowHeight / 2);
  context.lineTo(lineX, listTop + (ranked.length - 1) * (rowHeight + rowGap) + rowHeight / 2);
  context.stroke();

  ranked.forEach((player, index) => {
    const y = listTop + index * (rowHeight + rowGap);
    const isWinner = winner?.id === player.id || tiedPlayers.some((tied) => tied.id === player.id);
    const centerY = y + rowHeight / 2;
    const rowGradient = context.createLinearGradient(110, y, 970, y + rowHeight);
    if (isWinner) {
      rowGradient.addColorStop(0, "rgba(14, 94, 158, 0.86)");
      rowGradient.addColorStop(1, "rgba(8, 48, 102, 0.9)");
    } else {
      rowGradient.addColorStop(0, "rgba(13, 39, 76, 0.83)");
      rowGradient.addColorStop(1, "rgba(8, 25, 54, 0.88)");
    }
    context.fillStyle = rowGradient;
    roundedRect(context, 108, y, 864, rowHeight, 22);
    context.fill();
    context.strokeStyle = isWinner
      ? "rgba(57, 216, 255, 0.82)"
      : "rgba(99, 162, 220, 0.3)";
    context.lineWidth = isWinner ? 2 : 1.2;
    context.stroke();

    context.fillStyle = "#07162e";
    context.beginPath();
    context.arc(lineX, centerY, 24, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = isWinner ? GOLD : CYAN;
    context.lineWidth = 2.5;
    context.stroke();
    context.fillStyle = isWinner ? GOLD : "#bfefff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `800 ${Math.min(21, rowHeight * 0.25)}px ${FONT}`;
    context.fillText(String(index + 1), lineX, centerY + 1);

    context.fillStyle = player.color || CYAN;
    context.beginPath();
    context.arc(204, centerY, Math.min(13, rowHeight * 0.14), 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(255,255,255,0.75)";
    context.lineWidth = 1.5;
    context.stroke();

    const playerName = player.name.trim() || "Joueur";
    const nameSize = fitText(context, playerName, 500, Math.min(34, rowHeight * 0.37), 700);
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.font = `700 ${nameSize}px ${FONT}`;
    context.fillStyle = "#f4f9ff";
    context.fillText(playerName, 239, centerY, 500);

    context.textAlign = "right";
    context.fillStyle = isWinner ? GOLD : "#ffffff";
    context.font = `800 ${Math.min(32, rowHeight * 0.36)}px ${FONT}`;
    context.fillText(`${player.score} pts`, 944, centerY);
  });
  context.textBaseline = "alphabetic";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Le navigateur n’a pas pu exporter l’image."));
    }, "image/png");
  });
  const date = new Date().toISOString().slice(0, 10);
  return new File([blob], `trouvix-resultat-${date}.png`, { type: "image/png" });
}
