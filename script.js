(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const supportsIO = 'IntersectionObserver' in window;

  /* ------------------------------------------------------------------------
     Entrance animation
     ------------------------------------------------------------------------ */
  const header = document.querySelector('.header');

  const reveal = () => requestAnimationFrame(() => {
    document.documentElement.classList.add('is-loaded');
    // Hand the header back its own (background) transitions once it has slid in
    setTimeout(() => header.classList.add('is-done'), 1000);
  });

  if (document.fonts && document.fonts.ready) {
    // Wait for fonts so the title doesn't reflow mid-animation, but never longer than 600ms
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 600))]).then(reveal);
  } else {
    reveal();
  }

  /* ------------------------------------------------------------------------
     Scroll reveal
     ------------------------------------------------------------------------ */
  const srItems = document.querySelectorAll('.sr');

  const markIn = (el) => {
    el.classList.add('is-in');
    // Drop the stagger delay afterwards so hover effects respond instantly
    const d = parseFloat(getComputedStyle(el).getPropertyValue('--d')) || 0;
    setTimeout(() => el.classList.add('is-done'), 900 + d * 120);
  };

  if (supportsIO) {
    const srObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        markIn(entry.target);
        srObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    srItems.forEach((el) => srObserver.observe(el));
  } else {
    srItems.forEach(markIn);
  }

  /* ------------------------------------------------------------------------
     Header: scrolled state
     ------------------------------------------------------------------------ */
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ------------------------------------------------------------------------
     Navigation: mobile menu, sliding indicator, scroll spy
     ------------------------------------------------------------------------ */
  const nav = document.getElementById('nav');
  const navList = nav.querySelector('.nav__list');
  const navLinks = [...nav.querySelectorAll('.nav__link')];
  const burger = document.querySelector('.burger');

  const setMenu = (open) => {
    header.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  };

  burger.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', (e) => {
    if (header.classList.contains('is-open') && !header.contains(e.target)) setMenu(false);
  });
  navLinks.forEach((link) => link.addEventListener('click', () => setMenu(false)));

  const indicator = document.createElement('li');
  indicator.className = 'nav__indicator';
  indicator.setAttribute('aria-hidden', 'true');
  navList.prepend(indicator);
  nav.classList.add('has-indicator');

  let activeKey = 'course';

  const moveIndicator = (instant) => {
    const link = navLinks.find((l) => l.dataset.nav === activeKey);
    if (!link) return;
    if (instant) indicator.style.transition = 'none';
    indicator.style.width = `${link.offsetWidth}px`;
    indicator.style.transform = `translateX(${link.offsetLeft}px)`;
    if (instant) {
      indicator.getBoundingClientRect(); // flush
      indicator.style.transition = '';
    }
  };

  const setActive = (key) => {
    if (!key || key === activeKey) return;
    activeKey = key;
    navLinks.forEach((l) => {
      const on = l.dataset.nav === key;
      l.classList.toggle('is-active', on);
      if (on) l.setAttribute('aria-current', 'true');
      else l.removeAttribute('aria-current');
    });
    moveIndicator(false);
  };

  moveIndicator(true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveIndicator(true));
  window.addEventListener('resize', () => moveIndicator(true));

  if (supportsIO) {
    // A thin band across the middle of the viewport decides which section is "current"
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target.dataset.navSection);
      });
    }, { rootMargin: '-45% 0px -54% 0px' });
    document.querySelectorAll('[data-nav-section]').forEach((s) => spy.observe(s));
  }

  /* ------------------------------------------------------------------------
     Stats: count up
     ------------------------------------------------------------------------ */
  const counters = document.querySelectorAll('[data-count]');

  const runCounter = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const suffix = el.dataset.suffix || '';
    const format = (v) => v.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;

    if (reducedMotion.matches) { el.textContent = format(target); return; }

    const duration = 1600;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(target * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if (supportsIO) {
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => {
      const d = parseInt(el.dataset.decimals || '0', 10);
      el.textContent = (0).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }) + (el.dataset.suffix || '');
      countObserver.observe(el);
    });
  }

  /* ------------------------------------------------------------------------
     Geology: strata accordion (one layer open at a time)
     ------------------------------------------------------------------------ */
  const strata = [...document.querySelectorAll('.stratum')];

  strata.forEach((layer) => {
    layer.querySelector('.stratum__head').addEventListener('click', () => {
      const willOpen = !layer.classList.contains('is-open');
      strata.forEach((other) => {
        const open = other === layer && willOpen;
        other.classList.toggle('is-open', open);
        other.querySelector('.stratum__head').setAttribute('aria-expanded', String(open));
      });
    });
  });

  /* ------------------------------------------------------------------------
     Plans: billing toggle
     ------------------------------------------------------------------------ */
  const billingBtns = [...document.querySelectorAll('[data-billing]')];
  const amounts = document.querySelectorAll('.plan__amount[data-monthly]');

  billingBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.billing;
      billingBtns.forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      amounts.forEach((el) => {
        const next = `${Number(el.dataset[mode]).toLocaleString('ru-RU')} ₽`;
        if (el.textContent === next) return;
        el.classList.add('is-swapping');
        setTimeout(() => {
          el.textContent = next;
          el.classList.remove('is-swapping');
        }, reducedMotion.matches ? 0 : 220);
      });
    });
  });

  /* ------------------------------------------------------------------------
     Live tour: play the background video only while it's on screen
     ------------------------------------------------------------------------ */
  const tourVideo = document.getElementById('tourVideo');

  if (tourVideo && supportsIO) {
    const tourObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !reducedMotion.matches) {
        const p = tourVideo.play();
        if (p && p.catch) p.catch(() => {});
      } else {
        tourVideo.pause();
      }
    }, { threshold: 0.15 });
    tourObserver.observe(tourVideo);
  }

  /* ------------------------------------------------------------------------
     Newsletter
     ------------------------------------------------------------------------ */
  const form = document.getElementById('newsletter');

  if (form) {
    const input = form.querySelector('input');
    const msg = form.querySelector('.newsletter__msg');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!input.checkValidity()) {
        msg.textContent = 'Кажется, в адресе опечатка. Проверьте, пожалуйста.';
        input.focus();
        return;
      }
      msg.textContent = 'Спасибо! Первое письмо придёт в воскресенье.';
      form.reset();
    });
  }

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  // Group dates are relative to today so the schedule never shows past meetings
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  document.querySelectorAll('[data-in-days]').forEach((el) => {
    const d = new Date();
    d.setDate(d.getDate() + Number(el.dataset.inDays));
    el.textContent = `${d.getDate()} ${months[d.getMonth()]}`;
  });

  /* ------------------------------------------------------------------------
     Charge gauge: the page "recovers" as you scroll. Each section is a stage
     (data-era / data-from / data-to, in percent of charge); the gauge shows
     the current stage and the page colour slowly comes back to life (--depth).
     ------------------------------------------------------------------------ */
  const gauge = document.querySelector('.depth');
  const eraSections = [...document.querySelectorAll('[data-era]')];

  if (gauge && eraSections.length) {
    const track = gauge.querySelector('.depth__track');
    const eraEl = gauge.querySelector('.depth__era');
    const ageEl = gauge.querySelector('.depth__age');
    const root = document.documentElement;
    let layers = [];
    let docH = 1;
    let idleTimer = 0;
    let ticking = false;

    // Ticks at section boundaries double as a quick way to jump between periods
    const ticks = eraSections.map((section) => {
      const tick = document.createElement('button');
      tick.type = 'button';
      tick.className = 'depth__tick';
      tick.setAttribute('aria-label', `${section.dataset.era}: ${section.dataset.label}`);
      tick.innerHTML = `<span class="depth__tick-label"><i>${section.dataset.era}</i> · ${section.dataset.label}</span>`;
      tick.addEventListener('click', () => section.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' }));
      track.appendChild(tick);
      return tick;
    });

    const measure = () => {
      docH = root.scrollHeight;
      layers = eraSections.map((section, i) => {
        const top = section.getBoundingClientRect().top + window.scrollY;
        ticks[i].style.top = `${(top / docH) * 100}%`;
        return {
          top,
          height: section.offsetHeight,
          era: section.dataset.era,
          from: parseFloat(section.dataset.from),
          to: parseFloat(section.dataset.to),
        };
      });
    };

    const update = (show) => {
      ticking = false;
      const maxScroll = Math.max(docH - window.innerHeight, 1);
      const progress = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
      // The probe slides from the very top of the page to the very bottom of the footer
      const probe = window.scrollY + window.innerHeight * progress;

      let layer = layers[0];
      for (const l of layers) if (probe >= l.top) layer = l;

      const t = Math.min(Math.max((probe - layer.top) / Math.max(layer.height, 1), 0), 1);
      const charge = layer.from + (layer.to - layer.from) * t;

      const p = Math.min(probe / docH, 1);
      gauge.style.setProperty('--p', p.toFixed(4));
      root.style.setProperty('--depth', p.toFixed(3));
      if (eraEl.textContent !== layer.era) eraEl.textContent = layer.era;
      ageEl.textContent = `заряд ${Math.round(charge)}%`;

      // At the very bottom the readout would sit on top of the footer links
      if (!show || progress > 0.97) {
        clearTimeout(idleTimer);
        gauge.classList.remove('is-moving');
        return;
      }
      gauge.classList.add('is-moving');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => gauge.classList.remove('is-moving'), 1200);
    };

    const requestUpdate = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => update(true)); }
    };

    measure();
    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', () => { measure(); update(false); });
    window.addEventListener('load', () => { measure(); update(false); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  }

  /* ------------------------------------------------------------------------
     Rock "flashlight" reveal
     ------------------------------------------------------------------------ */
  const rock = document.getElementById('rock');
  const video = document.getElementById('rockVideo');
  if (!rock || !video) return;

  const HOVER_RADIUS = 260;
  const POS_EASE = 0.12;   // cursor follow
  const RADIUS_EASE = 0.1; // grow / shrink
  const EPS = 0.3;

  const state = {
    x: 0, y: 0,            // current (smoothed) mask centre, px relative to .rock
    tx: 0, ty: 0,          // target mask centre
    r: 0, tr: 0,           // current / target radius
    clientX: 0, clientY: 0,
    hasPointer: false,
    touchOpen: false,
    rafId: 0,
  };

  // Warm up the video: force buffering and decode the first frame so the first hover is instant
  video.load();
  const warmUp = () => {
    const p = video.play();
    if (p && p.then) p.then(() => { if (state.tr === 0) video.pause(); }).catch(() => {});
  };
  if (video.readyState >= 2) warmUp();
  else video.addEventListener('loadeddata', warmUp, { once: true });

  const playVideo = () => {
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  };

  // The rock floats, so re-read its box every frame from the last known pointer position
  const updateTargetFromPointer = () => {
    if (!state.hasPointer) return;
    const rect = rock.getBoundingClientRect();
    state.tx = state.clientX - rect.left;
    state.ty = state.clientY - rect.top;
  };

  const render = () => {
    rock.style.setProperty('--x', `${state.x.toFixed(2)}px`);
    rock.style.setProperty('--y', `${state.y.toFixed(2)}px`);
    rock.style.setProperty('--r', `${state.r.toFixed(2)}px`);
    // Firefly is only visible in hover mode, fades with the radius
    const glow = canHover.matches ? Math.min(state.r / HOVER_RADIUS, 1) : 0;
    rock.style.setProperty('--glow', glow.toFixed(3));
    rock.classList.toggle('is-active', state.r > EPS);
  };

  const tick = () => {
    state.rafId = 0;
    updateTargetFromPointer();

    if (reducedMotion.matches) {
      state.x = state.tx;
      state.y = state.ty;
      state.r = state.tr;
    } else {
      state.x += (state.tx - state.x) * POS_EASE;
      state.y += (state.ty - state.y) * POS_EASE;
      state.r += (state.tr - state.r) * RADIUS_EASE;
    }

    const settled =
      Math.abs(state.tx - state.x) < EPS &&
      Math.abs(state.ty - state.y) < EPS &&
      Math.abs(state.tr - state.r) < EPS;

    if (settled) {
      state.x = state.tx;
      state.y = state.ty;
      state.r = state.tr;
    }

    render();

    if (state.r === 0 && state.tr === 0) {
      video.pause();
      return;
    }

    // Keep running while hovering (the rock floats under a static cursor) or while easing
    if (!settled || state.hasPointer) schedule();
  };

  const schedule = () => {
    if (!state.rafId) state.rafId = requestAnimationFrame(tick);
  };

  /* Desktop: mouse hover ------------------------------------------------- */
  rock.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse' || !canHover.matches) return;
    state.hasPointer = true;
    state.clientX = e.clientX;
    state.clientY = e.clientY;
    updateTargetFromPointer();
    // Start the circle right under the cursor instead of sliding in from elsewhere
    if (state.r < EPS) { state.x = state.tx; state.y = state.ty; }
    state.tr = HOVER_RADIUS;
    playVideo();
    schedule();
  });

  rock.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !canHover.matches) return;
    state.hasPointer = true;
    state.clientX = e.clientX;
    state.clientY = e.clientY;
    if (state.tr === 0) { state.tr = HOVER_RADIUS; playVideo(); }
    schedule();
  });

  rock.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    state.hasPointer = false;
    state.tr = 0;
    schedule();
  });

  /* Touch: tap toggles full reveal --------------------------------------- */
  rock.addEventListener('click', (e) => {
    if (canHover.matches) return;
    const rect = rock.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    state.touchOpen = !state.touchOpen;

    if (state.touchOpen) {
      // Centre at the tap point; radius reaches the farthest corner, past the gradient falloff
      state.x = state.tx = px;
      state.y = state.ty = py;
      const far = Math.hypot(Math.max(px, rect.width - px), Math.max(py, rect.height - py));
      state.tr = far / 0.4;
      playVideo();
    } else {
      state.tr = 0;
    }
    schedule();
  });

  // Pause when the tab is hidden, resume if the reveal is still on
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) video.pause();
    else if (state.r > EPS) playVideo();
  });
})();
