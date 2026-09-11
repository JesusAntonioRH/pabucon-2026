/* ============================================================
   PABUCON 2026 - Main JavaScript
   Particle system + FingerprintJS + Registration + Countdown
   ============================================================ */

// ──────────────────────────────────────────────────────────────
// 🔧 CONFIGURACIÓN
// ──────────────────────────────────────────────────────────────
const CONFIG = {
  API_BASE_URL:  'https://a1pxf50eh7.execute-api.us-east-1.amazonaws.com',
  MAX_CAPACITY:  15,
  STORAGE_KEY:   'pabucon2026_registered',
  EVENT_DATE:    new Date('2026-09-23T16:00:00-06:00'), // 4 PM CST
};

// ──────────────────────────────────────────────────────────────
// PARTICLE SYSTEM — Floating hearts & stars
// ──────────────────────────────────────────────────────────────
class Particle {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.reset(true);
  }

  reset(initial = false) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    this.x     = Math.random() * W;
    this.y     = initial ? Math.random() * H : H + 25;
    this.size  = Math.random() * 14 + 4;
    this.vy    = -(Math.random() * 0.75 + 0.25);
    this.vx    = (Math.random() - 0.5) * 0.3;
    this.alpha = Math.random() * 0.35 + 0.05;
    this.rot   = Math.random() * Math.PI * 2;
    this.rotV  = (Math.random() - 0.5) * 0.018;
    this.wob   = Math.random() * Math.PI * 2;
    this.wobS  = Math.random() * 0.018 + 0.006;

    this.type  = Math.floor(Math.random() * 3);

    const palettes = [
      [200, 80, 192],
      [123, 47, 190],
      [65,  88, 208],
      [255, 255, 255],
      [180, 60, 220],
    ];
    this.rgb = palettes[Math.floor(Math.random() * palettes.length)];
  }

  update() {
    this.y   += this.vy;
    this.wob += this.wobS;
    this.x   += Math.sin(this.wob) * 0.45 + this.vx;
    this.rot += this.rotV;

    const W = this.canvas.width;
    if (this.y < -30 || this.x < -30 || this.x > W + 30) {
      this.reset();
    }
  }

  draw() {
    const { ctx, x, y, size, rot, alpha, rgb } = this;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

    if (this.type === 0 || this.type === 2) {
      this._drawHeart(ctx, size);
    } else {
      this._drawStar4(ctx, size);
    }

    ctx.restore();
  }

  _drawHeart(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.28);
    ctx.bezierCurveTo( s * 0.5,  -s * 0.9,  s * 1.08, -s * 0.08, 0,  s * 0.72);
    ctx.bezierCurveTo(-s * 1.08, -s * 0.08, -s * 0.5, -s * 0.9,  0, -s * 0.28);
    ctx.fill();
  }

  _drawStar4(ctx, s) {
    const r1 = s, r2 = s * 0.38;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? r1 : r2;
      const a = (i * Math.PI) / 4 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else         ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
}

class ParticleSystem {
  constructor() {
    this.canvas = document.getElementById('particles-canvas');
    if (!this.canvas) return;
    this.ctx    = this.canvas.getContext('2d');
    this.items  = [];
    this.raf    = null;

    this._resize();
    window.addEventListener('resize', () => this._resize(), { passive: true });

    const count = Math.min(50, Math.max(20, Math.floor(window.innerWidth / 28)));
    for (let i = 0; i < count; i++) {
      this.items.push(new Particle(this.canvas));
    }
    this._loop();
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _loop() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const p of this.items) { p.update(); p.draw(); }
    this.raf = requestAnimationFrame(() => this._loop());
  }
}

// ──────────────────────────────────────────────────────────────
// COUNTDOWN TIMER
// ──────────────────────────────────────────────────────────────
function updateCountdown() {
  const diff = CONFIG.EVENT_DATE - Date.now();
  const cdEl = document.getElementById('countdown');
  if (!cdEl) return;

  if (diff <= 0) {
    cdEl.innerHTML = `<div class="cd-event-now">¡ES HOY! ♥</div>`;
    return;
  }

  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000)  / 60000);
  const s = Math.floor((diff % 60000)    / 1000);

  const pad = n => String(n).padStart(2, '0');
  document.getElementById('cd-days').textContent  = pad(d);
  document.getElementById('cd-hours').textContent = pad(h);
  document.getElementById('cd-mins').textContent  = pad(m);
  document.getElementById('cd-secs').textContent  = pad(s);
}

// ──────────────────────────────────────────────────────────────
// FINGERPRINT
// ──────────────────────────────────────────────────────────────
let _fpPromise = null;

async function getFingerprint() {
  try {
    if (!_fpPromise) {
      _fpPromise = FingerprintJS.load();
    }
    const fp     = await _fpPromise;
    const result = await fp.get();
    return result.visitorId;
  } catch {
    const data = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 0,
      navigator.maxTouchPoints || 0,
    ].join('|');
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data.charCodeAt(i);
      hash |= 0;
    }
    return 'fallback_' + Math.abs(hash).toString(36);
  }
}

// ──────────────────────────────────────────────────────────────
// API
// ──────────────────────────────────────────────────────────────
function isApiConfigured() {
  return !CONFIG.API_BASE_URL.includes('YOUR_API_GATEWAY_URL');
}

async function apiFetchCount() {
  const res  = await fetch(`${CONFIG.API_BASE_URL}/count`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiRegister(nickname, email, deviceId) {
  const res = await fetch(`${CONFIG.API_BASE_URL}/register`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ nickname, email, deviceId }),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ──────────────────────────────────────────────────────────────
// UI HELPERS
// ──────────────────────────────────────────────────────────────
function setCapacity(taken, max = CONFIG.MAX_CAPACITY) {
  const takenEl = document.getElementById('spots-taken');
  const bar     = document.getElementById('cap-bar');
  const barGlow = document.getElementById('cap-bar-glow');
  const msgEl   = document.getElementById('cap-msg');
  const barWrap = document.getElementById('capacity-bar-wrap');
  if (!takenEl) return;

  const current = parseInt(takenEl.textContent) || 0;
  const steps   = 20;
  const diff    = taken - current;
  let   step    = 0;
  const timer   = setInterval(() => {
    step++;
    const val = Math.round(current + (diff * step / steps));
    takenEl.textContent = val;
    if (step >= steps) clearInterval(timer);
  }, 40);

  const pct = Math.min((taken / max) * 100, 100);
  bar.style.width     = pct + '%';
  barGlow.style.width = pct + '%';

  if (barWrap) {
    barWrap.setAttribute('aria-valuenow', taken);
  }

  const left = max - taken;
  if (left <= 0) {
    msgEl.textContent = '♥ ¡Todos los cupos están llenos! ♥';
    msgEl.className   = 'cap-msg full';
  } else if (left <= 3) {
    msgEl.textContent = `⚠️ ¡Solo quedan ${left} cupo${left === 1 ? '' : 's'}!`;
    msgEl.className   = 'cap-msg full';
  } else {
    msgEl.textContent = `${left} de ${max} cupos disponibles`;
    msgEl.className   = 'cap-msg';
  }
}

function showMessage(type, text) {
  const el = document.getElementById('form-message');
  if (!el) return;
  el.className   = `form-msg ${type}`;
  el.textContent = text;
}

function showAlreadyRegistered(nickname) {
  const form = document.getElementById('registration-form');
  const arEl = document.getElementById('already-registered');
  const nick = document.getElementById('ar-nickname');
  if (!form || !arEl) return;

  form.style.display = 'none';
  arEl.classList.remove('hidden');
  if (nick && nickname) {
    nick.textContent = `♥ ${nickname} ♥`;
  }
}

function setSubmitLoading(loading) {
  const btn     = document.getElementById('submit-btn');
  const btnText = btn?.querySelector('.sbtn-text');
  if (!btn || !btnText) return;
  btn.disabled      = loading;
  btnText.textContent = loading ? 'PROCESANDO...' : 'CONFIRMAR ASISTENCIA';
}

// ──────────────────────────────────────────────────────────────
// DEMO REGISTRATION (when API not configured)
// ──────────────────────────────────────────────────────────────
let _demoCount = 0;

async function demoRegister(nickname, email) {
  await new Promise(r => setTimeout(r, 1400)); 

  _demoCount++;
  const stored = { nickname, email, deviceId: 'demo', demo: true };
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(stored));

  showMessage('success', `♥ ¡${nickname} registrado! Te enviamos un correo. (Modo Demo) ♥`);
  setCapacity(_demoCount);

  setTimeout(() => showAlreadyRegistered(nickname), 2800);
}

// ──────────────────────────────────────────────────────────────
// REGISTRATION HANDLER
// ──────────────────────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();

  const nicknameInput = document.getElementById('nickname');
  const emailInput = document.getElementById('email');
  
  const nickname      = nicknameInput?.value.trim();
  const email         = emailInput?.value.trim();

  if (!nickname || !email) {
    showMessage('error', '❌ Escribe tu nickname y correo antes de continuar.');
    return;
  }

  // Regex simple para email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showMessage('error', '❌ Por favor ingresa un correo válido.');
    return;
  }

  const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
  if (stored) {
    const data = JSON.parse(stored);
    showAlreadyRegistered(data.nickname || 'Guerrero');
    return;
  }

  setSubmitLoading(true);

  try {
    const deviceId = await getFingerprint();

    if (!isApiConfigured()) {
      await demoRegister(nickname, email);
      return;
    }

    const { status, data } = await apiRegister(nickname, email, deviceId);

    if (status === 200) {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ nickname, email, deviceId }));
      showMessage('success', `♥ ¡${nickname} registrado! Revisa tu correo. Nos vemos el 23 de Sept ♥`);

      if (data.spotsLeft !== undefined) {
        setCapacity(CONFIG.MAX_CAPACITY - data.spotsLeft);
      }

      setTimeout(() => showAlreadyRegistered(nickname), 2800);

    } else if (status === 409) {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({ nickname: 'Guerrero', deviceId }));
      showMessage('warning', '♛ Este dispositivo ya tiene un registro en Pabucon 2026.');

    } else if (status === 403) {
      showMessage('error', '❌ ¡Los cupos están llenos! Sigue a Pabstraps para más info.');

    } else {
      showMessage('error', `❌ Error ${status}. Intenta de nuevo más tarde.`);
    }

  } catch (err) {
    console.error('[Pabucon] Registration error:', err);
    showMessage('error', '❌ Error de conexión. Verifica tu internet e intenta de nuevo.');
  } finally {
    setSubmitLoading(false);
  }
}

// ──────────────────────────────────────────────────────────────
// LOAD CAPACITY ON MOUNT
// ──────────────────────────────────────────────────────────────
async function loadCapacity() {
  if (!isApiConfigured()) {
    setCapacity(0);
    return;
  }
  try {
    const data = await apiFetchCount();
    setCapacity(data.total ?? 0);
  } catch {
    setCapacity(0);
  }
}

// ──────────────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  new ParticleSystem();
  updateCountdown();
  setInterval(updateCountdown, 1000);

  const storedRaw = localStorage.getItem(CONFIG.STORAGE_KEY);
  if (storedRaw) {
    try {
      const stored = JSON.parse(storedRaw);
      showAlreadyRegistered(stored.nickname || 'Guerrero');
    } catch {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
    }
  }

  loadCapacity();

  const form = document.getElementById('registration-form');
  if (form) form.addEventListener('submit', handleSubmit);

  const loading = document.getElementById('loading-screen');
  if (loading) {
    loading.addEventListener('animationend', () => {
      loading.style.display = 'none';
    });
  }

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  const observer = new IntersectionObserver(
    entries => entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) {
        target.style.opacity    = '1';
        target.style.transform  = 'translateY(0)';
      }
    }),
    { threshold: 0.12 }
  );

  document.querySelectorAll('.about-card, .detail-card, .capacity-card, .reg-form').forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
    observer.observe(el);
  });
});
