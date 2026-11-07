/* ==========================================================================
   NATURALIS · script.js
   Capa de interacción de la landing. Sin dependencias obligatorias:
   anime.js (CDN, opcional) solo añade detalles; si no carga, todo sigue funcionando.

   Índice
     0. Configuración y utilidades
     1. WhatsApp (enlaces, botón flotante y formulario)
     2. Cargador
     3. Encabezado y menú móvil
     4. Revelado al hacer scroll, títulos por palabras y contadores
     5. Hero: parallax con el puntero y partículas ("esporas")
     6. Motor de scroll (manifiesto, pasos, galería con pin, imagen que se abre, parallax)
     7. Interacciones sueltas (botones magnéticos, tarjetas 3D, flip, FAQ)
     8. Visor de imágenes (lightbox)
     9. Globo de envíos (canvas)
    10. Arranque
   ========================================================================== */
(() => {
  'use strict';

  /* ======================================================================
     0. Configuración y utilidades
     ====================================================================== */

  // Número de WhatsApp (lada de país 52 + 10 dígitos). Es el ÚNICO lugar donde vive el número.
  // Si se deja vacío, el botón flotante y el envío del formulario se ocultan con elegancia.
  const WHATSAPP_NUMBER = '525635539340';

  const doc = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // `js` lo pone el <script> del <head>; si el respaldo de 4 s ya lo retiró, la página queda estática y visible.
  const JS = doc.classList.contains('js');
  const ANIM = JS && !reduce;
  const hasAnime = () => typeof window.anime === 'function';

  const WA = String(WHATSAPP_NUMBER || '').replace(/\D/g, '');
  const waLink = (text) => `https://wa.me/${WA}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

  /** Bucle rAF con delta de tiempo. */
  function createLoop(fn) {
    let id = 0;
    let last = 0;
    let running = false;
    const step = (t) => {
      if (!running) return;
      const dt = Math.min(64, last ? t - last : 16);
      last = t;
      fn(t, dt);
      id = requestAnimationFrame(step);
    };
    return {
      start() { if (!running) { running = true; last = 0; id = requestAnimationFrame(step); } },
      stop() { running = false; cancelAnimationFrame(id); },
    };
  }

  /** Bucle que solo corre mientras el elemento está en pantalla y la pestaña visible. */
  function visibleLoop(el, fn, rootMargin = '80px') {
    const loop = createLoop(fn);
    let inView = false;
    const sync = () => (inView && !document.hidden ? loop.start() : loop.stop());
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { inView = entries[0].isIntersecting; sync(); }, { rootMargin }).observe(el);
    } else {
      inView = true;
    }
    document.addEventListener('visibilitychange', sync);
    sync();
    return loop;
  }

  function tween(ms, onUpdate, easing = easeOutExpo) {
    const t0 = performance.now();
    (function step(now) {
      const p = clamp((now - t0) / ms);
      onUpdate(easing(p));
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }

  /** Ráfaga de chispas con anime.js (opcional). */
  function burst(x, y, count, spread, withWhite) {
    if (!ANIM || !hasAnime()) return;
    for (let i = 0; i < count; i += 1) {
      const s = document.createElement('i');
      s.className = withWhite && i % 3 === 0 ? 'spark spark--w' : 'spark';
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.setAttribute('aria-hidden', 'true');
      document.body.appendChild(s);
      const a = Math.random() * Math.PI * 2;
      const d = spread * (0.45 + Math.random() * 0.75);
      window.anime({
        targets: s,
        translateX: Math.cos(a) * d,
        translateY: Math.sin(a) * d,
        rotate: Math.random() * 280 - 140,
        scale: [1, 0],
        opacity: [1, 0],
        duration: 650 + Math.random() * 600,
        easing: 'easeOutCubic',
        complete: () => s.remove(),
      });
    }
  }

  /* ======================================================================
     1. WhatsApp
     ====================================================================== */
  function initWhatsApp() {
    const fab = $('#waFab');
    const form = $('#waForm');
    const links = $$('[data-wa]');

    if (!WA) {
      // Sin número real: se oculta lo que depende de WhatsApp y los enlaces conservan su destino (#contacto).
      if (fab) fab.classList.add('wa-off');
      links.forEach((a) => { if (a !== fab && a.closest('.hdr, .hero__cta, .menu, .lightbox')) a.classList.add('wa-off'); });
      if (form) {
        const submit = $('button[type="submit"]', form);
        if (submit) submit.classList.add('wa-off');
        const note = $('.form__note', form);
        if (note) note.textContent = 'Muy pronto podrás escribirnos desde aquí. Mientras tanto, llámanos al teléfono que aparece arriba.';
      }
      return;
    }

    links.forEach((a) => {
      a.href = waLink(a.dataset.wa);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    });
  }

  function initForm() {
    const form = $('#waForm');
    if (!form || !WA) return;
    const error = $('#formError');
    const note = $('.form__note', form);
    const nameInput = $('input[name="nombre"]', form);
    if (note) note.setAttribute('aria-live', 'polite');

    nameInput.addEventListener('input', () => {
      error.hidden = true;
      nameInput.removeAttribute('aria-invalid');
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const nombre = String(data.get('nombre') || '').trim();
      if (!nombre) {
        error.hidden = false;
        nameInput.setAttribute('aria-invalid', 'true');
        nameInput.focus();
        return;
      }
      error.hidden = true;

      const lines = [
        `Hola, soy ${nombre}.`,
        `El tratamiento es para: ${data.get('para')}.`,
        `Me interesa: ${data.get('interes')}.`,
      ];
      const ciudad = String(data.get('ciudad') || '').trim();
      const mensaje = String(data.get('mensaje') || '').trim();
      if (ciudad) lines.push(`Mi ciudad y país: ${ciudad}.`);
      if (mensaje) lines.push(mensaje);
      lines.push('Quiero recibir orientación de Naturalis.');

      // Un <a> temporal evita el bloqueo de ventanas emergentes y conserva noopener.
      const a = document.createElement('a');
      a.href = waLink(lines.join('\n'));
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();

      if (note) {
        note.textContent = '¡Listo! Se abrió WhatsApp con tu mensaje. Si no se abrió, toca el botón otra vez.';
        note.classList.add('form__ok');
      }
      const btn = $('button[type="submit"]', form);
      if (btn) { const r = btn.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 14, 120, true); }
    });
  }

  /* ======================================================================
     2. Cargador
     ====================================================================== */
  function initLoader(onReady) {
    const loader = $('#loader');
    const pct = $('#loaderPct');
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (pct) pct.textContent = '100';
      doc.classList.add('is-ready');
      if (loader) {
        loader.classList.add('is-hiding');
        loader.setAttribute('aria-busy', 'false');
        setTimeout(() => loader.classList.add('is-done'), 750);
      }
      onReady();
    };

    if (!loader) { finish(); return; }

    const MIN = reduce ? 250 : 1500; // el spinner luce al menos esto
    const MAX = 2200;                // y nunca más de esto (el respaldo CSS lo oculta a los 2.4 s)
    const t0 = performance.now();
    let loaded = document.readyState === 'complete';
    window.addEventListener('load', () => { loaded = true; }, { once: true });

    (function tick(now) {
      if (finished) return;
      const el = now - t0;
      let shown = 100 * (1 - Math.pow(1 - clamp(el / MIN), 2.2));
      if (!loaded && el < MAX) shown = Math.min(shown, 92);
      if (pct) pct.textContent = String(Math.round(shown));
      if ((loaded && el >= MIN) || el >= MAX) finish();
      else requestAnimationFrame(tick);
    })(t0);

    // Seguro por si rAF se pausa (pestaña en segundo plano)
    setTimeout(finish, MAX);
  }

  /* ======================================================================
     3. Encabezado y menú
     ====================================================================== */
  const header = {
    el: $('#hdr'),
    lastY: window.scrollY,
    menuOpen: false,
  };

  function initMenu() {
    const burger = $('#burger');
    const menu = $('#menu');
    if (!burger || !menu) return;

    const setMenu = (open) => {
      header.menuOpen = open;
      menu.classList.toggle('is-open', open);
      burger.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      menu.setAttribute('aria-hidden', String(!open));
      doc.classList.toggle('menu-open', open);
      if (open && header.el) header.el.classList.remove('is-hidden');
    };

    burger.addEventListener('click', () => setMenu(!header.menuOpen));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && header.menuOpen) { setMenu(false); burger.focus(); } });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  function updateHeader(y) {
    if (!header.el) return;
    header.el.classList.toggle('is-scrolled', y > 24);
    if (header.menuOpen) { header.lastY = y; return; }
    const delta = y - header.lastY;
    if (Math.abs(delta) < 6) return;
    if (delta > 0 && y > 520) header.el.classList.add('is-hidden');
    else header.el.classList.remove('is-hidden');
    header.lastY = y;
  }

  /* ======================================================================
     4. Revelado, títulos por palabras y contadores
     ====================================================================== */
  function splitWords(el) {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    const frag = document.createDocumentFragment();
    text.split(' ').forEach((word, i, arr) => {
      const outer = document.createElement('span');
      outer.className = 'sw';
      const inner = document.createElement('span');
      inner.className = 'sw__i';
      inner.style.setProperty('--i', String(i));
      inner.textContent = word;
      outer.appendChild(inner);
      frag.appendChild(outer);
      if (i < arr.length - 1) frag.appendChild(document.createTextNode(' '));
    });
    el.textContent = '';
    el.appendChild(frag);
  }

  function countUp(el) {
    const end = Number(el.dataset.count) || 0;
    if (hasAnime()) {
      const o = { v: 0 };
      window.anime({ targets: o, v: end, round: 1, duration: 2200, easing: 'easeOutExpo', update: () => { el.textContent = String(o.v); } });
    } else {
      tween(2000, (p) => { el.textContent = String(Math.round(end * p)); });
    }
  }

  function initReveal() {
    const targets = $$('.rv, [data-split]');
    const counters = $$('[data-count]');

    if (!ANIM) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }

    $$('[data-split]').forEach(splitWords);
    counters.forEach((el) => { el.textContent = '0'; });

    const reveal = (el) => {
      el.classList.add('is-in');
      $$('[data-count]', el).forEach(countUp);
    };

    if (!('IntersectionObserver' in window)) { targets.forEach(reveal); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
    targets.forEach((el) => io.observe(el));
  }

  /* ======================================================================
     5. Hero: parallax con el puntero y partículas
     ====================================================================== */
  const heroPtr = { nx: 0, ny: 0, cx: -9999, cy: -9999, active: false, last: 0 };

  function initHero() {
    const hero = $('#inicio');
    const orb = $('#orb');
    if (!hero || !orb) return;

    if (finePointer) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        heroPtr.nx = ((e.clientX - r.left) / r.width) * 2 - 1;
        heroPtr.ny = ((e.clientY - r.top) / r.height) * 2 - 1;
        heroPtr.cx = e.clientX;
        heroPtr.cy = e.clientY;
        heroPtr.active = true;
        heroPtr.last = performance.now();
        hero.style.setProperty('--sx', `${e.clientX - r.left}px`);
        hero.style.setProperty('--sy', `${e.clientY - r.top}px`);
      }, { passive: true });
      hero.addEventListener('pointerleave', () => { heroPtr.active = false; heroPtr.cx = -9999; heroPtr.cy = -9999; });
    }

    if (!ANIM) return;
    let x = 0;
    let y = 0;
    visibleLoop(hero, (t) => {
      let tx = heroPtr.nx;
      let ty = heroPtr.ny;
      // Sin puntero (o en móvil) el orbe respira solo: el hero nunca queda quieto.
      if (!heroPtr.active || t - heroPtr.last > 2600) {
        tx = Math.sin(t * 0.00036) * 0.6;
        ty = Math.cos(t * 0.0003) * 0.45;
      }
      x = lerp(x, tx, 0.06);
      y = lerp(y, ty, 0.06);
      orb.style.setProperty('--rx', `${(y * -7).toFixed(2)}deg`);
      orb.style.setProperty('--ry', `${(x * 9).toFixed(2)}deg`);
      orb.style.setProperty('--mx', `${(x * 14).toFixed(2)}px`);
      orb.style.setProperty('--my', `${(y * 10).toFixed(2)}px`);
    });
  }

  function initSpores() {
    const cv = $('#spores');
    const ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!cv || !ctx) return;

    let w = 0;
    let h = 0;
    let parts = [];
    const spawn = (initial) => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 12,
      r: 0.8 + Math.random() * 2.3,
      vy: 0.12 + Math.random() * 0.42,
      ph: Math.random() * Math.PI * 2,
      sf: 0.0004 + Math.random() * 0.001,
      c: Math.random() < 0.6 ? '182,236,60' : Math.random() < 0.6 ? '238,245,138' : '255,255,255',
      a: 0.28 + Math.random() * 0.6,
    });

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(clamp((w * h) / 15000, 24, 78));
      while (parts.length < n) parts.push(spawn(true));
      parts.length = n;
      if (!ANIM) frame(0, 0);
    };

    const LINK = 112;
    function frame(t, dt) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const k = dt / 16.67;
      const rect = cv.getBoundingClientRect();
      const mx = heroPtr.cx - rect.left;
      const my = heroPtr.cy - rect.top;

      for (const p of parts) {
        p.ph += p.sf * dt;
        p.x += Math.sin(p.ph) * 0.35 * k;
        p.y -= p.vy * k;
        const dx = p.x - mx;
        const dy = p.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < 130 * 130 && d2 > 1) {
          const d = Math.sqrt(d2);
          const f = (1 - d / 130) * 2.6 * k;
          p.x += (dx / d) * f;
          p.y += (dy / d) * f;
        }
        if (p.y < -12 || p.x < -20 || p.x > w + 20) Object.assign(p, spawn(false), { x: Math.random() * w });
      }

      for (let i = 0; i < parts.length; i += 1) {
        const p = parts[i];
        for (let j = i + 1; j < parts.length; j += 1) {
          const q = parts[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.strokeStyle = `rgba(182,236,60,${((1 - Math.sqrt(d2) / LINK) * 0.17).toFixed(3)})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }

      for (const p of parts) {
        const a = p.a * (0.65 + 0.35 * Math.sin(p.ph * 3));
        ctx.fillStyle = `rgba(${p.c},${(a * 0.16).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3.6, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = `rgba(${p.c},${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
    }

    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv);
    else window.addEventListener('resize', resize);
    if (ANIM) visibleLoop(cv, frame);
  }

  /* ======================================================================
     6. Motor de scroll
     ====================================================================== */
  const scrollState = { ticking: false, items: [] };

  function initManifesto() {
    const text = $('#manifestoText');
    if (!text || !ANIM) return null;
    const words = [];
    (function walk(node) {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = part;
            frag.appendChild(s);
            words.push(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) {
          walk(n);
        }
      });
    })(text);
    return { text, words, lit: -1 };
  }

  function initSteps() {
    const steps = $('#steps');
    if (!steps) return null;
    return { steps, line: $('.steps__line', steps), items: $$('.step', steps) };
  }

  function initHScroll() {
    const sec = $('[data-hscroll]');
    if (!sec) return null;
    const sticky = $('.hscroll__sticky', sec);
    const viewport = $('.hscroll__viewport', sec);
    const track = $('#hTrack');
    // El pin solo se activa si caben título + tarjetas + barra en la altura de la ventana
    const mq = window.matchMedia('(min-width: 1024px) and (min-height: 760px)');
    const state = { sec, sticky, viewport, track, pinned: false, dist: 0, x: 0 };

    // Ajusta el ancho de las tarjetas (y con él su alto) para que todo quepa en una pantalla
    const fit = () => {
      const cs = getComputedStyle(sticky);
      const vcs = getComputedStyle(viewport);
      const head = $('.hscroll__head', sec);
      const foot = $('.hscroll__foot', sec);
      const fixed = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)
        + head.offsetHeight + foot.offsetHeight + 2 * (parseFloat(cs.rowGap) || 0)
        + (parseFloat(vcs.paddingTop) || 0) + (parseFloat(vcs.paddingBottom) || 0);
      for (let pass = 0; pass < 2; pass += 1) {
        const bodyH = Math.max(...$$('.pcard__body', track).map((b) => b.offsetHeight));
        const avail = sticky.clientHeight - fixed - bodyH - 8;
        // la foto de cada tarjeta tiene proporción 4:5, así que ancho = alto disponible × 0.8
        sec.style.setProperty('--pin-w', `${clamp(avail * 0.8, 230, 340).toFixed(0)}px`);
      }
    };

    state.measure = () => {
      const want = ANIM && mq.matches;
      if (want !== state.pinned) {
        state.pinned = want;
        sec.classList.toggle('is-pinned', want);
        if (want) {
          track.removeAttribute('tabindex');
          $$('img', track).forEach((img) => { img.loading = 'eager'; });
        } else {
          track.setAttribute('tabindex', '0');
          track.style.transform = '';
          sec.style.height = '';
        }
      }
      if (state.pinned) {
        fit();
        const pad = parseFloat(getComputedStyle(viewport).paddingLeft) || 0;
        state.dist = Math.max(0, track.offsetWidth + pad * 2 - viewport.clientWidth);
        sec.style.height = `${sticky.offsetHeight + state.dist}px`;
      }
    };

    state.update = () => {
      if (state.pinned) {
        const r = sec.getBoundingClientRect();
        const p = state.dist ? clamp(-r.top / state.dist) : 0;
        state.x = p * state.dist;
        track.style.transform = `translate3d(${(-state.x).toFixed(1)}px,0,0)`;
        sec.style.setProperty('--hp', (0.12 + p * 0.88).toFixed(4));
      }
    };

    // Modo nativo (móvil / tablet): deslizar con el dedo y barra de avance
    viewport.addEventListener('scroll', () => {
      if (state.pinned) return;
      const max = viewport.scrollWidth;
      sec.style.setProperty('--hp', clamp((viewport.scrollLeft + viewport.clientWidth) / max).toFixed(4));
    }, { passive: true });

    // Escritorio sin pin (ventana baja): arrastrar con el mouse para recorrer el catálogo
    if (finePointer) {
      let down = false;
      let moved = false;
      let sx = 0;
      let sl = 0;
      viewport.addEventListener('pointerdown', (e) => {
        if (state.pinned || e.pointerType !== 'mouse' || e.button !== 0) return;
        down = true; moved = false; sx = e.clientX; sl = viewport.scrollLeft;
      });
      window.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - sx;
        if (Math.abs(dx) > 5) { moved = true; viewport.style.scrollSnapType = 'none'; viewport.scrollLeft = sl - dx; }
      });
      window.addEventListener('pointerup', () => {
        if (!down) return;
        down = false;
        viewport.style.scrollSnapType = '';
      });
      // Si fue un arrastre, no se dispara el clic del botón o enlace que quedó debajo
      viewport.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    }

    // Teclado: al enfocar una tarjeta en modo pin, se desplaza la página hasta mostrarla
    sticky.addEventListener('scroll', () => { sticky.scrollLeft = 0; });
    track.addEventListener('focusin', (e) => {
      if (!state.pinned || !state.dist) return;
      const card = e.target.closest('.pcard');
      if (!card) return;
      const pad = parseFloat(getComputedStyle(viewport).paddingLeft) || 0;
      const vw = viewport.clientWidth;
      let t = state.x;
      if (card.offsetLeft - t < pad) t = card.offsetLeft - pad;
      else if (card.offsetLeft + card.offsetWidth - t > vw - pad) t = card.offsetLeft + card.offsetWidth - vw + pad;
      const top = window.scrollY + sec.getBoundingClientRect().top + clamp(t / state.dist) * state.dist;
      window.scrollTo({ top, behavior: 'auto' });
    });

    state.measure();
    return state;
  }

  function initExpand() {
    const ex = $('[data-expand]');
    if (!ex) return null;
    if (!ANIM) {
      if (JS) {
        ex.style.setProperty('--e', '1');
        ex.style.height = 'auto';
        ex.classList.add('is-open');
      }
      return null;
    }
    return { ex };
  }

  function initScrollEngine() {
    const hero = $('#inicio');
    const manifesto = $('#manifiesto');
    const manifestoState = initManifesto();
    const stepsState = initSteps();
    const hs = initHScroll();
    const expand = initExpand();
    const parallax = $$('[data-parallax-img]');
    const progressEls = $$('[data-progress]');
    const navLinks = $$('.nav a');
    const navTargets = navLinks.map((a) => ({ a, sec: $(a.getAttribute('href')) })).filter((n) => n.sec);

    const update = () => {
      scrollState.ticking = false;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const maxY = Math.max(1, doc.scrollHeight - vh);

      doc.style.setProperty('--sp', clamp(y / maxY).toFixed(4));
      updateHeader(y);

      // --p por sección: el hero se "va" al bajar; el resto mide su paso por la pantalla
      if (ANIM) {
        progressEls.forEach((el) => {
          const r = el.getBoundingClientRect();
          const p = el === hero ? clamp(-r.top / (r.height * 0.85)) : clamp((vh - r.top) / (vh + r.height));
          el.style.setProperty('--p', p.toFixed(4));
        });
      }

      // Manifiesto: las palabras se iluminan al leer
      if (manifestoState && manifesto) {
        const r = manifestoState.text.getBoundingClientRect();
        const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.4));
        const lit = Math.ceil(p * manifestoState.words.length * 1.06) - 1;
        if (lit !== manifestoState.lit) {
          manifestoState.words.forEach((w, i) => w.classList.toggle('on', i <= lit));
          manifestoState.lit = lit;
        }
      }

      // Pasos: la línea se llena y cada paso se enciende
      if (stepsState && ANIM) {
        const focus = vh * 0.6;
        const r = stepsState.line.getBoundingClientRect();
        stepsState.steps.style.setProperty('--p', clamp((focus - r.top) / r.height).toFixed(4));
        stepsState.items.forEach((s) => {
          const n = $('.step__n', s).getBoundingClientRect();
          s.classList.toggle('on', n.top + n.height / 2 <= focus);
        });
      }

      if (hs) hs.update();

      // Imagen que se abre: --e va de 0 (marco pequeño) a 1 (pantalla completa)
      if (expand) {
        const r = expand.ex.getBoundingClientRect();
        const total = Math.max(1, expand.ex.offsetHeight - vh);
        const e = easeInOut(clamp(clamp(-r.top / total) / 0.62));
        expand.ex.style.setProperty('--e', e.toFixed(4));
        expand.ex.classList.toggle('is-open', e > 0.9);
      }

      // Parallax de la foto de ingredientes
      if (ANIM) {
        parallax.forEach((fig) => {
          const r = fig.getBoundingClientRect();
          if (r.bottom < -100 || r.top > vh + 100) return;
          const c = clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1);
          fig.style.setProperty('--ty', `${(c * -r.height * 0.09).toFixed(1)}px`);
        });
      }

      // Enlace activo en el menú de escritorio
      if (navTargets.length) {
        let current = null;
        navTargets.forEach((n) => { if (n.sec.getBoundingClientRect().top <= vh * 0.4) current = n; });
        navTargets.forEach((n) => {
          const on = n === current;
          n.a.classList.toggle('is-active', on);
          if (on) n.a.setAttribute('aria-current', 'true'); else n.a.removeAttribute('aria-current');
        });
      }
    };

    const request = () => {
      if (!scrollState.ticking) { scrollState.ticking = true; requestAnimationFrame(update); }
    };
    const remeasure = () => { if (hs) hs.measure(); request(); };

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', remeasure);
    window.addEventListener('load', remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    update();
  }

  /* ======================================================================
     7. Interacciones sueltas
     ====================================================================== */
  function initMagnetic() {
    if (!finePointer || reduce) return;
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.translate = `${(dx * 14).toFixed(1)}px ${(dy * 10).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = '0 0'; });
    });
  }

  function initSpot() {
    if (!finePointer) return;
    $$('[data-spot]').forEach((tile) => {
      tile.addEventListener('pointermove', (e) => {
        const r = tile.getBoundingClientRect();
        tile.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
        tile.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
      }, { passive: true });
    });
  }

  function initTilt() {
    if (!finePointer || reduce) return;
    $$('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--tx', `${((0.5 - py) * 9).toFixed(2)}deg`);
        card.style.setProperty('--ty', `${((px - 0.5) * 11).toFixed(2)}deg`);
      }, { passive: true });
      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--tx', '0deg');
        card.style.setProperty('--ty', '0deg');
      });
    });
  }

  function initFlips() {
    $$('.flip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const on = btn.classList.toggle('is-flipped');
        btn.setAttribute('aria-pressed', String(on));
      });
    });
  }

  function initFaq() {
    const items = $$('.qa');
    const set = (qa, open) => {
      qa.classList.toggle('open', open);
      $('.qa__q', qa).setAttribute('aria-expanded', String(open));
    };
    items.forEach((qa, i) => {
      const btn = $('.qa__q', qa);
      const ans = $('.qa__a', qa);
      ans.id = `qa-a-${i + 1}`;
      btn.setAttribute('aria-controls', ans.id);
      btn.addEventListener('click', () => {
        const open = !qa.classList.contains('open');
        items.forEach((other) => { if (other !== qa) set(other, false); });
        set(qa, open);
      });
    });
    if (items[0]) set(items[0], true);
  }

  function initCtaBurst() {
    if (!ANIM) return;
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest ? e.target.closest('.btn--lime, .wa-fab') : null;
      if (btn) burst(e.clientX, e.clientY, 10, 70, false);
    });
  }

  /* ======================================================================
     8. Visor de imágenes
     ====================================================================== */
  function initLightbox() {
    const lb = $('#lightbox');
    const media = $('#lightboxMedia');
    const cap = $('#lightboxCap');
    const cta = $('#lightboxCta');
    if (!lb || !media) return;
    let opener = null;

    const close = () => {
      if (typeof lb.close === 'function') lb.close(); else lb.removeAttribute('open');
      cleanup();
    };
    const cleanup = () => {
      doc.classList.remove('lb-open');
      media.textContent = '';
      if (opener) { opener.focus({ preventScroll: true }); opener = null; }
    };

    $$('[data-zoom]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.pcard');
        const crop = card && $('.crop', card);
        if (!crop) return;
        opener = btn;
        const clone = crop.cloneNode(true);
        $$('img', clone).forEach((img) => img.removeAttribute('loading'));
        media.replaceChildren(clone);
        cap.textContent = `${$('h3', card).textContent}. ${$('p', card).textContent}`;
        const msg = ($('a[data-wa]', card) || {}).dataset ? $('a[data-wa]', card).dataset.wa : 'Hola, quiero información de Naturalis.';
        cta.dataset.wa = msg;
        if (WA) { cta.href = waLink(msg); cta.target = '_blank'; cta.rel = 'noopener noreferrer'; }
        doc.classList.add('lb-open');
        if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
      });
    });

    $$('[data-close]', lb).forEach((b) => b.addEventListener('click', close));
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    lb.addEventListener('close', cleanup);
    cta.addEventListener('click', () => { if (!WA) close(); });
  }

  /* ======================================================================
     9. Globo de envíos
     ====================================================================== */
  // Siluetas muy simplificadas de continentes [lon, lat]: sirven solo para dibujar puntos de "tierra".
  const LAND = [
    // Norteamérica + México + Centroamérica
    [[-168, 66], [-162, 70], [-156, 71.3], [-141, 69.6], [-128, 70], [-115, 68], [-108, 68.5], [-95, 68], [-88, 68.8], [-82, 67.5], [-87, 64], [-94, 59], [-92.5, 57], [-85, 55.3], [-82.3, 55], [-82.5, 53], [-79.5, 51.3], [-78.8, 53], [-79.3, 55.5], [-77, 60.5], [-78, 62.3], [-72, 61.5], [-68, 59], [-65, 60.3], [-61.5, 56.5], [-57, 52], [-60, 50], [-66, 50], [-70, 47.5], [-64, 48.5], [-60, 46], [-64, 44.5], [-67, 44.7], [-70, 43.5], [-70, 41.7], [-74, 40.5], [-75.5, 38], [-76, 35], [-78, 33.8], [-81, 31.5], [-80.2, 27], [-80.2, 25.2], [-81.5, 25.5], [-82.8, 28], [-83.5, 29.8], [-85.5, 30], [-88, 30.3], [-90, 29.2], [-92, 29.6], [-94, 29.5], [-96.8, 28], [-97.4, 25.9], [-97.7, 22.5], [-96.2, 19.2], [-94.5, 18.2], [-91.5, 18.6], [-90.6, 19.4], [-90.4, 21.1], [-88.2, 21.5], [-87, 21.5], [-87.5, 18.5], [-88.3, 16.5], [-88.9, 15.8], [-87.5, 15.9], [-85, 15.9], [-83.4, 15], [-83.5, 12], [-83.7, 10.9], [-82.5, 9.5], [-81.2, 8.8], [-79.5, 9.6], [-77.4, 8.6], [-78.2, 7.2], [-80, 7.3], [-81.5, 8.3], [-83.3, 8.6], [-85.7, 10], [-87.5, 13], [-91.5, 14], [-94.5, 16.2], [-97.5, 15.9], [-101, 17.2], [-105, 19.5], [-105.6, 21.5], [-105.5, 23], [-108.5, 25.5], [-111, 28.5], [-112.5, 30], [-114.7, 31.7], [-113.5, 29.5], [-111.5, 26.5], [-110, 23], [-112, 25], [-114.5, 28], [-116.7, 31], [-117.1, 32.5], [-118.5, 34], [-120.6, 34.5], [-122.4, 37.5], [-124.2, 40.3], [-124.5, 43], [-124, 46.5], [-124.7, 48.4], [-127, 50.6], [-130, 54.6], [-133, 57], [-137, 58.4], [-141, 60], [-147, 60.8], [-152, 59.2], [-154, 57.5], [-158, 56.2], [-162, 55], [-164, 54.7], [-160, 58.5], [-162, 60], [-165, 62], [-163.5, 64.5], [-168, 65.5]],
    // Groenlandia
    [[-73, 78.5], [-60, 82], [-30, 83.5], [-20, 80], [-18, 76], [-22, 70], [-32, 68], [-40, 65], [-43, 60], [-49, 61], [-53, 66], [-55, 70], [-62, 76]],
    // Isla de Baffin
    [[-80, 73.5], [-72, 71], [-62, 67], [-65, 63], [-72, 63.5], [-78, 64.5], [-87, 66], [-85, 70], [-90, 72.5]],
    // Cuba y La Española
    [[-85, 22], [-82, 23], [-77.5, 21.8], [-74, 20.2], [-77.5, 19.9], [-81, 22]],
    [[-74.4, 18.4], [-72, 19.9], [-69, 19.3], [-68.4, 18.5], [-71, 17.9]],
    // Sudamérica
    [[-77.4, 8.6], [-75.5, 10.8], [-72.5, 12], [-70, 12.2], [-68, 10.6], [-64, 10.6], [-61, 8.6], [-58, 6.5], [-55, 5.9], [-52, 4.9], [-50, 1.8], [-50, -0.2], [-47, -0.8], [-44, -2.5], [-40, -2.8], [-37, -4.8], [-35, -7], [-35, -9.5], [-38.5, -13], [-39, -17.8], [-40, -20.5], [-42, -23], [-45, -23.8], [-48.5, -26], [-48.8, -28.5], [-52, -32], [-53.5, -34], [-56, -34.8], [-57.5, -36.5], [-57.2, -38.5], [-62, -39], [-62.3, -41], [-65, -41], [-64.3, -42.8], [-65.5, -45], [-67.5, -46.5], [-66, -47.8], [-69, -50.5], [-68.5, -52.3], [-71, -54], [-74, -52.5], [-75.5, -48], [-73.7, -44], [-73.4, -39], [-71.7, -33], [-71.5, -30], [-70.5, -23], [-70.2, -18.3], [-76, -14], [-79, -8], [-81.2, -5.8], [-80.3, -3.4], [-80.9, -0.8], [-80, 1], [-78.8, 1.8], [-77.4, 4], [-77.5, 7]],
    // África
    [[-17, 21], [-13, 27.5], [-9.7, 30], [-9.8, 35.8], [-5.5, 35.9], [-2, 35.1], [0, 36.5], [3, 36.8], [10, 37.3], [11, 35], [10.2, 33.8], [15, 32.3], [19, 30.3], [20, 32.2], [23, 32.7], [29, 31], [32.4, 31.3], [32.5, 30], [34, 27], [35.5, 24], [37.2, 21], [38.5, 18], [40, 15], [43, 12.7], [44, 10.5], [51.2, 11.8], [50.7, 9], [48, 5], [44, 1.5], [41, -2], [39.2, -5], [39, -8], [40.5, -11], [40.5, -15], [36, -19], [35, -24], [32.8, -26.5], [31, -29.5], [28, -32.8], [25, -34], [20, -34.8], [18.4, -34], [17.5, -30], [15, -26], [14.5, -22], [12, -18], [11.8, -14], [13.5, -10], [12.3, -6], [9, -1], [9.5, 3.9], [6, 4.3], [3.5, 6.4], [-1.5, 4.8], [-4.5, 5.2], [-7.5, 4.4], [-11, 6.7], [-13.2, 8.5], [-15.2, 11], [-16.8, 12.5], [-17.5, 14.7], [-16.5, 19.5]],
    [[49.3, -12], [50.3, -15.5], [47.5, -25], [45, -25.2], [43.5, -22], [44.2, -17], [47, -15]],
    // Eurasia
    [[-9.5, 38.7], [-8.8, 41.8], [-9.2, 43.2], [-1.8, 43.4], [-1.2, 46], [-4.5, 48.4], [-1.5, 48.7], [1.5, 50.5], [4, 51.5], [5, 53.2], [8.5, 53.8], [8.3, 55.5], [10, 57.6], [10.5, 56], [12, 54.2], [14, 54.2], [19.5, 54.5], [21, 56.5], [24, 57.2], [23.5, 59.2], [28, 59.7], [30, 60.2], [25, 60], [22, 60.5], [21.5, 63], [25, 65.2], [22, 65.8], [17.5, 62.7], [17, 60.5], [18.5, 59.3], [16.5, 57], [14.5, 55.5], [12.8, 56], [11.5, 58.2], [9, 58.9], [5.5, 58.8], [5, 61.5], [8, 63.5], [12.5, 66], [15.5, 68.8], [20, 70], [25, 71], [30, 70.3], [33, 69.4], [41, 67.5], [41, 66.5], [44, 68.5], [53, 68.5], [60, 69.5], [68, 69], [70, 73], [80, 73.5], [87, 74.5], [100, 77.5], [105, 77], [113, 73.8], [125, 73.5], [130, 71], [140, 72.5], [150, 71.5], [160, 69.5], [170, 70], [180, 68.5], [180, 66], [170, 60.5], [160, 60], [155, 59.5], [143, 59.2], [137, 54.5], [141, 52], [140.5, 48], [135, 43.5], [131.5, 42.8], [129.5, 40.5], [129.2, 36], [126.5, 34.5], [126.5, 37.5], [125, 39.5], [121.5, 39], [121.5, 40.8], [118, 39], [119, 37.2], [122.5, 37], [119.5, 34.5], [121.8, 31.5], [121.5, 28.5], [119.5, 25.5], [117, 23.4], [113.5, 22.2], [110, 21], [108, 21.7], [106.5, 20.3], [105.8, 19], [108.8, 15.5], [109.3, 12], [107, 10.4], [105, 8.7], [104.8, 10.4], [100.5, 13.5], [99.2, 10], [100.4, 7], [103.4, 4.3], [104.2, 1.4], [102, 2.5], [100.5, 5], [98.5, 8], [98.3, 10.5], [97.8, 16.5], [94.5, 16.2], [94.3, 19], [92, 21.5], [91, 22.5], [88.8, 21.7], [86.8, 20.5], [85, 19.5], [82.5, 16.8], [80.3, 15.5], [80, 13], [79.8, 10.3], [78, 8.6], [77.2, 8.1], [76, 10.5], [74.7, 12.8], [73.2, 17.5], [72.7, 21], [70, 21], [68.8, 23], [66.5, 25.4], [61.5, 25.2], [57, 25.7], [56.5, 27], [54, 26.7], [50.8, 28.9], [48.5, 30], [50, 26.5], [51.5, 24.2], [54, 24.1], [56, 26], [56.8, 24.5], [58.8, 23.5], [59.8, 22.5], [57.5, 18.8], [55, 17.2], [52, 16.2], [49, 14.2], [45, 12.8], [43.3, 13.2], [42.8, 15.5], [41.5, 19], [39, 22], [37, 25.5], [35.2, 28.2], [34.8, 29.5], [34.2, 31.3], [35, 33], [35.9, 35.7], [36, 36.6], [33, 36.2], [30.5, 36.6], [28, 36.7], [26.5, 38.5], [26.5, 40], [26, 40.8], [23.5, 40.5], [24, 38], [22.5, 36.5], [21, 38.3], [19.5, 41.5], [16, 43.5], [13.5, 45.7], [12.3, 44.5], [14, 42.5], [16.2, 41.8], [18.5, 40.2], [16.5, 39], [15.7, 38], [15.8, 40], [14, 40.8], [11, 42.5], [9, 44.3], [6.8, 43.2], [3.2, 43.2], [3, 41.8], [0.5, 40.5], [-0.3, 38.5], [-2, 36.7], [-5.4, 36.1], [-6.5, 36.8], [-9, 37.1]],
    // Islas: Reino Unido, Irlanda, Islandia, Japón, Indonesia, Nueva Guinea, Australia, Nueva Zelanda
    [[-5.5, 50], [1.5, 51], [1.7, 53], [-0.5, 55], [-2, 57.5], [-4, 58.6], [-6, 57], [-5, 55], [-3, 54], [-4.5, 52]],
    [[-10, 51.5], [-6, 52], [-6, 55], [-8.5, 55]],
    [[-24, 65.5], [-22, 66.4], [-16, 66.3], [-13.5, 65], [-18, 63.4], [-22.5, 63.8]],
    [[130, 31], [131.5, 33.5], [135, 35.5], [140, 36], [141.5, 39], [142, 41.5], [141.5, 45], [145, 43.2], [143, 42], [141, 41.2], [140, 38], [140.8, 35.5], [138, 34.7], [135, 33.5], [132.5, 33.5]],
    [[95.3, 5.5], [98.5, 3.5], [103.5, -1], [106, -3], [105.8, -5.9], [101.5, -3.5], [98, 0.5]],
    [[109, 1.5], [111, -3], [116, -4], [118, 1], [117.5, 7], [113, 3]],
    [[106, -6], [114.5, -7.6], [114.5, -8.7], [106, -7.4]],
    [[131, -1], [138, -1.7], [144, -3.7], [147.5, -6.1], [150.5, -10.5], [146, -8.5], [141, -9.2], [138, -8.2], [135, -4.5], [132.5, -3.2]],
    [[114, -22], [113.5, -26], [115, -34.2], [118, -35], [123.5, -34], [129, -31.5], [135, -34.8], [138, -35.5], [140, -38], [146, -39], [150, -37.5], [153, -31], [153.2, -25], [149, -20], [146, -18.8], [145.5, -14.8], [142.5, -10.8], [141.5, -15], [139.5, -17.5], [136.5, -15], [136.5, -12], [132, -11.5], [130, -12.2], [127, -14], [125, -15], [122, -17.5], [120, -20], [117, -20.7]],
    [[172.7, -34.5], [175, -37], [178, -37.7], [175, -41.5], [174, -39.5]],
    [[172.7, -40.5], [174, -41.7], [171, -44.5], [169, -46.6], [166.5, -46], [170.5, -43]],
  ];
  // Mares interiores que se "recortan" de la tierra
  const WATER = [
    [[28, 41.5], [28, 44], [30, 46], [33, 46], [35, 45], [38, 47], [40, 43.5], [41.5, 41.5], [36, 41.7], [31, 41.2]],
    [[47, 45], [51, 47], [53, 45], [54, 41], [53, 37], [50, 37], [49, 40], [47, 42]],
  ];
  const VERACRUZ = [19.17, -96.13];
  // Destinos decorativos (las rutas ilustran la cobertura: México, EE. UU., Centro y Sudamérica)
  const ROUTES = [
    [34.05, -118.24], [41.88, -87.63], [40.71, -74.0], [25.76, -80.19],
    [14.63, -90.51], [8.98, -79.52], [4.71, -74.07], [-12.05, -77.04],
    [-33.45, -70.67], [-34.6, -58.38], [-23.55, -46.63], [20.66, -103.35],
  ];

  function initGlobe() {
    const cv = $('#globe');
    const ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!cv || !ctx) return;
    const D2R = Math.PI / 180;

    const inPoly = (lon, lat, poly) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const [xi, yi] = poly[i];
        const [xj, yj] = poly[j];
        if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };

    // Puntos de tierra en una malla casi uniforme sobre la esfera
    const dots = [];
    const STEP = 2.7;
    for (let lat = -78, row = 0; lat <= 83; lat += STEP, row += 1) {
      const n = Math.max(1, Math.round((360 * Math.cos(lat * D2R)) / STEP));
      for (let k = 0; k < n; k += 1) {
        const lon = -180 + ((k + (row % 2 ? 0.5 : 0)) * 360) / n;
        if (!LAND.some((p) => inPoly(lon, lat, p)) || WATER.some((p) => inPoly(lon, lat, p))) continue;
        const la = lat * D2R;
        const lo = lon * D2R;
        dots.push([Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]);
      }
    }

    const vec = (lat, lon) => {
      const la = lat * D2R;
      const lo = lon * D2R;
      return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
    };
    const origin = vec(VERACRUZ[0], VERACRUZ[1]);

    // Arcos de círculo máximo elevados sobre la superficie
    const arcs = ROUTES.map((dest, idx) => {
      const b = vec(dest[0], dest[1]);
      const dot = clamp(origin[0] * b[0] + origin[1] * b[1] + origin[2] * b[2], -1, 1);
      const omega = Math.acos(dot);
      const N = 44;
      const pts = [];
      for (let i = 0; i <= N; i += 1) {
        const t = i / N;
        const s = Math.sin(omega) || 1;
        const k1 = Math.sin((1 - t) * omega) / s;
        const k2 = Math.sin(t * omega) / s;
        const lift = 1 + Math.sin(Math.PI * t) * (0.1 + omega * 0.16);
        pts.push([(origin[0] * k1 + b[0] * k2) * lift, (origin[1] * k1 + b[1] * k2) * lift, (origin[2] * k1 + b[2] * k2) * lift]);
      }
      return { pts, end: b, phase: idx * 0.37, speed: 0.00021 + (idx % 4) * 0.00004 };
    });

    let size = 0;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size = cv.clientWidth; // tamaño de layout: no lo afecta la animación de entrada (scale) del contenedor
      cv.width = Math.max(1, Math.round(size * dpr));
      cv.height = Math.max(1, Math.round(size * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!ANIM) draw(0);
    };

    // Estado de la vista: sway automático + arrastre del usuario que regresa suavemente
    const view = { drag: false, yaw: 0, tilt: 0, lx: 0, ly: 0 };
    const BASE_LON = -92 * D2R;
    const BASE_TILT = 0.4;

    cv.addEventListener('pointerdown', (e) => {
      view.drag = true; view.lx = e.clientX; view.ly = e.clientY;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!view.drag) return;
      view.yaw -= (e.clientX - view.lx) * 0.006;
      view.tilt = clamp(view.tilt + (e.clientY - view.ly) * 0.004, -0.35, 0.35);
      view.lx = e.clientX; view.ly = e.clientY;
      if (!ANIM) draw(0);
    });
    const release = () => { view.drag = false; };
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', release);

    function draw(t) {
      const R = size * 0.4;
      const cx = size / 2;
      const cy = size / 2;
      if (ANIM && !view.drag) { view.yaw *= 0.985; view.tilt *= 0.985; }
      const l0 = BASE_LON + (ANIM ? Math.sin(t * 0.00021) * 0.62 : 0) + view.yaw;
      const T = BASE_TILT + view.tilt;
      const cl = Math.cos(l0);
      const sl = Math.sin(l0);
      const cT = Math.cos(T);
      const sT = Math.sin(T);

      // [x, y, z] del mundo -> [pantalla x, pantalla y, profundidad]
      const proj = (p) => {
        const x = p[0] * cl - p[2] * sl;
        const z0 = p[0] * sl + p[2] * cl;
        const y = p[1] * cT - z0 * sT;
        const z = p[1] * sT + z0 * cT;
        return [cx + x * R, cy - y * R, z, x * x + y * y];
      };

      ctx.clearRect(0, 0, size, size);

      // Halo atmosférico
      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.32);
      halo.addColorStop(0, 'rgba(182,236,60,0.26)');
      halo.addColorStop(1, 'rgba(182,236,60,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.32, 0, 6.2832);
      ctx.fill();

      // Cuerpo de la esfera
      const body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.08, cx, cy, R);
      body.addColorStop(0, 'rgba(24,153,58,0.62)');
      body.addColorStop(0.55, 'rgba(8,56,26,0.82)');
      body.addColorStop(1, 'rgba(3,24,10,0.96)');
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 6.2832);
      ctx.fill();

      // Retícula (paralelos y meridianos)
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = 'rgba(214,245,110,0.13)';
      const line = (points) => {
        ctx.beginPath();
        let pen = false;
        for (const p of points) {
          const q = proj(p);
          if (q[2] > 0) { if (pen) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); pen = true; } else pen = false;
        }
        ctx.stroke();
      };
      for (let lat = -60; lat <= 60; lat += 30) {
        const pts = [];
        for (let lon = -180; lon <= 180; lon += 6) pts.push(vec(lat, lon));
        line(pts);
      }
      for (let lon = -180; lon < 180; lon += 30) {
        const pts = [];
        for (let lat = -84; lat <= 84; lat += 6) pts.push(vec(lat, lon));
        line(pts);
      }

      // Tierra en puntos
      for (const d of dots) {
        const q = proj(d);
        if (q[2] <= 0.02) continue;
        const a = 0.18 + q[2] * 0.72;
        ctx.fillStyle = `rgba(214,245,110,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(q[0], q[1], 0.7 + q[2] * 1.05, 0, 6.2832);
        ctx.fill();
      }

      // Rutas: trazo tenue + cometa que viaja
      ctx.globalCompositeOperation = 'lighter';
      for (const arc of arcs) {
        const sp = arc.pts.map(proj);
        const vis = (q) => q[2] > 0 || q[3] > 1;
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(182,236,60,0.2)';
        ctx.beginPath();
        let pen = false;
        sp.forEach((q) => {
          if (vis(q)) { if (pen) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); pen = true; } else pen = false;
        });
        ctx.stroke();

        // Destino (siempre visible)
        const e = proj(arc.end);
        if (e[2] > 0.02) {
          ctx.fillStyle = 'rgba(182,236,60,0.9)';
          ctx.beginPath();
          ctx.arc(e[0], e[1], 2, 0, 6.2832);
          ctx.fill();
        }

        const u = ((t * arc.speed + arc.phase) % 1.5);
        if (u > 1.28) continue;
        const head = Math.min(u, 1) * (sp.length - 1);
        const tail = Math.max(0, u - 0.3) * (sp.length - 1);
        for (let i = Math.floor(tail); i < Math.min(Math.ceil(head), sp.length - 1); i += 1) {
          const a = sp[i];
          const b = sp[i + 1];
          if (!vis(a) || !vis(b)) continue;
          const f = clamp((i - tail) / Math.max(1, head - tail));
          ctx.strokeStyle = `rgba(238,245,138,${(0.15 + f * 0.85).toFixed(3)})`;
          ctx.lineWidth = 1 + f * 1.4;
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
        const h = sp[Math.min(sp.length - 1, Math.round(head))];
        if (u <= 1 && vis(h)) {
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath();
          ctx.arc(h[0], h[1], 2.2, 0, 6.2832);
          ctx.fill();
          ctx.fillStyle = 'rgba(182,236,60,0.35)';
          ctx.beginPath();
          ctx.arc(h[0], h[1], 6, 0, 6.2832);
          ctx.fill();
        }
      }

      // Veracruz: origen con pulso
      const o = proj(origin);
      if (o[2] > 0.02) {
        const k = ((t % 1800) / 1800);
        ctx.strokeStyle = `rgba(182,236,60,${(0.8 * (1 - k)).toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(o[0], o[1], 4 + k * 24, 0, 6.2832);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(o[0], o[1], 3.4, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = 'rgba(182,236,60,0.7)';
        ctx.beginPath();
        ctx.arc(o[0], o[1], 7, 0, 6.2832);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // Borde de la esfera
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rim.addColorStop(0, 'rgba(214,245,110,0.6)');
      rim.addColorStop(1, 'rgba(214,245,110,0.08)');
      ctx.strokeStyle = rim;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 6.2832);
      ctx.stroke();
    }

    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv);
    else window.addEventListener('resize', resize);
    if (ANIM) visibleLoop(cv, (t) => draw(t), '120px');
  }

  /* ======================================================================
     10. Arranque
     ====================================================================== */
  /** Cada módulo corre aislado: si uno falla, el resto de la página sigue funcionando. */
  function safe(fn) {
    try { fn(); } catch (err) { if (window.console) console.warn('[naturalis]', fn.name, err); }
  }

  function onReady() {
    try {
      initReveal();
    } catch (err) {
      // Pase lo que pase, el contenido nunca se queda oculto
      $$('.rv, [data-split]').forEach((el) => el.classList.add('is-in'));
    }
    // Ráfaga de bienvenida desde el orbe (solo si anime.js alcanzó a cargar)
    safe(() => {
      const orb = $('#orb');
      if (orb && ANIM) {
        const r = orb.getBoundingClientRect();
        if (r.width && r.top < window.innerHeight) burst(r.left + r.width / 2, r.top + r.height / 2, 22, Math.min(260, r.width * 0.7), true);
      }
    });
  }

  function boot() {
    const year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());

    [initWhatsApp, initForm, initMenu, initHero, initSpores, initScrollEngine, initMagnetic, initSpot,
      initTilt, initFlips, initFaq, initCtaBurst, initLightbox, initGlobe].forEach(safe);

    // El cargador va siempre al final y siempre se ejecuta
    initLoader(onReady);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
