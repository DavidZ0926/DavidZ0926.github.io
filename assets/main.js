/* 张林晖 · 个人主页 — 交互
   1. 指针高光 + 边缘镜面随指针转动
   2. 滚过大标题后浮现紧凑顶栏
   3. 复制邮箱
   4. 滚动进入
   5. 浅色 / 深色切换
   6. 活的壁纸：漂浮色球 + 随机心跳的心电图
   7. Liquid Glass：WebGL 画出玻璃边缘的折射、色散与镜面高光 */
(() => {
  'use strict';

  const root = document.documentElement;
  root.classList.add('js');

  const mq = (q) => window.matchMedia(q);
  const reduceMotion = mq('(prefers-reduced-motion: reduce)');
  const finePointer = mq('(hover: hover) and (pointer: fine)');
  const reduceTransparency = mq('(prefers-reduced-transparency: reduce)');

  /* ---------- 1. Pointer light ---------- */
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

  /* ---------- 2. Compact top bar ---------- */
  const topbar = document.querySelector('.topbar');
  const title = document.getElementById('name');
  if (topbar && title && 'IntersectionObserver' in window) {
    // 大标题开始滑入顶栏区域（上沿越过 72px）时浮现
    new IntersectionObserver(([entry]) => {
      const under = entry.intersectionRatio < 1 && entry.boundingClientRect.top < 72;
      topbar.classList.toggle('is-visible', under);
    }, { rootMargin: '-72px 0px 0px 0px', threshold: [0, 1] }).observe(title);
  }

  /* ---------- 3. Copy email ---------- */
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

  /* ---------- 4. Reveal on scroll ---------- */
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

  /* ---------- 5. Theme ---------- */
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

  /* ---------- 6. Living wallpaper ---------- */
  // 6a. 色球：两组不可公约的正弦叠加 → 不重复的有机漂浮；再叠加指针视差与滚动视差
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

  // 色球的基础位置（CSS 里的 left/top/width，已是像素），尺寸变化时重读
  function measureOrbs() {
    for (const o of orbs) {
      const cs = getComputedStyle(o.el);
      o.bx = parseFloat(cs.left);
      o.by = parseFloat(cs.top);
      o.bw = parseFloat(cs.width);
    }
  }

  function updateOrbs(t) {
    const amp = Math.max(innerWidth, innerHeight) * 0.07;
    pointer.sx += (pointer.x - pointer.sx) * 0.04;
    pointer.sy += (pointer.y - pointer.sy) * 0.04;
    const sy = scrollY;
    for (const o of orbs) {
      const dx = amp * (Math.sin(t * o.fx1 + o.px) + 0.55 * Math.sin(t * o.fx2 + o.px * 1.7)) + pointer.sx * 36 * o.depth;
      const dy = amp * (Math.sin(t * o.fy1 + o.py) + 0.55 * Math.sin(t * o.fy2 + o.py * 1.3)) + pointer.sy * 28 * o.depth - sy * 0.12 * o.depth;
      const sc = 1 + 0.07 * Math.sin(t * 0.21 + o.px);
      // 记下视口坐标里的圆心和半径，玻璃着色器要按同样的位置把色球重画一遍
      o.cx = o.bx + dx;
      o.cy = o.by + dy;
      o.r = (o.bw / 2) * sc;
      o.el.style.transform = `translate(-50%, -50%) translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${sc.toFixed(3)})`;
    }
  }

  // 6b. 心电图：监护仪式扫描，心率在 56–96 次/分之间随机游走，逐搏间期与波幅都有随机抖动
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
    return { step, draw, state: () => ({ ys, W, H, head, rgb, alpha, FADE }) };
  }

  const ecgWrap = document.querySelector('.ecg');
  const ecg = createECG(ecgWrap);

  /* ---------- 7. Liquid Glass（WebGL） ---------- */
  // 玻璃背后只有程序生成的壁纸，所以着色器能直接算出"背后那一点是什么颜色"，再按透镜形状偏移采样：
  // 唇边清晰、被弯折、带色散彩边；中心是解析近似的磨砂。每块玻璃一个画布，随元素滚动，边缘不会错位。
  const GLASS_VS = `#version 300 es
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3. : -1., gl_VertexID == 2 ? 3. : -1.);
  gl_Position = vec4(p, 0., 1.);
}`;

  const GLASS_FS = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uRes, uSize, uOrigin, uView, uLight;
uniform float uDpr, uRadius, uBezel, uRefract, uSpec, uSat;
uniform vec3 uBg;
uniform vec4 uOrb[4];   // xy 圆心，z 半径，w 不透明度
uniform vec3 uOrbC[4];
uniform vec4 uGridA, uGridB, uTint, uEcgC;
uniform highp sampler2D uEcg;
uniform float uEcgW, uEcgH, uEcgTop, uEcgHead, uEcgFade, uEcgOn;

// —— 壁纸（与 CSS / canvas 版同一套几何，按 DOM 绘制顺序：底色 → 网格 → 色球 → 心电线）——
float orbA(float x) {
  return x < .45 ? mix(1., .7, x / .45) : x < .75 ? mix(.7, .22, (x - .45) / .3) : x < 1. ? mix(.22, 0., (x - .75) / .25) : 0.;
}
vec3 orbs(vec3 c, vec2 q) {
  for (int i = 0; i < 4; i++) c = mix(c, uOrbC[i], orbA(length(q - uOrb[i].xy) / uOrb[i].z) * uOrb[i].w);
  return c;
}
float gridMask(vec2 q) {
  return clamp((.9 - length((q - vec2(.5, .42) * uView) / (vec2(.75, .7) * uView))) / .6, 0., 1.);
}
vec2 onLine(vec2 q, float period) {
  return 1. - step(1., mod(q - ((uView - period) * .5 + .5), period));
}
vec3 grid(vec3 c, vec2 q) {
  float m = gridMask(q);
  if (m <= 0.) return c;
  vec2 a = onLine(q, 40.), b = onLine(q, 8.);
  c = mix(c, uGridB.rgb, b.x * uGridB.a * m);
  c = mix(c, uGridB.rgb, b.y * uGridB.a * m);
  c = mix(c, uGridA.rgb, a.x * uGridA.a * m);
  return mix(c, uGridA.rgb, a.y * uGridA.a * m);
}
vec3 gridSoft(vec3 c, vec2 q) {   // 磨砂后网格只剩平均色调
  float m = gridMask(q);
  c = mix(c, uGridB.rgb, .23 * uGridB.a * m);
  return mix(c, uGridA.rgb, .05 * uGridA.a * m);
}
float ecgY(float i) {
  vec4 t = texelFetch(uEcg, ivec2(int(mod(i, uEcgW)), 0), 0);
  return t.g > .5 ? (t.r * 65280. + t.b * 255.) / 65535. * uEcgH : -1.;
}
float segD(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0., 1.));
}
vec4 ecg(vec2 q, bool soft) {
  float ly = q.y - uEcgTop;
  if (uEcgOn < .5 || ly < -16. || ly > uEcgH + 16. || q.x < 0. || q.x >= uEcgW) return vec4(0.);
  float x = floor(q.x), xn = q.x / uEcgW;
  float hm = clamp(min(xn, 1. - xn) / .16, 0., 1.);
  float fade = uEcgFade + (1. - uEcgFade) * (1. - mod(uEcgHead - x, uEcgW) / uEcgW);
  // 到折线的真实距离：清晰版画 1.5px 的线，磨砂版把同一距离做高斯柔化
  float best = 1e9, ya = ecgY(x - 4.);
  for (int k = -4; k < 4; k++) {
    float xa = x + float(k), yb = ecgY(xa + 1.);
    if (ya >= 0. && yb >= 0.) best = min(best, segD(vec2(q.x, ly), vec2(xa, ya), vec2(xa + 1., yb)));
    ya = yb;
  }
  float a = soft ? exp(-best * best / 50.) * .5 : clamp(1.25 - best, 0., 1.);
  a *= uEcgC.a * fade;
  float hx = floor(mod(uEcgHead, uEcgW)), hy = ecgY(hx);
  if (hy >= 0.) {   // 扫描头光点
    float r = length(vec2(q.x - hx, ly - hy));
    float g = min(1., uEcgC.a * 1.6) * clamp(1. - r / 12., 0., 1.);
    if (!soft) g = max(g, clamp(2.3 - r, 0., 1.));
    a = 1. - (1. - a) * (1. - g);
  }
  return vec4(uEcgC.rgb, a * hm);
}
vec3 wall(vec2 q) {
  vec4 e = ecg(q, false);
  return mix(orbs(grid(uBg, q), q), e.rgb, e.a);
}
vec3 frost(vec2 q) {
  vec4 e = ecg(q, true);
  return mix(orbs(gridSoft(uBg, q), q), e.rgb, e.a);
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;   // 玻璃内的 CSS 像素坐标
  vec2 hs = uSize * .5, cp = p - hs;
  vec2 q = abs(cp) - (hs - uRadius);
  float d = -(length(max(q, 0.)) + min(max(q.x, q.y), 0.) - uRadius);   // 到边缘的距离（内部为正）
  float aa = clamp(d * uDpr + .5, 0., 1.);
  if (aa <= 0.) { fragColor = vec4(0.); return; }
  vec2 n = (q.x > 0. && q.y > 0.) ? normalize(q) : (q.x > q.y ? vec2(1., 0.) : vec2(0., 1.));
  n *= vec2(cp.x < 0. ? -1. : 1., cp.y < 0. ? -1. : 1.);

  // 凸透镜唇边：越靠边折射越强，采样点向内偏移
  float t = clamp(1. - d / uBezel, 0., 1.);
  vec2 off = -n * t * t * (1.4 - .4 * t) * uRefract;
  vec2 Q = uOrigin + p;
  vec3 col = frost(Q + off);
  float lip = smoothstep(.15, .7, t);
  if (lip > 0.) {   // 唇边：清晰 + 按通道错开的色散
    vec3 s = vec3(wall(Q + off * 1.1).r, wall(Q + off).g, wall(Q + off * .9).b);
    col = mix(col, s, lip);
  }
  col = mix(vec3(dot(col, vec3(.2126, .7152, .0722))), col, uSat);
  col = mix(col, uTint.rgb, uTint.a);

  // 镜面高光：贴着边缘 1–2px 的细亮线 + 很淡的外晕；朝光一侧最亮，对侧一道弱的透射光
  float dir = pow(max(dot(n, uLight), 0.), 1.5) + .4 * pow(max(dot(n, -uLight), 0.), 1.5);
  col += uSpec * dir * (exp(-d / 1.1) + .18 * exp(-d / 7.));
  fragColor = vec4(min(col, vec3(1.)) * aa, aa);
}`;

  const GLASS_UNIFORMS = ['uRes', 'uSize', 'uOrigin', 'uView', 'uLight', 'uDpr', 'uRadius', 'uBezel', 'uRefract',
    'uSpec', 'uSat', 'uBg', 'uOrb', 'uOrbC', 'uGridA', 'uGridB', 'uTint', 'uEcgC', 'uEcg', 'uEcgW', 'uEcgH',
    'uEcgTop', 'uEcgHead', 'uEcgFade', 'uEcgOn'];

  function createGlass() {
    const probe = document.createElement('canvas').getContext('2d');
    const parseColor = (str) => {
      probe.fillStyle = '#000';
      probe.fillStyle = (str || '').trim() || '#000';
      const v = probe.fillStyle;
      if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).concat(1);
      const m = v.match(/[\d.]+/g).map(Number);
      return [m[0] / 255, m[1] / 255, m[2] / 255, m[3] ?? 1];
    };

    function link(gl) {
      const shader = (type, src) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src.replace(/\/\/.*$/gm, ''));   // 注释里有中文，编译前去掉
        gl.compileShader(sh);
        if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return sh;
        console.warn(gl.getShaderInfoLog(sh));
        return null;
      };
      const vs = shader(gl.VERTEX_SHADER, GLASS_VS);
      const fs = shader(gl.FRAGMENT_SHADER, GLASS_FS);
      if (!vs || !fs) return null;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (gl.getProgramParameter(prog, gl.LINK_STATUS)) return prog;
      console.warn(gl.getProgramInfoLog(prog));
      return null;
    }

    function makePanel(el) {
      const canvas = document.createElement('canvas');
      canvas.className = 'glass-gl';
      canvas.setAttribute('aria-hidden', 'true');
      const gl = canvas.getContext('webgl2', {
        alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false,
        powerPreference: 'high-performance',
      });
      const prog = gl && link(gl);
      if (!prog) return null;
      const U = {};
      for (const name of GLASS_UNIFORMS) U[name] = gl.getUniformLocation(prog, name);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST);
      for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE);
      const big = el.classList.contains('profile');
      const panel = {
        el, canvas, gl, prog, U, tex, vao: gl.createVertexArray(), texW: 0, visible: false, lost: false,
        thick: el.classList.contains('glass-thick'),
        bezel: big ? 34 : 22, refract: big ? 34 : 20,
        w: 0, h: 0, rect: null, radius: 0,
      };
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        panel.lost = true;
        el.classList.remove('has-gl');
      });
      el.prepend(canvas);
      return panel;
    }

    const panels = [...document.querySelectorAll('.profile, .friend')].map(makePanel).filter(Boolean);
    if (!panels.length) return null;

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const p = panels.find((x) => x.el === e.target);
        if (p) p.visible = e.isIntersecting;
      }
    }, { rootMargin: '64px' });
    panels.forEach((p) => io.observe(p.el));

    const theme = {};
    const view = { w: 0, h: 0, ecgTop: 0 };
    let enabled = false;
    let dirty = true;
    let bytes = null;
    const orbBuf = new Float32Array(16);
    const orbColBuf = new Float32Array(12);

    function readTheme() {
      const cs = getComputedStyle(root);
      theme.bg = parseColor(cs.getPropertyValue('--bg'));
      theme.gridA = parseColor(cs.getPropertyValue('--grid-major'));
      theme.gridB = parseColor(cs.getPropertyValue('--grid-minor'));
      theme.fill = parseColor(cs.getPropertyValue('--glass-fill'));
      theme.fillThick = parseColor(cs.getPropertyValue('--glass-fill-thick'));
      theme.spec = root.dataset.theme === 'dark' ? 0.5 : 0.85;
      orbs.forEach((o, i) => {
        const ocs = getComputedStyle(o.el);
        orbColBuf.set(parseColor(ocs.getPropertyValue('--c')).slice(0, 3), i * 3);
        o.alpha = parseFloat(ocs.opacity) || 1;
      });
    }

    // 读：所有布局信息集中在写入色球变换之前读取，避免强制重排
    function measure() {
      if (!enabled) return;
      if (dirty) {
        const wp = document.querySelector('.wallpaper').getBoundingClientRect();
        view.w = wp.width;
        view.h = wp.height;
        view.ecgTop = ecgWrap ? ecgWrap.getBoundingClientRect().top : -1e4;
        measureOrbs();
        panels.forEach((p) => (p.radius = parseFloat(getComputedStyle(p.el).borderTopLeftRadius) || 0));
        dirty = false;
      }
      for (const p of panels) {
        if (!p.visible || p.lost) continue;
        p.w = p.el.offsetWidth;
        p.h = p.el.offsetHeight;
        p.rect = p.el.getBoundingClientRect();
      }
    }

    function render() {
      if (!enabled) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const st = ecg && ecgWrap?.classList.contains('is-live') ? ecg.state() : null;
      if (st) {
        if (!bytes || bytes.length !== st.W * 4) bytes = new Uint8Array(st.W * 4);
        for (let i = 0; i < st.W; i++) {
          const y = st.ys[i];
          if (Number.isNaN(y)) { bytes[i * 4 + 1] = 0; continue; }
          const v = Math.round(Math.min(1, Math.max(0, y / st.H)) * 65535);
          bytes[i * 4] = v >> 8;
          bytes[i * 4 + 1] = 255;
          bytes[i * 4 + 2] = v & 255;
          bytes[i * 4 + 3] = 255;
        }
      }
      orbs.forEach((o, i) => orbBuf.set([o.cx ?? o.bx, o.cy ?? o.by, Math.max(1, o.r ?? o.bw / 2), o.alpha ?? 1], i * 4));

      for (const p of panels) {
        if (!p.visible || p.lost || !p.rect || !p.w) continue;
        const { gl, U } = p;
        const cw = Math.max(1, Math.round(p.w * dpr));
        const ch = Math.max(1, Math.round(p.h * dpr));
        if (p.canvas.width !== cw || p.canvas.height !== ch) {
          p.canvas.width = cw;
          p.canvas.height = ch;
        }
        gl.viewport(0, 0, cw, ch);
        gl.useProgram(p.prog);
        gl.bindVertexArray(p.vao);

        const angle = (parseFloat(p.el.style.getPropertyValue('--rim-angle')) || 135) * Math.PI / 180;
        const tint = p.thick ? theme.fillThick : theme.fill;
        gl.uniform2f(U.uRes, cw, ch);
        gl.uniform1f(U.uDpr, cw / p.w);
        gl.uniform2f(U.uSize, p.w, p.h);
        gl.uniform2f(U.uOrigin, p.rect.left, p.rect.top);
        gl.uniform2f(U.uView, view.w, view.h);
        gl.uniform2f(U.uLight, -Math.sin(angle), Math.cos(angle));
        gl.uniform1f(U.uRadius, Math.min(p.radius, p.w / 2, p.h / 2));
        gl.uniform1f(U.uBezel, p.bezel);
        gl.uniform1f(U.uRefract, p.refract);
        gl.uniform1f(U.uSpec, theme.spec);
        gl.uniform1f(U.uSat, 1.6);
        gl.uniform3fv(U.uBg, theme.bg.slice(0, 3));
        gl.uniform4fv(U.uOrb, orbBuf);
        gl.uniform3fv(U.uOrbC, orbColBuf);
        gl.uniform4fv(U.uGridA, theme.gridA);
        gl.uniform4fv(U.uGridB, theme.gridB);
        gl.uniform4fv(U.uTint, tint);

        // 心电带离这块玻璃不远时才上传波形
        const near = st && p.rect.top - 60 < view.ecgTop + st.H && p.rect.bottom + 60 > view.ecgTop;
        gl.uniform1f(U.uEcgOn, near ? 1 : 0);
        if (near) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, p.tex);
          if (p.texW !== st.W) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, st.W, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
            p.texW = st.W;
          } else {
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, st.W, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
          }
          gl.uniform1i(U.uEcg, 0);
          gl.uniform1f(U.uEcgW, st.W);
          gl.uniform1f(U.uEcgH, st.H);
          gl.uniform1f(U.uEcgTop, view.ecgTop);
          gl.uniform1f(U.uEcgHead, Math.floor(st.head));
          gl.uniform1f(U.uEcgFade, st.FADE);
          gl.uniform4f(U.uEcgC, st.rgb[0] / 255, st.rgb[1] / 255, st.rgb[2] / 255, st.alpha);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }

    function enable(on) {
      enabled = on && !reduceTransparency.matches;
      panels.forEach((p) => p.el.classList.toggle('has-gl', enabled && !p.lost));
      if (enabled) { readTheme(); dirty = true; }
    }

    window.addEventListener('resize', () => (dirty = true));
    document.addEventListener('themechange', () => enabled && readTheme());
    reduceTransparency.addEventListener('change', () => enable(!!rafId));
    return { measure, render, enable };
  }

  const glass = createGlass();
  let rafId = 0;
  let last = 0;

  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    glass?.measure();
    updateOrbs(now / 1000);
    if (ecg) { ecg.step(dt); ecg.draw(); }
    glass?.render();
    rafId = requestAnimationFrame(frame);
  }
  function startLife() {
    if (rafId) return;
    ecgWrap?.classList.toggle('is-live', !!ecg);
    measureOrbs();
    last = performance.now();
    rafId = requestAnimationFrame(frame);
    glass?.enable(true);
  }
  function stopLife() {
    cancelAnimationFrame(rafId);
    rafId = 0;
    ecgWrap?.classList.remove('is-live');
    orbs.forEach((o) => (o.el.style.transform = ''));
    glass?.enable(false);
  }
  // 系统开启"减少动态效果"时保持静止：静态心电图 + 不动的色球 + CSS 毛玻璃
  if (reduceMotion.matches) stopLife(); else startLife();
  reduceMotion.addEventListener('change', (e) => (e.matches ? stopLife() : startLife()));
})();
