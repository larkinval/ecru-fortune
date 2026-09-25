import { PROMOTERS, API_URL, TOKEN, SHIFT } from './config.js';
import { buildView } from './dashboard-model.js';
import { logoSVG } from './logo.js';

const $ = (id) => document.getElementById(id);
const BOOSTS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const PIN_KEY = 'ecru-fortune-admin';
const MOCK = new URLSearchParams(location.search).has('mock');
$('logo').innerHTML = logoSVG();

let last = null;
let draft = null; // черновик админки: {boost, end, quotas}

function mockSummary() {
  const now = Date.now();
  return {
    ok: true, now,
    promoters: {
      yana: { wins: 3, attempts: 41, lastTs: now - 2 * 60e3, onStash: false },
      maria: { wins: 2, attempts: 30, lastTs: now - 6 * 60e3, onStash: true },
      vsevolod: { wins: 1, attempts: 9, lastTs: now - 24 * 60e3, onStash: false },
      matvey: { wins: 2, attempts: 22, lastTs: now - 12 * 60e3, onStash: false },
    },
    networks: { TikTok: 48, Telegram: 39, VK: 11, Instagram: 4 },
    config: { boost: 1, end: '', quotas: {}, rev: 0 },
  };
}

let inflight = false;
async function load() {
  if (inflight) return; // Apps Script отвечает до 10 с — не наслаиваем запросы
  inflight = true;
  $('updated').classList.add('loading');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const data = MOCK ? mockSummary() : await (await fetch(`${API_URL}?token=${encodeURIComponent(TOKEN)}`, { signal: ctrl.signal })).json();
    if (!data.ok) throw new Error(data.error);
    last = data;
    render();
    $('updated').className = 'updated';
    $('updated').textContent = `обновлено ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  } catch (e) {
    $('updated').className = 'updated err';
    const why = !API_URL ? 'не задан API_URL' : e.name === 'AbortError' ? 'таблица не ответила за 60 с' : e.message;
    $('updated').textContent = `нет связи с таблицей (${why})${last ? ' — показываю последние данные' : ''}`;
  } finally {
    clearTimeout(timer);
    inflight = false;
  }
}

function render() {
  const v = buildView(last, Date.now());
  $('tWins').textContent = v.total.wins;
  $('tQuota').textContent = v.total.quota;
  const planTotal = Math.round(v.total.quota * v.frac * 10) / 10;
  $('tMeta').innerHTML = `попыток ${v.total.attempts} · по плану сейчас ${planTotal}${v.boost !== 1 ? ` · <b>темп ×${v.boost}</b>` : ''} · конец ${v.end}`;
  $('cards').innerHTML = v.promoters.map((p) => {
    const pct = p.quota ? Math.min(100, (p.wins / p.quota) * 100) : 0;
    const planPct = p.quota ? Math.min(100, (p.plan / p.quota) * 100) : 0;
    const idle = p.idle === 'none' ? 'ещё не начинал' : p.idleMin === 0 ? 'активен сейчас' : `тишина ${p.idleMin} мин`;
    return `<article class="card" style="--c:${p.color}">
      <div class="card-name">${p.name}</div>
      <div class="card-body">
        <div class="card-wins">${p.wins}<small> / ${p.quota}</small></div>
        <div class="bar" title="план ${p.plan}"><i style="width:${pct}%"></i><b style="left:${planPct}%"></b></div>
        <div class="card-row"><span>попыток ${p.attempts}</span><span>план ${p.plan}</span></div>
        <div class="card-row"><span class="idle ${p.idle}">${idle}</span></div>
        ${p.onStash ? '<span class="tag">НА СКЛАДЕ</span>' : ''}
      </div>
    </article>`;
  }).join('');
  const max = Math.max(1, ...v.networks.map(([, c]) => c));
  $('nets').innerHTML = v.networks.length
    ? v.networks.map(([n, c]) => `<div class="net-row" style="--c:var(--ink)"><span>${n}</span><div class="bar"><i style="width:${(c / max) * 100}%"></i></div><b>${c}</b></div>`).join('')
    : '<p class="lbl">пока пусто</p>';
  if (!draft) resetDraft();
}

// ---------- админка ----------
function resetDraft() {
  const c = last?.config || {};
  draft = {
    boost: c.boost ?? 1,
    end: c.end || SHIFT.end,
    quotas: Object.fromEntries(PROMOTERS.map((p) => [p.id, c.quotas?.[p.id] ?? p.quota])),
  };
  renderPanel();
}

function renderPanel() {
  if (!draft) return;
  $('boosts').innerHTML = BOOSTS.map((b) => `<button data-b="${b}" aria-pressed="${b === draft.boost}">×${b}</button>`).join('');
  $('aEnd').value = draft.end;
  const sum = Object.values(draft.quotas).reduce((a, b) => a + b, 0);
  $('quotas').innerHTML = PROMOTERS.map((p) => `<div class="q"><span>${p.name}</span><button data-q="${p.id}" data-d="-1">−</button><span class="v">${draft.quotas[p.id]}</span><button data-q="${p.id}" data-d="1">+</button></div>`).join('') +
    `<div class="q"><span class="lbl">всего</span><span></span><span class="v">${sum}</span><span></span></div>`;
}

$('boosts').addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (!b) return; draft.boost = Number(b.dataset.b); renderPanel(); });
$('quotas').addEventListener('click', (e) => { const b = e.target.closest('[data-q]'); if (!b) return; draft.quotas[b.dataset.q] = Math.max(0, draft.quotas[b.dataset.q] + Number(b.dataset.d)); renderPanel(); });
$('aEnd').addEventListener('change', () => { draft.end = $('aEnd').value; });

function unlock(pin) {
  try { localStorage.setItem(PIN_KEY, pin); } catch { /* ок */ }
  $('locked').hidden = true;
  $('panel').hidden = false;
}
$('unlock').addEventListener('click', () => { if ($('adminPin').value.length === 4) unlock($('adminPin').value); });

async function adminPost(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: TOKEN, adminPin: localStorage.getItem(PIN_KEY), ...payload }),
  });
  const data = await res.json();
  if (!data.ok) {
    if (data.error === 'pin') { localStorage.removeItem(PIN_KEY); $('locked').hidden = false; $('panel').hidden = true; }
    throw new Error(data.error === 'pin' ? 'неверный PIN' : data.error);
  }
  return data;
}

$('apply').addEventListener('click', async () => {
  $('msg').textContent = 'отправляю…';
  try {
    if (MOCK) last.config = { ...draft, rev: (last.config.rev || 0) + 1 };
    else last.config = (await adminPost({ config: draft })).config;
    $('msg').textContent = `применено ✓ телефоны подхватят в течение 30–60 секунд (темп ×${draft.boost})`;
    render();
  } catch (e) {
    $('msg').textContent = `не вышло: ${e.message}`;
  }
});

$('resetAll').addEventListener('click', async () => {
  if (!confirm('Сбросить ВСЁ перед стартом? Тестовые попытки уйдут в архив, у всех промиков будет 0 из полной квоты.')) return;
  if (prompt('Для подтверждения напиши СТАРТ') !== 'СТАРТ') return;
  $('msg').textContent = 'сбрасываю…';
  try {
    if (MOCK) last = { ...mockSummary(), promoters: {}, networks: {}, config: { boost: 1, end: '', quotas: {}, rev: 99, resetAt: Date.now() } };
    else {
      const r = await adminPost({ reset: true });
      if (!r.config?.resetAt) throw new Error('Apps Script старой версии — вставь новый Code.gs и выпусти новую версию развертывания');
      last = { ...last, promoters: {}, networks: {}, hours: {}, config: r.config };
    }
    draft = null;
    render();
    $('msg').textContent = 'сброшено ✓ телефоны обнулятся в течение 30–60 секунд. Проверь, что у всех «0 попыток».';
  } catch (e) {
    $('msg').textContent = `сброс не прошёл: ${e.message}`;
  }
});

try { if (localStorage.getItem(PIN_KEY)) unlock(localStorage.getItem(PIN_KEY)); } catch { /* ок */ }
load();
setInterval(load, 15_000);
