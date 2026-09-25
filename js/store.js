// Состояние телефона промика: счётчики, очередь событий на отправку, тренировка.
import { promoterById } from './config.js';

const KEY = 'ecru-fortune-v1';
const zero = () => ({ wins: 0, attempts: 0, onStash: false });

function fresh() {
  return {
    promoterId: null, quota: 0, start: '22:00', end: '01:00',
    training: false, live: zero(), train: zero(), outbox: [], last: null, remote: null, epoch: 0,
  };
}

export function createStore(storage) {
  let s;
  try { s = { ...fresh(), ...JSON.parse(storage.getItem(KEY) || 'null') }; } catch { s = fresh(); }
  let seq = 0;

  const save = () => { try { storage.setItem(KEY, JSON.stringify(s)); } catch { /* приватный режим: живём в памяти */ } };
  const counters = () => (s.training ? s.train : s.live);

  function push(type, now, extra = {}) {
    const ev = {
      id: `${s.promoterId}-${now}-${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      ts: now, promoter: s.promoterId, type, network: '', repeat: false,
      result: '', draw: '', code: '', p: '', test: s.training, ...extra,
    };
    s.outbox.push(ev);
    return ev;
  }

  return {
    get() {
      const r = s.remote || {};
      const q = r.quotas?.[s.promoterId];
      return {
        ...s, ...counters(),
        localQuota: s.quota, localEnd: s.end,
        quota: q ?? s.quota, end: r.end || s.end, boost: r.boost ?? 1,
      };
    },
    applyRemote(cfg) {
      if (!cfg || (s.remote && cfg.rev <= s.remote.rev)) return false;
      if ((cfg.resetAt || 0) > (s.epoch || 0)) {
        // Общий сброс из админки: чистый старт, промик остаётся выбранным.
        Object.assign(s, { epoch: cfg.resetAt, training: false, live: zero(), train: zero(), outbox: [], last: null });
      }
      s.remote = cfg;
      save();
      return true;
    },
    setup({ promoterId, quota, start, end }) {
      if (s.promoterId && s.promoterId !== promoterId) { s.live = zero(); s.train = zero(); s.last = null; }
      Object.assign(s, { promoterId, quota, start, end });
      save();
    },
    setTraining(on) {
      if (on && !s.training) s.train = { ...s.live };
      s.training = on;
      save();
    },
    endTraining({ resetLive }) {
      s.training = false;
      s.train = zero();
      if (resetLive) { s.live = zero(); s.last = null; }
      save();
    },
    recordSpin({ network, repeat, result, p, draw, now }) {
      const c = counters();
      const win = result === 'win';
      const code = win ? `${promoterById(s.promoterId)?.initial ?? '?'}-${draw}` : '';
      c.attempts++;
      const ev = push('spin', now, { network, repeat, result, draw, code, p: Math.round(p * 1000) / 1000 });
      if (win) {
        c.wins++;
        c.onStash = true;
        push('stash_out', now);
      }
      s.last = { result, draw, code, ts: now };
      save();
      return ev;
    },
    stashBack(now) {
      counters().onStash = false;
      push('stash_back', now);
      save();
    },
    outbox() { return s.outbox.slice(); },
    ack(ids) {
      const done = new Set(ids);
      s.outbox = s.outbox.filter((e) => !done.has(e.id));
      save();
    },
    reset() { s = fresh(); save(); },
  };
}
