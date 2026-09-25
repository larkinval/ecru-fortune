import { PROMOTERS, PIN, NETWORKS, SHIFT, API_URL, TOKEN, promoterById } from './config.js';
import { createStore } from './store.js';
import { decideSpin, secureRandom, shiftBounds } from './pacing.js';
import { startSync } from './sync.js';
import { SHIELDS, ECRU_SHIELD, shieldSVG, pickLoseShield } from './shields.js';
import { logoSVG } from './logo.js';
import { toRoman } from './roman.js';

const $ = (id) => document.getElementById(id);
const app = $('app');
const store = createStore(localStorage);
const NET_COLORS = { TikTok: '#E5197D', Telegram: '#1D3FC4', VK: '#2FCFCF', Instagram: '#F4B81A' };
const SPIN_MS = 2600;

let network = null;
let sync = { pending: 0, ok: true };

$('logo').innerHTML = logoSVG();

// ---------- статус ----------
function renderStatus() {
  const s = store.get();
  const p = promoterById(s.promoterId);
  if (!p) { $('status').innerHTML = ''; return; }
  const left = Math.max(0, s.quota - s.wins);
  const parts = [
    `<span><b>${p.name}</b></span>`,
    `<span>футболок <b>${left}</b> из ${s.quota}</span>`,
    `<span>попыток <b>${s.attempts}</b></span>`,
  ];
  if (s.boost !== 1) parts.push(`<span class="boost">темп ×${s.boost}</span>`);
  const label = !API_URL ? 'без сервера' : sync.pending ? `в очереди ${sync.pending}` : sync.ok ? 'в сети' : 'нет сети';
  parts.push(`<span class="sync ${API_URL && sync.ok && !sync.pending ? '' : 'off'}">${label}</span>`);
  $('status').innerHTML = parts.join('');
  $('trainBar').hidden = !s.training;
}

// ---------- щит ----------
function showShield(shield) {
  $('strip').style.transform = '';
  $('strip').innerHTML = shieldSVG(shield);
}

function spinTo(finalShield) {
  const reel = $('reel');
  const strip = $('strip');
  const n = 26;
  const items = [];
  let prev = null;
  for (let i = 0; i < n - 1; i++) {
    const pool = i % 4 === 3 ? [...SHIELDS, ECRU_SHIELD] : SHIELDS;
    let s;
    do { s = pool[Math.floor(Math.random() * pool.length)]; } while (s === prev);
    items.push(s);
    prev = s;
  }
  items.push(finalShield);
  strip.innerHTML = items.map((s) => shieldSVG(s)).join('');
  const h = reel.clientHeight;
  const anim = strip.animate(
    [{ transform: 'translateY(0)' }, { transform: `translateY(${-(n - 1) * h}px)` }],
    { duration: SPIN_MS, easing: 'cubic-bezier(.12,.72,.18,1)', fill: 'forwards' },
  );
  return anim.finished.then(() => showShield(finalShield));
}

// ---------- экраны ----------
function setScreen(name) {
  app.dataset.screen = name;
  renderStatus();
}

function renderReady() {
  const s = store.get();
  $('title').textContent = 'FORTUNE';
  $('subtitle').textContent = 'Щит судьбы';
  $('ribbon').hidden = true;
  $('draw').textContent = '';
  const left = s.quota - s.wins;
  $('hint').textContent = left <= 0
    ? 'Футболки у тебя закончились. Подписки всё равно отмечаем.'
    : network ? '' : 'Отметь соцсеть, на которую подписался гость';
  $('spin').querySelector('span').textContent = left <= 0 ? 'ОТМЕТИТЬ' : 'КРУТИТЬ';
  $('spin').disabled = !network;
  showShield(ECRU_SHIELD);
  setScreen('ready');
}

function renderNets() {
  $('nets').innerHTML = NETWORKS.map((n) =>
    `<button class="net" role="radio" aria-checked="${n === network}" data-net="${n}" style="--c:${NET_COLORS[n]}">${n}${n === 'Instagram' ? '<small>только по желанию</small>' : ''}</button>`,
  ).join('');
}
$('nets').addEventListener('click', (e) => {
  const b = e.target.closest('.net');
  if (!b) return;
  network = b.dataset.net;
  renderNets();
  renderReady();
});

function showRibbon(kind, main, sub) {
  const r = $('ribbon');
  r.className = `ribbon ${kind}`;
  r.hidden = false;
  $('ribbonMain').textContent = main;
  $('ribbonSub').textContent = sub;
  // перезапуск анимации ленты
  r.style.animation = 'none'; void r.offsetWidth; r.style.animation = '';
}

async function onSpin() {
  const s = store.get();
  if (!network || app.dataset.screen === 'spin') return;
  const now = Date.now();
  const { start, end } = shiftBounds(new Date(now), s.start, s.end);
  let { result, p } = decideSpin({ ...s, start, end }, now, secureRandom());
  const force = new URLSearchParams(location.search).get('force');
  if (s.training && (force === 'win' || force === 'lose') && result !== 'empty') result = force;
  const draw = 1 + Math.floor(secureRandom() * 300);
  const repeat = $('repeat').checked;
  // Результат сохраняем до анимации: перезагрузка не даст перекрутить.
  const ev = store.recordSpin({ network, repeat, result, p, draw, now });
  sync.pending = store.outbox().length;
  kickSync?.();

  if (result === 'empty') {
    renderEmpty();
    return;
  }
  setScreen('spin');
  $('hint').textContent = '';
  const finalShield = result === 'win' ? ECRU_SHIELD : pickLoseShield(secureRandom());
  await spinTo(finalShield);
  $('draw').textContent = `жребий № ${toRoman(draw)}`;
  if (result === 'win') {
    showRibbon('win', 'FORTUNE', 'Твоя футболка ECRU');
    $('hint').textContent = `Код выдачи ${ev.code}`;
    setAfter('ОТДАЛ → НА СКЛАД', 'var(--green)', () => setScreen('stash') || renderStash());
    setScreen('win');
    confetti();
    navigator.vibrate?.([80, 60, 160]);
  } else {
    showRibbon('lose', 'VALOR', 'В этот раз нет');
    $('hint').textContent = repeat
      ? 'Спасибо, что с нами! Загляни в зону ECRU у входа.'
      : 'Подпишись ещё на одну соцсеть ECRU — будет вторая попытка.';
    setAfter('СЛЕДУЮЩИЙ ГОСТЬ', 'var(--ink)', nextGuest);
    setScreen('lose');
  }
}
$('spin').addEventListener('click', onSpin);

function renderEmpty() {
  $('ribbon').hidden = true;
  showShield(ECRU_SHIELD);
  showRibbon('empty', 'MERCI', 'Подписка засчитана');
  $('draw').textContent = '';
  $('hint').textContent = 'Футболки у меня закончились — спасибо, что с нами!';
  setAfter('СЛЕДУЮЩИЙ ГОСТЬ', 'var(--ink)', nextGuest);
  setScreen('empty');
}

let afterHandler = null;
function setAfter(label, color, fn) {
  const b = $('afterBtn');
  b.querySelector('span').textContent = label;
  b.style.setProperty('--c', color);
  afterHandler = fn;
}
$('afterBtn').addEventListener('click', () => afterHandler?.());

function nextGuest() {
  network = null;
  $('repeat').checked = false;
  renderNets();
  renderReady();
}

function renderStash() {
  const s = store.get();
  $('stashLast').textContent = s.last?.code ? `последний выигрыш ${s.last.code}` : '';
  setScreen('stash');
}
$('backBtn').addEventListener('click', () => {
  store.stashBack(Date.now());
  kickSync?.();
  nextGuest();
});

// ---------- настройка ----------
let chosen = null;
function renderSetup() {
  const s = store.get();
  chosen = s.promoterId;
  $('who').innerHTML = PROMOTERS.map((p) =>
    `<button class="net" role="radio" aria-checked="${p.id === chosen}" data-id="${p.id}" style="--c:${p.color}">${p.name}</button>`,
  ).join('');
  $('fStart').value = s.start || SHIFT.start;
  $('fEnd').value = s.localEnd || SHIFT.end;
  $('fQuota').value = s.promoterId ? s.localQuota : '';
  $('fTraining').checked = s.training;
  $('cancelBtn').hidden = !s.promoterId;
  setScreen('setup');
}
$('who').addEventListener('click', (e) => {
  const b = e.target.closest('.net');
  if (!b) return;
  chosen = b.dataset.id;
  $('fQuota').value = promoterById(chosen).quota;
  for (const x of $('who').children) x.setAttribute('aria-checked', x.dataset.id === chosen);
});
$('saveBtn').addEventListener('click', () => {
  if (!chosen) { $('who').animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], 240); return; }
  store.setup({
    promoterId: chosen,
    quota: Math.max(0, Number($('fQuota').value) || promoterById(chosen).quota),
    start: $('fStart').value || SHIFT.start,
    end: $('fEnd').value || SHIFT.end,
  });
  const wantTraining = $('fTraining').checked;
  if (!wantTraining && store.get().training) store.endTraining({ resetLive: isBeforeShift(store.get()) });
  else store.setTraining(wantTraining);
  route();
});
$('resetBtn').addEventListener('click', () => {
  if (store.outbox().length && !confirm(`${store.outbox().length} событий ещё не отправлены. Всё равно сбросить?`)) return;
  if (!confirm('Сбросить счётчики и промика на этом телефоне?')) return;
  store.reset();
  renderSetup();
});

// Кнопка ☰ в углу шапки → PIN → настройка. Во время кручения не открывается.
const openMenu = () => { if (app.dataset.screen !== 'spin' && app.dataset.screen !== 'setup') askPin(); };
$('menuBtn').addEventListener('click', openMenu);

// Завершить тренировку может сам промик, без PIN. До начала смены обнуляется всё.
function isBeforeShift(s, now = Date.now()) {
  return now < shiftBounds(new Date(now), s.start, s.end).start;
}
function endTraining() {
  const s = store.get();
  const wipe = isBeforeShift(s);
  const msg = wipe
    ? 'Завершить тренировку? Все счётчики обнулятся — начинается реальная работа.'
    : 'Завершить тренировку? Тренировочные попытки сотрутся, реальные счётчики останутся.';
  if (!confirm(msg)) return;
  store.endTraining({ resetLive: wipe });
  route();
}
$('trainEnd').addEventListener('click', () => { if (app.dataset.screen !== 'spin') endTraining(); });
$('cancelBtn').addEventListener('click', () => route());
function askPin() {
  const dlg = $('pinDlg');
  if (typeof dlg.showModal !== 'function') {
    if (prompt('PIN настроек') === PIN) renderSetup();
    return;
  }
  $('pinInput').value = '';
  dlg.showModal();
  setTimeout(() => $('pinInput').focus(), 50);
  dlg.addEventListener('close', () => {
    if (dlg.returnValue === 'ok' && $('pinInput').value === PIN) renderSetup();
    else if (dlg.returnValue === 'ok') $('top').animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], 240);
  }, { once: true });
}

// ---------- конфетти из цветных осколков ----------
function confetti() {
  const c = $('confetti');
  const ctx = c.getContext('2d');
  const dpr = devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ['#E5197D', '#1D3FC4', '#2FCFCF', '#E6213B', '#74C23F', '#F4B81A'];
  const bits = Array.from({ length: 90 }, () => ({
    x: innerWidth / 2, y: innerHeight * 0.42,
    vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 12 - 4,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    s: 6 + Math.random() * 9, c: colors[Math.floor(Math.random() * colors.length)],
    k: 3 + Math.floor(Math.random() * 3),
  }));
  const t0 = performance.now();
  (function frame(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.vy += 0.35; b.x += b.vx; b.y += b.vy; b.r += b.vr;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c;
      ctx.beginPath();
      for (let i = 0; i < b.k; i++) {
        const a = (i / b.k) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * b.s, Math.sin(a) * b.s * 0.7);
      }
      ctx.fill(); ctx.restore();
    }
    if (t - t0 < 2200) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
}

// ---------- запуск ----------
function route() {
  const s = store.get();
  if (!s.promoterId) return renderSetup();
  if (s.onStash) return renderStash();
  nextGuest();
}

let kickSync = null;
let epoch = store.get().epoch;
kickSync = startSync(store, { url: API_URL, token: TOKEN }, (st) => {
  sync = { pending: st.pending, ok: st.ok };
  const busy = app.dataset.screen === 'spin' || app.dataset.screen === 'setup';
  if (store.get().epoch !== epoch && !busy) { epoch = store.get().epoch; route(); } // общий сброс из админки
  else if (st.config && app.dataset.screen === 'ready') renderReady();
  else renderStatus();
});

async function keepAwake() {
  try { await navigator.wakeLock?.request('screen'); } catch { /* не поддерживается */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });
keepAwake();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');

renderNets();
route();
