import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'] });
const page = await browser.newPage();
await page.goto('http://localhost:5179/', { waitUntil: 'networkidle0' });
const res = await page.evaluate(() => {
  const L = window.__game.level; L.reset(); L.generateUpTo(40);
  return L.platforms.map(p => `y=${p.top.toFixed(2)} x=[${p.x0.toFixed(1)},${p.x1.toFixed(1)}] ${p.moving?'MOV amp'+p.amp.toFixed(1)+' base'+p.baseX.toFixed(1):''}${p.broken?'BRK':''}${p.brokenEnd?'split':''}`).join('\n')
    + '\nladders: ' + L.ladders.map(l=>`${l.x.toFixed(1)} ${l.y0.toFixed(2)}-${l.y1.toFixed(2)}`).join('; ');
});
console.log(res);
await browser.close();
