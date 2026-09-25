// Геральдические щиты в стилистике Spectra: белый знак на цветном поле.
import { LOGO_VIEWBOX, LOGO_PATHS } from './logo.js';

const W = '#FFFFFF';
const OUTLINE = 'M8 6 H92 V58 C92 88 72 104 50 116 C28 104 8 88 8 58 Z';
const INNER = 'M14 12 H86 V58 C86 84 68 98 50 109 C32 98 14 84 14 58 Z';

function star8(cx, cy, R, r) {
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const rad = i % 2 ? r : R;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${W}"/>`;
}

function sunRays(cx, cy) {
  let s = `<circle cx="${cx}" cy="${cy}" r="11" fill="${W}"/>`;
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI / 6) * i;
    const p = (rad, da) => `${(cx + rad * Math.cos(a + da)).toFixed(1)},${(cy + rad * Math.sin(a + da)).toFixed(1)}`;
    s += `<polygon points="${p(14, -0.16)} ${p(24, 0)} ${p(14, 0.16)}" fill="${W}"/>`;
  }
  return s;
}

// Маленькие ромбы-«огранка» под знаком, как на щитах гаммы.
const dots = (fill) =>
  `<path d="M50 88 l3 4 -3 4 -3 -4z M40 84 l2 3 -2 3 -2 -3z M60 84 l2 3 -2 3 -2 -3z" fill="${fill}"/>`;

const EMBLEMS = {
  star: () => star8(50, 52, 22, 9),
  crown: () => `<path d="M30 66 L31 40 L41 51 L50 34 L59 51 L69 40 L70 66 Z" fill="${W}"/><rect x="30" y="68" width="40" height="6" fill="${W}"/><circle cx="31" cy="38" r="3" fill="${W}"/><circle cx="50" cy="32" r="3" fill="${W}"/><circle cx="69" cy="38" r="3" fill="${W}"/>`,
  tower: (c) => `<path d="M33 76 V44 H38 V36 H44 V44 H48 V36 H52 V44 H56 V36 H62 V44 H67 V76 Z" fill="${W}"/><path d="M45 76 V64 a5 5 0 0 1 10 0 V76 Z M48 50 h4 v7 h-4z" fill="${c}"/>`,
  key: (c) => `<circle cx="50" cy="38" r="10" fill="${W}"/><circle cx="50" cy="38" r="4.5" fill="${c}"/><rect x="47" y="46" width="6" height="30" fill="${W}"/><rect x="53" y="62" width="9" height="4" fill="${W}"/><rect x="53" y="70" width="6" height="4" fill="${W}"/>`,
  sword: () => `<path d="M47 30 L50 24 L53 30 V66 H47 Z" fill="${W}"/><rect x="36" y="66" width="28" height="5" rx="2" fill="${W}"/><rect x="47.5" y="71" width="5" height="9" fill="${W}"/><circle cx="50" cy="82" r="3.5" fill="${W}"/>`,
  lily: () => `<path d="M50 26 C58 36 58 50 50 62 C42 50 42 36 50 26 Z" fill="${W}"/><path d="M48 60 C38 60 30 52 32 42 C38 44 44 50 48 58 Z M52 60 C62 60 70 52 68 42 C62 44 56 50 52 58 Z" fill="${W}"/><rect x="36" y="62" width="28" height="5" rx="2" fill="${W}"/><path d="M46 67 L50 78 L54 67 Z" fill="${W}"/>`,
  sun: () => sunRays(50, 52),
  moon: (c) => `<circle cx="50" cy="52" r="22" fill="${W}"/><circle cx="60" cy="46" r="19" fill="${c}"/>`,
};

export const SHIELDS = [
  { id: 'star', color: '#E6213B' },
  { id: 'crown', color: '#1D3FC4' },
  { id: 'tower', color: '#74C23F' },
  { id: 'key', color: '#E5197D' },
  { id: 'sword', color: '#2FCFCF' },
  { id: 'lily', color: '#F4B81A' },
  { id: 'sun', color: '#6B3FA0' },
  { id: 'moon', color: '#0E8A5F' },
];

export const ECRU_SHIELD = { id: 'ecru', color: '#2B2A2E' };

function ecruEmblem() {
  const [, , w, h] = LOGO_VIEWBOX.split(' ').map(Number);
  const tw = 60, th = (h / w) * tw;
  return `<svg x="${50 - tw / 2}" y="${50 - th / 2}" width="${tw}" height="${th}" viewBox="${LOGO_VIEWBOX}" fill="${W}">${LOGO_PATHS}</svg>` +
    `<path d="M30 70 H70" stroke="#C9C9CE" stroke-width="1.2"/>` +
    `<text x="50" y="80" text-anchor="middle" font-family="FortuneSerif, serif" font-size="8" letter-spacing="2.4" fill="#C9C9CE">SPECTRA</text>`;
}

export function shieldSVG(shield, cls = '') {
  const c = shield.color;
  const isEcru = shield.id === 'ecru';
  const emblem = isEcru ? ecruEmblem() : EMBLEMS[shield.id](c) + dots(W);
  const rim = isEcru ? '#C9C9CE' : 'rgba(255,255,255,.9)';
  return `<svg class="${cls}" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${shield.id}">` +
    `<path d="${OUTLINE}" fill="${c}"/>` +
    `<path d="${INNER}" fill="none" stroke="${rim}" stroke-width="1.6"/>` +
    emblem +
    `</svg>`;
}

export const pickLoseShield = (rand) => SHIELDS[Math.min(SHIELDS.length - 1, Math.floor(rand * SHIELDS.length))];
