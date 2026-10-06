import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message + e.stack));
await page.goto('http://localhost:5179/', { waitUntil: 'networkidle0' });
await page.click('#btn-play');
const res = await page.evaluate(() => {
  const g = window.__game; const L = g.level;
  const results = [];
  for (let trial = 0; trial < 20; trial++) {
    L.reset(); L.generateUpTo(700);
    const plats = L.platforms.filter(p => !p.broken || true);
    // reachable set via BFS: jump up to 4.6 high, horizontal edge gap <= 3.8 (or moving range)
    const ext = p => p.moving ? [p.baseX - p.amp - p.len/2, p.baseX + p.amp + p.len/2] : [p.x0, p.x1];
    const reach = new Set([plats[0]]); const q = [plats[0]];
    while (q.length) { const a = q.shift(); const [a0,a1] = ext(a);
      for (const b of plats) { if (reach.has(b)) continue; const dy = b.top - a.top; const lad = L.ladders.some(l => Math.abs(l.y0 - a.top) < 0.05 && Math.abs(l.y1 - b.top) < 0.05 && l.x >= b.x0 && l.x <= b.x1); if (dy > 4.6 && !lad) continue;
        const [b0,b1] = ext(b); const gap = Math.max(0, b0 - a1, a0 - b1);
        const ok = lad || gap <= 3.8;
        if (ok) { reach.add(b); q.push(b); } } }
    // ladder links
    let top = 0; for (const p of reach) top = Math.max(top, p.top);
    results.push(top.toFixed(0));
  }
  return results.join(',');
});
console.log('max reachable height per trial (target ~700):', res);
await page.evaluate(() => { const g = window.__game; g.level.reset(); g.player.reset(0,0);
  g.level.generateUpTo(200); const p = g.level.platforms.filter(p=>p.y>150 && !p.floor).sort((a,b)=>a.y-b.y)[0];
  g.player.x=p.x; g.player.y=p.top; g.player.maxY=p.top; g.maxZone=2; g.fx.tide.y=p.top-3; g.camY=p.top+2; g.elapsed=0; });
await new Promise(r => setTimeout(r, 4000));
await page.screenshot({ path: '/tmp/lava.png' });
await page.evaluate(() => { const g = window.__game; g.level.generateUpTo(260); const p = g.level.platforms.filter(p=>p.y>220 && !p.floor).sort((a,b)=>a.y-b.y)[0];
  g.player.x=p.x; g.player.y=p.top; g.player.maxY=p.top; g.maxZone=3; g.fx.tide.y=p.top-14; g.camY=p.top+2; g.elapsed=0; });
await new Promise(r => setTimeout(r, 4000));
await page.screenshot({ path: '/tmp/ice2.png' });
await page.evaluate(() => { const g = window.__game; g.deathCause='tide'; g.gameOver(); });
await new Promise(r => setTimeout(r, 1500));
await page.screenshot({ path: '/tmp/over.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
