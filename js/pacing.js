// Шанс выигрыша: раздать квоту равномерно до конца смены.
const H = 3600e3;
const PRIOR_RATE = 15;   // попыток в час, пока своих данных мало
const PRIOR_HOURS = 0.5;
const AHEAD_FLOOR = 0; // опережаем график: пауза до следующего слота

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

function at(base, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const t = new Date(base);
  t.setHours(h, m, 0, 0);
  return t.getTime();
}

// До полудня считаем, что смена началась вчера: в 00:30 мы ещё внутри 22:00–01:00.
export function shiftBounds(now, startHHMM, endHHMM) {
  const ref = new Date(now);
  if (ref.getHours() < 12) ref.setDate(ref.getDate() - 1);
  const start = at(ref, startHHMM);
  let end = at(ref, endHHMM);
  if (end <= start) end += 24 * H;
  return { start, end };
}

export function winChance({ quota, wins, attempts, now, start, end, boost = 1 }) {
  const left = quota - wins;
  if (left <= 0) return 0;
  if (now >= end) return 1;
  const elapsedH = Math.max(0, now - start) / H;
  const leftH = Math.max((end - now) / H, 0.05);
  const rate = (attempts + PRIOR_RATE * PRIOR_HOURS) / (elapsedH + PRIOR_HOURS);
  const raw = (boost * left) / Math.max(rate * leftH, 1);
  // График: к доле смены frac положено floor(quota·frac)+1 футболок, не больше.
  // boost из админки сдвигает и график: ×2 — план идёт вдвое быстрее.
  const frac = clamp(((now - start) / (end - start)) * boost, 0, 1);
  if (wins >= Math.floor(quota * frac) + 1) return AHEAD_FLOOR;
  const hi = end - now < 15 * 60e3 ? 1 : 0.6;
  return clamp(raw, 0.04 * Math.min(1, boost), hi);
}

export const decide = (p, rand) => (rand < p ? 'win' : 'lose');

export function decideSpin(s, now, rand) {
  if (s.quota - s.wins <= 0) return { result: 'empty', p: 0 };
  const p = winChance({ ...s, now });
  return { result: decide(p, rand), p };
}

export function secureRandom() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
}
