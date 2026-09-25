// Сводка из Apps Script → то, что рисует дашборд.
import { PROMOTERS, SHIFT } from './config.js';
import { shiftBounds, clamp } from './pacing.js';

export function buildView(summary, now) {
  const cfg = summary.config || {};
  const end = cfg.end || SHIFT.end;
  const { start, end: endTs } = shiftBounds(new Date(now), SHIFT.start, end);
  const frac = clamp((now - start) / (endTs - start), 0, 1);
  const promoters = PROMOTERS.map((p) => {
    const s = summary.promoters?.[p.id] || { wins: 0, attempts: 0, lastTs: 0, onStash: false };
    const quota = cfg.quotas?.[p.id] ?? p.quota;
    const idleMin = s.lastTs ? Math.floor((now - s.lastTs) / 60e3) : null;
    const idle = idleMin == null ? 'none' : idleMin < 10 ? 'ok' : idleMin < 20 ? 'warn' : 'bad';
    return { ...p, quota, wins: s.wins, attempts: s.attempts, onStash: s.onStash, idleMin, idle, plan: Math.round(quota * frac * 10) / 10 };
  });
  return {
    total: { wins: promoters.reduce((a, p) => a + p.wins, 0), quota: promoters.reduce((a, p) => a + p.quota, 0), attempts: promoters.reduce((a, p) => a + p.attempts, 0) },
    promoters,
    networks: Object.entries(summary.networks || {}).sort((a, b) => b[1] - a[1]),
    boost: cfg.boost ?? 1,
    end,
    frac,
  };
}
