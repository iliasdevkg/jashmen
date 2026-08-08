// src/shareCard.js — draws the "Кнопка «Поделиться успехом»" share card the
// manifest asks for, as a real PNG (Canvas 2D, no server round-trip), sized
// for Instagram Stories (1080×1920). Handed to the Web Share API so mobile
// browsers can route it straight into Instagram/WhatsApp's native share
// sheet; desktop/unsupported browsers fall back to a plain download.

const W = 1080;
const H = 1920;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return lines.length;
}

export async function generateShareCardBlob({ userName, lessonTitle, xp, coins, perfect }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f1e38');
  bg.addColorStop(0.55, '#0f172a');
  bg.addColorStop(1, '#080d1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft accent glow
  const glow = ctx.createRadialGradient(W / 2, 420, 40, W / 2, 420, 520);
  glow.addColorStop(0, 'rgba(28,176,246,0.35)');
  glow.addColorStop(1, 'rgba(28,176,246,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Wordmark
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1CB0F6';
  ctx.font = '700 56px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('JashMen', W / 2, 180);

  // Trophy / medal
  ctx.font = '260px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(perfect ? '🏆' : '✅', W / 2, 620);

  // Headline
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 72px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(perfect ? 'Мыкты аткардым!' : 'Сабакты бүттүм!', W / 2, 780);

  // Lesson title card
  const cardX = 90, cardY = 860, cardW = W - 180, cardH = 220;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.fill();
  ctx.strokeStyle = 'rgba(28,176,246,0.4)';
  ctx.lineWidth = 3;
  roundRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 34px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('САБАК', W / 2, cardY + 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 52px -apple-system, "Segoe UI", sans-serif';
  wrapText(ctx, lessonTitle || '', W / 2, cardY + 140, cardW - 80, 60);

  // Stats row
  const statY = 1180;
  const statGap = 340;
  const statX1 = W / 2 - statGap / 2;
  const statX2 = W / 2 + statGap / 2;

  ctx.font = '80px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('⭐', statX1, statY);
  ctx.fillText('🪙', statX2, statY);

  ctx.font = '800 64px -apple-system, "Segoe UI", sans-serif';
  ctx.fillStyle = '#FFD700';
  ctx.fillText(`+${xp}`, statX1, statY + 90);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`+${coins}`, statX2, statY + 90);

  ctx.font = '600 34px -apple-system, "Segoe UI", sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('XP', statX1, statY + 140);
  ctx.fillText('coins', statX2, statY + 140);

  // Footer
  ctx.font = '600 38px -apple-system, "Segoe UI", sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(userName ? `${userName} · jashmen.app` : 'jashmen.app', W / 2, H - 100);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

export function canShareFiles() {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  try {
    const probe = new File([new Blob(['x'])], 'probe.png', { type: 'image/png' });
    return navigator.canShare({ files: [probe] });
  } catch (_) {
    return false;
  }
}

// Returns 'shared' | 'downloaded' | 'cancelled'
export async function shareOrDownload(blob, { title, text } = {}) {
  const file = new File([blob], 'jashmen-achievement.png', { type: 'image/png' });

  if (canShareFiles()) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'; // user closed the share sheet — not an error
      // fall through to download on any other failure
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jashmen-achievement.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
