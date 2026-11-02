/* Spyrall — interactions du site
   Défilement fluide, apparitions, effets liés au défilement (--p, --py, --s), film de l’accueil,
   sous-menu « Nos solutions » et menu mobile.
   Sans JavaScript, tout le contenu reste visible et utilisable. */
(() => {
  'use strict';

  window.__spyrall = true;
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = $('[data-header]');
  // ?capture : état final sans transition (captures d'écran de contrôle)
  if (/[?&]capture\b/.test(location.search)) root.classList.add('capture');

  /* Défilement fluide */
  let lenis = null;
  if (!reduceMotion && typeof window.Lenis === 'function') {
    lenis = new window.Lenis({ duration: 1.2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  /* Menu mobile */
  const burger = $('[data-burger]');
  const menu = $('[data-menu]');
  function setMenu(open) {
    if (!menu || !burger || open === root.classList.contains('menu-open')) return;
    root.classList.toggle('menu-open', open);
    menu.classList.toggle('is-open', open);
    menu.toggleAttribute('inert', !open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    if (lenis) open ? lenis.stop() : lenis.start();
    else document.body.style.overflow = open ? 'hidden' : '';
  }
  burger?.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* Sous-menu « Nos solutions » : survol sur ordinateur, clic partout */
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  $$('[data-sub]').forEach((item) => {
    const button = $('button', item);
    let timer;
    const set = (open) => {
      clearTimeout(timer);
      item.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
    };
    button.addEventListener('click', () => set(!item.classList.contains('is-open')));
    if (canHover) {
      item.addEventListener('pointerenter', () => { clearTimeout(timer); timer = setTimeout(() => set(true), 60); });
      item.addEventListener('pointerleave', () => { clearTimeout(timer); timer = setTimeout(() => set(false), 180); });
    }
    item.addEventListener('focusout', (e) => { if (!item.contains(e.relatedTarget)) set(false); });
    document.addEventListener('click', (e) => { if (!item.contains(e.target)) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && item.classList.contains('is-open')) { set(false); button.focus(); } });
  });

  /* Ancres dans la page */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    const target = link && document.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    setMenu(false);
    const offset = (header ? header.offsetHeight : 0) + 12;
    if (lenis) lenis.scrollTo(target, { offset: -offset, duration: 1.4 });
    else scrollTo({ top: target.getBoundingClientRect().top + scrollY - offset, behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* Texte découpé en mots (lecture progressive) */
  $$('[data-words]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', words.join(' '));
    el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true" style="--i:${i}">${w}</span>`).join(' ');
    el.style.setProperty('--n', words.length);
    el.classList.add('words');
  });

  /* Lignes de titre : index pour le décalage */
  $$('.lines').forEach((el) => $$('.line > span', el).forEach((s, i) => s.style.setProperty('--i', i)));

  /* Décalage en cascade des enfants */
  $$('[data-stagger]').forEach((group) => {
    const step = parseFloat(group.dataset.stagger) || 90;
    $$('[data-reveal]', group).forEach((el, i) => { if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', `${(i * step) / 1000}s`); });
  });

  /* Apparitions */
  const targets = $$('[data-reveal], .lines, .map');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    }), { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    targets.forEach((el) => io.observe(el));
  } else targets.forEach((el) => el.classList.add('is-in'));

  /* Film des pauses (accueil) : il ne tourne que visible, et ne démarre pas si moins d'animations sont
     demandées (l'image d'attente reste affichée). */
  $$('[data-film]').forEach((hero) => {
    const video = $('video', hero);
    let inView = true;
    const sync = () => {
      const play = inView && !document.hidden && !reduceMotion;
      if (play && video.paused) video.play().catch(() => {});
      else if (!play && !video.paused) video.pause();
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(hero);
    }
    document.addEventListener('visibilitychange', sync);
    // Le format (paysage ou portrait) n'est choisi qu'au chargement : s'il change (écran pivoté, fenêtre
    // redimensionnée), on recharge la bonne version du film, au même instant.
    matchMedia('(orientation: portrait)').addEventListener('change', () => {
      const t = video.currentTime;
      video.addEventListener('loadedmetadata', () => { video.currentTime = t; sync(); }, { once: true });
      video.load();
    });
    sync();
  });

  /* Carte vivante (zone d'intervention) : ses animations en boucle s'arrêtent quand elle n'est pas à l'écran */
  if ('IntersectionObserver' in window) {
    $$('[data-map-live]').forEach((map) => {
      let inView = false;
      const sync = () => map.classList.toggle('is-paused', !inView || document.hidden);
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }).observe(map);
      document.addEventListener('visibilitychange', sync);
    });
  }

  /* Machines des pages solutions : la machine sert tour à tour chaque produit de la liste (boisson qui coule,
     produit qui tombe, machine qui prend le relais…), seulement à l'écran, et pas du tout si moins d'animations
     sont demandées. Les data-* de chaque produit deviennent des variables CSS de la machine, sauf data-item (la
     forme du produit, ou la machine montrée), recopié tel quel, et data-wait, data-done, data-ready, qui
     remplacent pour ce produit ceux de la machine : le texte d'état et le moment où il change (ms). data-cycle
     donne le rythme de la ronde. */
  const ownKeys = ['item', 'wait', 'done', 'ready'];
  $$('[data-machine]').forEach((machine) => {
    const section = machine.closest('section');
    const list = $('[data-choices]', section);
    const items = $$('li', list);
    const status = $('[data-machine-status]', section);
    const animate = !reduceMotion && 'IntersectionObserver' in window;
    const cycle = +machine.dataset.cycle || 5000;
    const say = (key, li) => (li.dataset[key] || machine.dataset[key]).replace('{nom}', li.textContent);
    let index = Math.max(0, items.findIndex((li) => li.classList.contains('is-active')));
    let timer = 0, ready = 0, last = 0, inView = false;
    const show = (li) => {
      items.forEach((d) => d.classList.toggle('is-active', d === li));
      Object.entries(li.dataset).forEach(([key, value]) => {
        if (key === 'item') machine.dataset.item = value;
        else if (!ownKeys.includes(key)) machine.style.setProperty(`--${key}`, value);
      });
    };
    const serve = () => {
      last = Date.now();
      const li = items[index];
      show(li);
      status.textContent = say('wait', li);
      clearTimeout(ready);
      ready = setTimeout(() => { status.textContent = say('done', li); }, +(li.dataset.ready || machine.dataset.ready) || 2700);
      machine.classList.remove('is-serving');
      void machine.offsetWidth; // relance les animations
      machine.classList.add('is-serving');
      index = (index + 1) % items.length;
    };
    const loop = () => { serve(); timer = setTimeout(loop, cycle); };
    const sync = () => {
      if (inView && !document.hidden) {
        // au retour à l'écran, le produit en cours se termine avant de passer au suivant
        if (!timer) timer = setTimeout(loop, Math.max(0, cycle - (Date.now() - last)));
      } else { clearTimeout(timer); timer = 0; }
    };
    if (animate) {
      new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync(); }, { threshold: 0.35 }).observe(machine);
      document.addEventListener('visibilitychange', sync);
    }

    /* Liste « à choisir » (data-pick) : chaque produit devient un bouton. Un clic et la machine le sert tout de
       suite (on la ramène d'abord à l'écran si besoin), puis elle reprend sa ronde au rythme habituel. Sans
       animation, le clic montre simplement le produit, ou la machine, choisi. */
    if (!('pick' in list.dataset)) return;
    list.classList.add('is-pickable');
    $('[data-pick-hint]', section)?.removeAttribute('hidden');
    items.forEach((li, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choices__pick';
      button.append(...li.childNodes);
      li.append(button);
      button.addEventListener('click', () => {
        if (!animate) { show(li); status.textContent = say('done', li); return; }
        clearTimeout(timer);
        index = i;
        const go = () => { serve(); timer = setTimeout(loop, cycle); };
        if (inView) go();
        else {
          machine.scrollIntoView({ behavior: 'smooth', block: 'center' });
          timer = setTimeout(go, 500);
        }
      });
    });
  });

  /* Points forts en chiffres : à l'arrivée de la section, les chiffres comptent depuis 0 (l'un après l'autre)
     et les illustrations s'animent (tasse, étagère, thermomètre, grains, latte : CSS, classe is-playing). Une seule fois ;
     rien ne bouge si moins d'animations. */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    $$('[data-stats]').forEach((stats) => {
      const counters = $$('[data-count]', stats);
      counters.forEach((c) => { c.textContent = '0'; });
      const io = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        stats.classList.add('is-playing');
        const start = performance.now();
        const tick = (now) => {
          let running = false;
          counters.forEach((c, i) => {
            const p = clamp((now - start - i * 300) / 1600);
            c.textContent = Math.round(+c.dataset.count * (1 - Math.pow(1 - p, 3)));
            running ||= p < 1;
          });
          if (running) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, { threshold: 0.4 });
      io.observe(stats);
    });
  }

  /* « Voir plus » : déplie (ou replie) la liste complète, qui n'est accessible au clavier qu'une fois ouverte */
  $$('[data-more]').forEach((button) => {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    const label = $('span', button);
    const set = (open) => {
      button.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('is-open', open);
      panel.toggleAttribute('inert', !open);
      label.textContent = open ? 'Voir moins' : 'Voir plus';
    };
    set(false);
    button.addEventListener('click', () => set(button.getAttribute('aria-expanded') !== 'true'));
  });

  /* Effets liés au défilement : --p (progression), --py (parallaxe), --s (cartes empilées) */
  const progress = $$('[data-progress]');
  const parallax = $$('[data-parallax]');
  const stack = $$('[data-stack] > *');
  const modes = {
    exit: (r, vh, k) => -r.top / (r.height * k),
    enter: (r, vh) => (vh - r.top) / (vh * 0.7),
    read: (r, vh) => (vh * 0.82 - r.top) / (r.height + vh * 0.25),
  };

  function update() {
    const vh = innerHeight;
    if (reduceMotion) return;
    progress.forEach((el) => {
      const fn = modes[el.dataset.progress] || modes.read;
      el.style.setProperty('--p', clamp(fn(el.getBoundingClientRect(), vh, parseFloat(el.dataset.span) || 1)).toFixed(4));
    });
    parallax.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      // Une image plus grande que son cadre ne se déplace que de sa marge, sans laisser de vide.
      const room = (el.offsetHeight - el.parentElement.offsetHeight) / 2;
      const py = -(r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
      el.style.setProperty('--py', `${(room > 0 ? clamp(py, -room, room) : py).toFixed(1)}px`);
    });
    stack.forEach((card, i) => {
      const next = stack[i + 1];
      if (!next) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--s', clamp((r.bottom - next.getBoundingClientRect().top) / r.height).toFixed(4));
    });
  }
  if (reduceMotion) progress.forEach((el) => el.style.setProperty('--p', 1));
  if (lenis) lenis.on('scroll', update);
  else addEventListener('scroll', () => requestAnimationFrame(update), { passive: true });
  addEventListener('resize', update);
  update();
})();
