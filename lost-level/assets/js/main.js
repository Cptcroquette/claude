/* LOST LEVEL — mouvement & interface.
   Aucune dépendance. Tout ce qui est ici améliore une page déjà complète sans JS. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---- 1. Découpe typographique : chaque lettre devient un module ---------- */
  // Le texte reste lisible par les lecteurs d'écran via une copie masquée (.sr-only).
  $$('[data-split]').forEach(el => {
    const text = el.textContent;
    el.textContent = '';
    if (!el.closest('[aria-hidden="true"]')) {
      const sr = document.createElement('span');
      sr.className = 'sr-only';
      sr.textContent = text.trim();
      el.appendChild(sr);
    }
    // les lettres sont groupées par mot : la ligne ne casse jamais au milieu d'un mot
    let i = 0;
    text.trim().split(/\s+/).forEach((word, w) => {
      if (w) el.appendChild(document.createTextNode(' '));
      const wrap = document.createElement('span');
      wrap.className = 'wd';
      wrap.setAttribute('aria-hidden', 'true');
      [...word].forEach(c => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.style.setProperty('--i', i++);
        s.textContent = c;
        wrap.appendChild(s);
      });
      el.appendChild(wrap);
    });
  });

  /* ---- 2. Révélations à l'entrée dans le cadre ----------------------------- */
  const reveal = $$('[data-reveal], [data-split], .book');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    reveal.forEach(el => io.observe(el));
  } else {
    reveal.forEach(el => el.classList.add('is-in'));
  }

  /* ---- 3. Afficheurs LCD : les chiffres défilent comme sur un compteur ------ */
  const pad = (n, w) => String(n).padStart(w, '0');
  function rollTo(el, target, { width = 2, sign = '', ms = 700 } = {}) {
    if (reduce.matches) { el.textContent = sign + pad(target, width); return; }
    const from = parseInt(el.dataset.v || '0', 10);
    const t0 = performance.now();
    cancelAnimationFrame(el._raf);
    const tick = now => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = sign + pad(Math.round(from + (target - from) * e), width);
      if (k < 1) el._raf = requestAnimationFrame(tick);
    };
    el._raf = requestAnimationFrame(tick);
    el.dataset.v = target;
  }
  // durée d'une session, compte de 00 à 60 après l'ouverture de la porte
  $$('[data-count]').forEach(el => {
    const target = +el.dataset.count;
    if (reduce.matches) return;
    el.textContent = '00';
    setTimeout(() => rollTo(el, target, { ms: 1400 }), 1100);
  });

  /* ---- 4. Jauge de niveau : la page se lit comme une descente --------------- */
  const gauge = $('[data-gauge]');
  const lcd = $('[data-gauge-lcd]');
  const levels = $$('main [data-level]');
  const navLinks = $$('.bar__nav a[href^="#"], .gauge a');
  let current = null;
  function setLevel(id) {
    if (id === current) return;
    current = id;
    if (lcd) rollTo(lcd, parseInt(id, 10), { sign: '-', ms: 350 });
    navLinks.forEach(a => {
      const on = a.getAttribute('href') === '#' + $(`main [data-level="${id}"]`).id;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }

  /* ---- 5. Scroll lié : un seul gestionnaire, des variables CSS -------------- */
  const hero = $('.hero');
  const spirit = $('[data-explode]');
  const dock = $('[data-dock]');
  const book = $('#reserver');
  let ticking = false;

  function frame() {
    ticking = false;
    const vh = window.innerHeight;

    // accueil : 0 en haut, 1 quand il a quitté l'écran
    if (hero && !reduce.matches) {
      const r = hero.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
      hero.style.setProperty('--hp', p.toFixed(3));
    }

    // porte éclatée : les pièces s'écartent quand la section traverse l'écran
    if (spirit && !reduce.matches) {
      const r = spirit.getBoundingClientRect();
      const p = (vh - r.top) / (vh + r.height * 0.4);
      const x = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI);
      spirit.style.setProperty('--x', x.toFixed(3));
    }

    // niveau courant : la dernière section dont le haut a passé le tiers de l'écran
    let id = levels[0] && levels[0].dataset.level;
    levels.forEach(s => { if (s.getBoundingClientRect().top < vh * 0.35) id = s.dataset.level; });
    if (id) setLevel(id);

    // barre de réservation mobile : après l'accueil, masquée sur la section réservation
    if (dock && hero && book) {
      const past = hero.getBoundingClientRect().bottom < 0;
      const br = book.getBoundingClientRect();
      const onBook = br.top < vh && br.bottom > 0;
      dock.classList.toggle('is-on', past && !onBook);
    }
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  frame();

  /* ---- 6. Menu mobile -------------------------------------------------------- */
  const menuBtn = $('[data-menu]');
  const nav = $('#nav');
  if (menuBtn && nav) {
    const close = (focusBtn) => {
      menuBtn.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
      if (focusBtn) menuBtn.focus();
    };
    menuBtn.addEventListener('click', () => {
      const open = menuBtn.getAttribute('aria-expanded') !== 'true';
      menuBtn.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      if (open) requestAnimationFrame(() => $('a', nav).focus());
    });
    nav.addEventListener('click', e => { if (e.target.closest('a')) close(false); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) close(true);
    });
  }
})();
