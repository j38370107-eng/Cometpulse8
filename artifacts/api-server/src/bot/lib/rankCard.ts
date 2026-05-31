import { createCanvas, loadImage } from "@napi-rs/canvas";
import https from "node:https";
import http from "node:http";

const W = 934;
const H = 282;

async function fetchBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    mod
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchBuffer(res.headers.location).then(resolve).catch(reject);
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function roundedRect(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexPath(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawHexGrid(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(120, 60, 220, 0.18)";
  ctx.lineWidth = 1;

  const positions: [number, number, number][] = [
    [820, 42, 52],
    [870, 100, 34],
    [760, 90, 28],
    [900, 40, 24],
    [780, 22, 18],
    [840, 148, 22],
    [700, 50, 16],
  ];

  for (const [cx, cy, r] of positions) {
    hexPath(ctx, cx, cy, r);
    ctx.stroke();

    const innerR = r * 0.55;
    hexPath(ctx, cx, cy, innerR);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(150, 80, 255, 0.5)";
      ctx.fill();
    }
  }

  const linePositions: [number, number][] = [
    [820, 42],
    [870, 100],
    [760, 90],
  ];
  ctx.strokeStyle = "rgba(120, 60, 220, 0.12)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < linePositions.length - 1; i++) {
    ctx.beginPath();
    ctx.moveTo(linePositions[i][0], linePositions[i][1]);
    ctx.lineTo(linePositions[i + 1][0], linePositions[i + 1][1]);
    ctx.stroke();
  }

  ctx.restore();
}

function drawGlow(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
  grd.addColorStop(0, color);
  grd.addColorStop(1, "transparent");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

export interface RankCardOptions {
  username: string;
  handle: string;
  avatarUrl: string | null;
  level: number;
  currentLevelXp: number;
  levelXpNeeded: number;
  totalXp: number;
  rank: number;
  xpGained?: number;
  botName?: string;
}

export async function generateRankCard(opts: RankCardOptions): Promise<Buffer> {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const {
    username,
    handle,
    avatarUrl,
    level,
    currentLevelXp,
    levelXpNeeded,
    totalXp,
    rank,
    xpGained,
    botName = "CometPulse",
  } = opts;

  // ── Background ────────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, "#0b0120");
  bgGrad.addColorStop(0.45, "#18064a");
  bgGrad.addColorStop(1, "#0b0120");
  ctx.fillStyle = bgGrad;
  roundedRect(ctx, 0, 0, W, H, 20);
  ctx.fill();

  // Subtle purple glow bottom left
  drawGlow(ctx, 100, H + 20, 160, "rgba(90, 30, 180, 0.25)");
  // Subtle blue glow top right
  drawGlow(ctx, W - 80, -20, 140, "rgba(40, 80, 220, 0.18)");

  // ── Border ────────────────────────────────────────────────────────────────
  roundedRect(ctx, 0, 0, W, H, 20);
  ctx.strokeStyle = "rgba(110, 50, 200, 0.7)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── Hexagon decorations (top right area) ─────────────────────────────────
  drawHexGrid(ctx);

  // ── Avatar circle ─────────────────────────────────────────────────────────
  const avX = 108;
  const avY = 112;
  const avR = 68;

  // Outer glow ring
  drawGlow(ctx, avX, avY, avR + 28, "rgba(100, 40, 200, 0.22)");

  // Ring border
  ctx.beginPath();
  ctx.arc(avX, avY, avR + 4, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(130, 60, 240, 0.8)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Avatar clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX, avY, avR, 0, Math.PI * 2);
  ctx.clip();

  if (avatarUrl) {
    try {
      const buf = await fetchBuffer(avatarUrl);
      const img = await loadImage(buf);
      ctx.drawImage(img, avX - avR, avY - avR, avR * 2, avR * 2);
    } catch {
      ctx.fillStyle = "#2d1b69";
      ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
    }
  } else {
    ctx.fillStyle = "#2d1b69";
    ctx.fillRect(avX - avR, avY - avR, avR * 2, avR * 2);
  }
  ctx.restore();

  // ── Lightning badge on avatar ─────────────────────────────────────────────
  const badgeX = avX + 46;
  const badgeY = avY + 48;
  const badgeR = 18;

  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeR + 2, 0, Math.PI * 2);
  ctx.fillStyle = "#18064a";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
  const badgeGrad = ctx.createRadialGradient(badgeX - 4, badgeY - 4, 2, badgeX, badgeY, badgeR);
  badgeGrad.addColorStop(0, "#7c3cfa");
  badgeGrad.addColorStop(1, "#4a1aad");
  ctx.fillStyle = badgeGrad;
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("⚡", badgeX, badgeY + 1);

  // ── Bot name / header ─────────────────────────────────────────────────────
  const textX = 210;

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 38px Arial";
  ctx.fillText(botName, textX, 60);

  ctx.fillStyle = "rgba(170, 140, 220, 0.75)";
  ctx.font = "bold 11px Arial";
  ctx.letterSpacing = "2px";
  ctx.fillText("ADVANCED DISCORD UTILITY BOT", textX, 80);
  ctx.letterSpacing = "0px";

  // Divider line under subtitle
  ctx.beginPath();
  ctx.moveTo(textX, 88);
  ctx.lineTo(textX + 340, 88);
  ctx.strokeStyle = "rgba(110, 50, 200, 0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Username
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Arial";
  ctx.fillText(username, textX, 118);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(160, 130, 210, 0.8)";
  ctx.font = "14px Arial";
  ctx.fillText(`@${handle}`, textX, 142);

  // ── Level row ─────────────────────────────────────────────────────────────
  const rowY = 172;

  ctx.fillStyle = "#f5c842";
  ctx.font = "bold 18px Arial";
  ctx.fillText("⚡", textX, rowY);

  ctx.fillStyle = "rgba(180, 150, 230, 0.8)";
  ctx.font = "bold 14px Arial";
  ctx.fillText("LEVEL", textX + 24, rowY);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px Arial";
  ctx.fillText(String(level), textX + 76, rowY + 2);

  // XP gained indicator (top right of bar area)
  if (xpGained !== undefined && xpGained > 0) {
    ctx.fillStyle = "#4dabf7";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`+${xpGained}`, W - 30, rowY);
    ctx.textAlign = "left";
  }

  // ── Progress bar ─────────────────────────────────────────────────────────
  const barX = textX;
  const barY = rowY + 14;
  const barW = W - textX - 30;
  const barH = 18;
  const barR = 9;
  const progress = levelXpNeeded > 0 ? Math.min(currentLevelXp / levelXpNeeded, 1) : 0;

  // Bar background
  roundedRect(ctx, barX, barY, barW, barH, barR);
  ctx.fillStyle = "rgba(60, 20, 100, 0.8)";
  ctx.fill();

  // Bar fill (gradient)
  if (progress > 0) {
    const fillW = Math.max(barR * 2, barW * progress);
    const barGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    barGrad.addColorStop(0, "#3b82f6");
    barGrad.addColorStop(0.5, "#7c3cfa");
    barGrad.addColorStop(1, "#a855f7");
    roundedRect(ctx, barX, barY, fillW, barH, barR);
    ctx.fillStyle = barGrad;
    ctx.fill();

    // Glow on fill
    roundedRect(ctx, barX, barY, fillW, barH, barR);
    ctx.strokeStyle = "rgba(160, 100, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Dot handle at end of bar
    const dotX = barX + fillW;
    const dotY = barY + barH / 2;
    drawGlow(ctx, dotX, dotY, 14, "rgba(160, 100, 255, 0.35)");
    ctx.beginPath();
    ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#a855f7";
    ctx.fill();
  }

  // ── XP text below bar ─────────────────────────────────────────────────────
  const xpRowY = barY + barH + 20;

  // Left: XP badge + current/max
  roundedRect(ctx, barX, xpRowY - 14, 32, 16, 4);
  ctx.fillStyle = "rgba(100, 40, 180, 0.7)";
  ctx.fill();
  ctx.fillStyle = "#c4a0ff";
  ctx.font = "bold 9px Arial";
  ctx.textBaseline = "middle";
  ctx.fillText("XP", barX + 6, xpRowY - 6);
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px Arial";
  ctx.fillText(`${totalXp.toLocaleString()}`, barX + 38, xpRowY);

  // Center: progress in current level
  const midX = barX + barW / 2 - 10;
  ctx.fillStyle = "rgba(160, 130, 210, 0.7)";
  ctx.font = "13px Arial";
  ctx.fillText("XP", midX, xpRowY);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px Arial";
  ctx.fillText(
    `${currentLevelXp.toLocaleString()}/${levelXpNeeded.toLocaleString()}XP`,
    midX + 24,
    xpRowY,
  );

  // ── Rank + total XP footer ────────────────────────────────────────────────
  const footerY = xpRowY + 26;

  ctx.fillStyle = "rgba(160, 130, 210, 0.75)";
  ctx.font = "bold 13px Arial";
  ctx.fillText("RANK", barX, footerY);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial";
  ctx.fillText(`#${rank}`, barX + 50, footerY);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(160, 130, 210, 0.75)";
  ctx.font = "bold 13px Arial";
  ctx.fillText("XP", W - 30, footerY);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Arial";
  ctx.fillText(`${totalXp.toLocaleString()}`, W - 50, footerY);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}
