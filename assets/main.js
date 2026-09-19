/* 张林晖 · 个人主页 — 交互
   1. Liquid Glass 边缘折射（Chromium：SVG 位移贴图作为 backdrop-filter）
   2. 指针高光 + 边缘镜面随指针转动
   3. 滚过大标题后浮现紧凑顶栏
   4. 复制邮箱
   5. 滚动进入
   6. 浅色 / 深色切换
   7. 活的壁纸：漂浮色球 + 随机心跳的心电图 */
(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  const mq = (q) => window.matchMedia(q);
  const reduceMotion = mq('(prefers-reduced-motion: reduce)');
  const reduceTransparency = mq('(prefers-reduced-transparency: reduce)');
  const finePointer = mq('(hover: hover) and (pointer: fine)');

  /* ---------- 1. Lensing ---------- */
  const isChromium =
    (navigator.userAgentData?.brands || []).some((b) => b.brand === 'Chromium') ||
    /\bChrom(e|ium)\/\d+/.test(navigator.userAgent);

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const defs = document.getElementById('lens-defs');
  const lensEls = [...document.querySelectorAll('[data-lens]')];

  const smoothstep = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  // 圆角矩形的有向距离场 →
  //   map：边缘一圈朝内采样的位移贴图（R=x, G=y, 128 为不动）
  //   rim：唇边遮罩（alpha），唇边保持清透，中心磨砂
  function buildMaps(w, h, r, bezel) {
    const make = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      return { c, ctx, img: ctx.createImageData(w, h) };
    };
    const M = make();
    const R = make();
    const px = M.img.data;
    const rim = R.img.data;
    const hw = w / 2;
    const hh = h / 2;

    for (let y = 0; y < h; y++) {
      const dy = y + 0.5 - hh;
      const ay = Math.abs(dy);
      const qy = ay - (hh - r);
      for (let x = 0; x < w; x++) {
        const dx = x + 0.5 - hw;
        const ax = Math.abs(dx);
        const qx = ax - (hw - r);

        let dist, nx, ny;
        if (qx > 0 && qy > 0) {
          const len = Math.hypot(qx, qy) || 1;
          dist = r - len;
          nx = qx / len;
          ny = qy / len;
        } else if (qx > qy) {
          dist = r - qx; nx = 1; ny = 0;
        } else {
          dist = r - qy; nx = 0; ny = 1;
        }
        if (dx < 0) nx = -nx;
        if (dy < 0) ny = -ny;

        // 凸透镜唇边：越靠边折射越强，向内平滑衰减
        const t = dist > 0 ? Math.max(0, 1 - dist / bezel) : 0;
        const m = t * t * (1.4 - 0.4 * t);
        const i = (y * w + x) * 4;
        px[i] = 128 - nx * m * 127;
        px[i + 1] = 128 - ny * m * 127;
        px[i + 2] = 128;
        px[i + 3] = 255;
        rim[i] = rim[i + 1] = rim[i + 2] = 255;
        rim[i + 3] = 255 * smoothstep(0.15, 0.7, t);
      }
    }
    M.ctx.putImageData(M.img, 0, 0);
    R.ctx.putImageData(R.img, 0, 0);
    return { map: M.c.toDataURL('image/png'), rim: R.c.toDataURL('image/png') };
  }

  function svg(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }

  function renderLens(el, index) {
    const w = Math.round(el.offsetWidth);
    const h = Math.round(el.offsetHeight);
    if (!w || !h) return;
    const key = `${w}x${h}`;
    if (el.dataset.lensKey === key) return;
    el.dataset.lensKey = key;

    const cs = getComputedStyle(el);
    const r = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, w / 2, h / 2);
    const big = Math.min(w, h) > 120;
    const bezel = Math.min(big ? 34 : 14, r || 14);
    const scale = big ? 84 : 26;
    const frost = parseFloat(cs.getPropertyValue('--frost')) || (big ? 10 : 8);
    const id = `lens-${index}`;
    const maps = buildMaps(w, h, r, bezel);

    defs.querySelector(`#${id}`)?.remove();
    const f = svg('filter', {
      id,
      x: 0, y: 0, width: w, height: h,
      filterUnits: 'userSpaceOnUse',
      primitiveUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB',
    }, defs);
    const img = { x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none' };
    const disp = { in2: 'map', scale, xChannelSelector: 'R', yChannelSelector: 'G' };
    // 小控件（顶栏）：整体磨砂 + 边缘折射，保证上面的文字可读
    svg('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: frost, edgeMode: 'duplicate', result: 'frost' }, f);
    svg('feImage', { ...img, href: maps.map, result: 'map' }, f);
    svg('feDisplacementMap', { ...disp, in: 'frost', result: 'glass' }, f);
    if (big) {
      // 大面板：中心磨砂，唇边清透、只折射（像厚玻璃的边）
      svg('feImage', { ...img, href: maps.rim, result: 'rim' }, f);
      svg('feDisplacementMap', { ...disp, in: 'SourceGraphic', result: 'clearLens' }, f);
      svg('feComposite', { in: 'clearLens', in2: 'rim', operator: 'in', result: 'lip' }, f);
      svg('feComposite', { in: 'lip', in2: 'glass', operator: 'over', result: 'glass' }, f);
    }
    svg('feColorMatrix', { in: 'glass', type: 'saturate', values: 1.6 }, f);

    el.style.setProperty('--lens', `url(#${id})`);
    el.classList.add('has-lens');
  }

  if (isChromium && defs && !reduceTransparency.matches) {
    root.classList.add('lg-lens');
    let pending = null;
    const ro = new ResizeObserver((entries) => {
      pending ??= new Set();
      entries.forEach((e) => pending.add(e.target));
      clearTimeout(ro.t);
      ro.t = setTimeout(() => {
        pending.forEach((el) => renderLens(el, lensEls.indexOf(el)));
        pending = null;
      }, 120);
    });
    lensEls.forEach((el, i) => {
      renderLens(el, i);
      ro.observe(el);
    });
  }

  /* ---------- 2. Pointer light ---------- */
  const glassEls = document.querySelectorAll('[data-glass]');
  const REST_ANGLE = 135;

  glassEls.forEach((el) => {
    let angle = REST_ANGLE;
    let target = REST_ANGLE;
    let raf = 0;

    const tick = () => {
      // 最短路径插值，避免 359° → 1° 绕一圈
      const delta = ((target - angle + 540) % 360) - 180;
      angle += delta * 0.14;
      el.style.setProperty('--rim-angle', `${angle.toFixed(1)}deg`);
      raf = Math.abs(delta) > 0.3 ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

    const track = (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
      if (!reduceMotion.matches) {
        // 高光落在靠近指针的一侧：渐变方向 = 从指针指向中心
        const vx = r.width / 2 - x;
        const vy = r.height / 2 - y;
        target = (Math.atan2(vx, -vy) * 180) / Math.PI;
        kick();
      }
    };

    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' && !finePointer.matches) return;
      track(e);
      el.classList.add('is-lit');
    });
    el.addEventListener('pointermove', track, { passive: true });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-lit');
      target = REST_ANGLE;
      kick();
    });
    // 触屏：从指尖处亮起，松开后熄灭
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      track(e);
      el.classList.add('is-lit');
    });
    const release = (e) => {
      if (e.pointerType === 'mouse') return;
      setTimeout(() => el.classList.remove('is-lit'), 260);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  });

  /* ---------- 3. Compact top bar ---------- */
  const topbar = document.querySelector('.topbar');
  const title = document.getElementById('name');
  if (topbar && title && 'IntersectionObserver' in window) {
    // 大标题开始滑入顶栏区域（上沿越过 72px）时浮现
    new IntersectionObserver(([entry]) => {
      const under = entry.intersectionRatio < 1 && entry.boundingClientRect.top < 72;
      topbar.classList.toggle('is-visible', under);
    }, { rootMargin: '-72px 0px 0px 0px', threshold: [0, 1] }).observe(title);
  }

  /* ---------- 4. Copy email ---------- */
  const live = document.getElementById('live');

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }

  document.querySelectorAll('[data-copy]').forEach((btn) => {
    let timer = 0;
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      let ok = false;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        ok = fallbackCopy(text);
      }
      if (live) live.textContent = ok ? '邮箱地址已复制' : '复制失败，请手动选择邮箱地址';
      if (!ok) return;
      btn.classList.add('is-copied');
      clearTimeout(timer);
      timer = setTimeout(() => btn.classList.remove('is-copied'), 1800);
    });
  });

  /* ---------- 5. Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        io.unobserve(el);
        el.classList.add('is-in');
        // 进入动画结束后交还给元素自己的 hover / active 过渡
        setTimeout(() => {
          el.removeAttribute('data-reveal');
          el.style.transitionDelay = '';
        }, 1100);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    revealEls.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i, 4) * 60}ms`;
      io.observe(el);
    });
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- 6. Theme ---------- */
  const toggle = document.querySelector('.theme-toggle');
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const systemDark = mq('(prefers-color-scheme: dark)');
  const storage = {
    get() { try { return localStorage.getItem('theme'); } catch { return null; } },
    set(v) { try { v ? localStorage.setItem('theme', v) : localStorage.removeItem('theme'); } catch {} },
  };

  function applyTheme(theme) {
    root.dataset.theme = theme;
    metaTheme?.setAttribute('content', theme === 'dark' ? '#0a0c13' : '#eef1f8');
    const label = `切换到${theme === 'dark' ? '浅色' : '深色'}模式`;
    toggle?.setAttribute('aria-label', label);
    if (toggle) toggle.title = label;
    document.dispatchEvent(new CustomEvent('themechange'));
  }
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');

  // 没有手动选过时，跟随系统实时变化
  systemDark.addEventListener('change', (e) => {
    if (!storage.get()) applyTheme(e.matches ? 'dark' : 'light');
  });

  toggle?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    // 切回与系统一致的主题 = 恢复"跟随系统"
    storage.set(next === (systemDark.matches ? 'dark' : 'light') ? null : next);

    if (!document.startViewTransition || reduceMotion.matches) {
      applyTheme(next);
      return;
    }
    const r = toggle.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const vt = document.startViewTransition(() => applyTheme(next));
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 720, easing: 'cubic-bezier(.22, .8, .24, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
  });

  /* ---------- 7. Living wallpaper ---------- */
  // 7a. 色球：两组不可公约的正弦叠加 → 不重复的有机漂浮；再叠加指针视差与滚动视差
  const orbs = [...document.querySelectorAll('.orb')].map((el, i) => ({
    el,
    fx1: 0.30 + i * 0.05, fy1: 0.24 + i * 0.06,
    fx2: 0.13 + i * 0.03, fy2: 0.11 + i * 0.035,
    px: Math.random() * Math.PI * 2,
    py: Math.random() * Math.PI * 2,
    depth: [1, 0.75, 0.5, 0.85][i] ?? 0.6,
  }));
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  function updateOrbs(t) {
    const amp = Math.max(innerWidth, innerHeight) * 0.07;
    pointer.sx += (pointer.x - pointer.sx) * 0.04;
    pointer.sy += (pointer.y - pointer.sy) * 0.04;
    const sy = scrollY;
    for (const o of orbs) {
      const dx = amp * (Math.sin(t * o.fx1 + o.px) + 0.55 * Math.sin(t * o.fx2 + o.px * 1.7)) + pointer.sx * 36 * o.depth;
      const dy = amp * (Math.sin(t * o.fy1 + o.py) + 0.55 * Math.sin(t * o.fy2 + o.py * 1.3)) + pointer.sy * 28 * o.depth - sy * 0.12 * o.depth;
      const sc = 1 + 0.07 * Math.sin(t * 0.21 + o.px);
      o.el.style.transform = `translate(-50%, -50%) translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sc.toFixed(3)})`;
    }
  }

  // 7b. 心电图：监护仪式扫描，心率在 56–96 次/分之间随机游走，逐搏间期与波幅都有随机抖动
  function createECG(wrap) {
    const canvas = wrap?.querySelector('.ecg-live');
    const ctx = canvas?.getContext('2d');
    if (!ctx) return null;

    const SPEED = 190; // px/s，约合 25 mm/s 走纸（大格 40px = 0.2 s）
    const GAP = 30;    // 扫描头前方擦出的空白
    const AMP = 40;    // R 波高度
    const FADE = 0.3;  // 最旧一段轨迹的不透明度（荧光余辉）
    let W = 1, H = 1, dpr = 1, ys = new Float32Array(1), head = 0, t = 0;
    let hr = 72, nextBeat = 0.35;
    const beats = [];
    let rgb = [0, 113, 227], alpha = 0.42;

    const g = (x, mu, sd) => Math.exp(-0.5 * ((x - mu) / sd) ** 2);
    // 一次心搏的 P-QRS-T 形态（时间单位：秒）
    const morph = (x) =>
      0.11 * g(x, 0.09, 0.022) - 0.10 * g(x, 0.185, 0.007) + g(x, 0.205, 0.0085)
      - 0.26 * g(x, 0.226, 0.009) + 0.27 * g(x, 0.43, 0.042);

    function schedule() {
      while (nextBeat <= t + 0.05) {
        beats.push({ t0: nextBeat, amp: 0.85 + Math.random() * 0.28 });
        if (beats.length > 4) beats.shift();
        hr = Math.min(96, Math.max(56, hr + (Math.random() - 0.5) * 10));
        nextBeat += (60 / hr) * (1 + (Math.random() - 0.5) * 0.12);
      }
    }
    function sample(time) {
      let v = 0;
      for (const b of beats) {
        const x = time - b.t0;
        if (x > 0 && x < 0.7) v += morph(x) * b.amp;
      }
      return H / 2 - v * AMP;
    }
    function readColor() {
      const probe = document.createElement('canvas').getContext('2d');
      probe.fillStyle = getComputedStyle(root).getPropertyValue('--ecg').trim() || '#0071e3';
      const m = probe.fillStyle.match(/[\d.]+/g);
      if (probe.fillStyle.startsWith('#')) {
        const hex = probe.fillStyle.slice(1);
        rgb = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
        alpha = 1;
      } else if (m) {
        rgb = m.slice(0, 3).map(Number);
        alpha = m[3] !== undefined ? Number(m[3]) : 1;
      }
    }
    function resize() {
      const r = wrap.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ys = new Float32Array(W).fill(NaN);
    }
    function step(dt) {
      const t0 = t;
      const prev = head;
      t += dt;
      head += SPEED * dt;
      schedule();
      for (let k = Math.floor(prev) + 1; k <= Math.floor(head); k++) {
        ys[k % W] = sample(t0 + (k - prev) / SPEED);
        ys[(k + GAP) % W] = NaN;
      }
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgb(${rgb.join(',')})`;
      const h = Math.floor(head);
      const CHUNK = 40;
      // 从最旧画到最新，旧的轨迹逐段变淡
      for (let c0 = W - 1; c0 >= 0; c0 -= CHUNK) {
        ctx.globalAlpha = alpha * (FADE + (1 - FADE) * (1 - c0 / W));
        ctx.beginPath();
        let pen = false;
        for (let age = c0; age >= Math.max(0, c0 - CHUNK); age--) {
          const x = (((h - age) % W) + W) % W;
          const y = ys[x];
          if (Number.isNaN(y)) { pen = false; continue; }
          if (!pen || x === 0) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // 扫描头的光点
      const hx = ((h % W) + W) % W;
      const hy = ys[hx];
      if (!Number.isNaN(hy)) {
        const c = rgb.join(',');
        const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 12);
        glow.addColorStop(0, `rgba(${c},${Math.min(1, alpha * 1.6)})`);
        glow.addColorStop(1, `rgba(${c},0)`);
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.fillRect(hx - 12, hy - 12, 24, 24);
        ctx.fillStyle = `rgb(${c})`;
        ctx.beginPath();
        ctx.arc(hx, hy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    resize();
    readColor();
    new ResizeObserver(resize).observe(wrap);
    document.addEventListener('themechange', readColor);
    return { step, draw };
  }

  const ecgWrap = document.querySelector('.ecg');
  const ecg = createECG(ecgWrap);
  let rafId = 0;
  let last = 0;

  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    updateOrbs(now / 1000);
    if (ecg) { ecg.step(dt); ecg.draw(); }
    rafId = requestAnimationFrame(frame);
  }
  function startLife() {
    if (rafId) return;
    ecgWrap?.classList.toggle('is-live', !!ecg);
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }
  function stopLife() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    ecgWrap?.classList.remove('is-live');
    orbs.forEach((o) => (o.el.style.transform = ''));
  }
  // 系统开启"减少动态效果"时保持静止：静态心电图 + 不动的色球
  if (reduceMotion.matches) stopLife(); else startLife();
  reduceMotion.addEventListener('change', (e) => (e.matches ? stopLife() : startLife()));
})();
