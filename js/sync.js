// Отправка очереди событий в Apps Script. text/plain — чтобы браузер не делал CORS-preflight.
const BATCH = 50;

export async function flush(store, { url, token, fetchImpl = fetch }) {
  const events = store.outbox().slice(0, BATCH);
  if (!url || events.length === 0) return { sent: 0 };
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, epoch: store.get().epoch || 0, events }),
      redirect: 'follow',
    });
    const data = await res.json();
    if (!data.ok) return { sent: 0, error: data.error };
    store.ack(data.acked || []);
    return { sent: (data.acked || []).length };
  } catch (err) {
    return { sent: 0, error: String(err) };
  }
}

export async function pullConfig(store, { url, token, fetchImpl = fetch }) {
  if (!url) return false;
  try {
    const res = await fetchImpl(`${url}?token=${encodeURIComponent(token)}&action=config`, { redirect: 'follow' });
    const data = await res.json();
    return data.ok ? store.applyRemote(data.config) : false;
  } catch {
    return false;
  }
}

export function startSync(store, opts, onStatus = () => {}) {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    const r = await flush(store, opts);
    busy = false;
    onStatus({ pending: store.outbox().length, ok: !r.error });
    // Досылаем хвост только если сервер что-то подтвердил — иначе ждём интервала.
    if (!r.error && r.sent > 0 && store.outbox().length) tick();
  };
  setInterval(tick, 10_000);
  const cfg = async () => { if (await pullConfig(store, opts)) onStatus({ pending: store.outbox().length, ok: true, config: true }); };
  setInterval(cfg, 30_000);
  cfg();
  addEventListener('online', tick);
  tick();
  return tick;
}
