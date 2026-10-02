// «Живая сеть» первого экрана: узлы (участники, спикеры, страны) мягко
// тянутся к курсору или касанию, связи прорисованы лаймом.
// Загружается отложенно из main.js; при reduced-motion и на слабых устройствах
// не загружается вовсе, и остаётся статичная картинка assets/img/network-static.svg.

const LIME = '215, 255, 0';
const PEARL = '243, 241, 238';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function startNetwork(host) {
  if (!host) return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  host.append(canvas);

  const hero = host.parentElement;
  const mobile = matchMedia('(max-width: 759px)').matches;
  const COUNT = mobile ? 18 : 36;
  const rand = rng(7);
  let w = 0, h = 0, dpr = 1, linkDist = 0;
  let nodes = [];
  const pointer = { x: -9999, y: -9999, active: false };

  function layout() {
    const rect = host.getBoundingClientRect();
    w = rect.width; h = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    linkDist = Math.max(120, Math.min(w, h) * (mobile ? 0.34 : 0.24));
    if (!nodes.length) {
      for (let i = 0; i < COUNT; i++) {
        const kind = i % 9 === 0 ? 'country' : i % 4 === 0 ? 'speaker' : 'member';
        nodes.push({
          hx: rand(), hy: rand(),
          phase: rand() * Math.PI * 2,
          amp: 6 + rand() * 10,
          speed: 0.00012 + rand() * 0.00018,
          kind, ox: 0, oy: 0, x: 0, y: 0
        });
      }
    }
  }

  function frame(t) {
    ctx.clearRect(0, 0, w, h);
    const pull = Math.min(w, h) * 0.45;
    for (const n of nodes) {
      const bx = n.hx * w + Math.cos(t * n.speed + n.phase) * n.amp;
      const by = n.hy * h + Math.sin(t * n.speed * 1.3 + n.phase) * n.amp;
      let tx = 0, ty = 0;
      if (pointer.active) {
        const dx = pointer.x - bx, dy = pointer.y - by;
        const d = Math.hypot(dx, dy);
        if (d < pull) {
          const k = (1 - d / pull) * 0.22;
          tx = dx * k; ty = dy * k;
        }
      }
      n.ox += (tx - n.ox) * 0.06;
      n.oy += (ty - n.oy) * 0.06;
      n.x = bx + n.ox; n.y = by + n.oy;
    }

    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < linkDist) {
          ctx.strokeStyle = `rgba(${LIME}, ${(1 - d / linkDist) * 0.38})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (pointer.active) {
        const d = Math.hypot(a.x - pointer.x, a.y - pointer.y);
        if (d < linkDist * 1.1) {
          ctx.strokeStyle = `rgba(${LIME}, ${(1 - d / (linkDist * 1.1)) * 0.55})`;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(pointer.x, pointer.y); ctx.stroke();
        }
      }
    }

    for (const n of nodes) {
      ctx.beginPath();
      if (n.kind === 'country') {
        ctx.arc(n.x, n.y, 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${LIME}, 0.9)`; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.lineWidth = 1;
      } else {
        ctx.arc(n.x, n.y, n.kind === 'speaker' ? 3 : 1.8, 0, Math.PI * 2);
        ctx.fillStyle = n.kind === 'speaker' ? `rgba(${LIME}, 0.95)` : `rgba(${PEARL}, 0.75)`;
        ctx.fill();
      }
    }
  }

  let raf = 0, running = false;
  const loop = (t) => { frame(t); raf = requestAnimationFrame(loop); };
  const start = () => { if (!running && !document.hidden) { running = true; raf = requestAnimationFrame(loop); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  layout();
  frame(performance.now());
  host.classList.add('is-live');

  const move = (x, y) => {
    const r = host.getBoundingClientRect();
    pointer.x = x - r.left; pointer.y = y - r.top; pointer.active = true;
  };
  hero.addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
  hero.addEventListener('pointerdown', (e) => move(e.clientX, e.clientY), { passive: true });
  hero.addEventListener('pointerleave', () => { pointer.active = false; });

  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(layout, 150); }, { passive: true });

  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
}
