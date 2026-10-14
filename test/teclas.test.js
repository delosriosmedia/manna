import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findBrowser } from '../server/core/tools.js';
import { sendKeys } from '../server/modules/projection/launcher.js';

// La ventana aparte de una página web (la que no se deja mostrar dentro de Manna) recibe las flechas
// por el protocolo de depuración de Chrome. Aquí, un Chrome sin ventana hace de esa ventana.
const browser = findBrowser();
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

test('las flechas llegan a la página de una ventana abierta con depuración', { skip: !browser && 'este equipo no tiene Chrome ni Edge' }, async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'manna-teclas-'));
  // La página cuenta las flechas en su título, que el protocolo deja leer desde fuera.
  const page = `data:text/html,<title>0</title><script>let n=0;addEventListener('keydown',e=>{n+=e.keyCode===39?1:e.keyCode===37?-1:0;document.title=n+':'+e.key})</script>`;
  const chrome = spawn(browser, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', page], { stdio: 'ignore' });
  try {
    assert.equal(await sendKeys(path.join(profile, 'no-existe'), ['ArrowRight']), false, 'sin ventana, dice que no pudo');
    let sent = false;
    for (let i = 0; i < 50 && !sent; i += 1) {
      await sleep(200);
      sent = await sendKeys(profile, ['ArrowRight', 'ArrowRight', 'Enter', 'ArrowLeft', 'ArrowRight']);
    }
    assert.ok(sent, 'Chrome aceptó las teclas');
    const port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
    const title = async () => (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.url.startsWith('data:')).title;
    let seen = await title();
    for (let i = 0; i < 20 && seen !== '2:ArrowRight'; i += 1) {
      await sleep(100);
      seen = await title();
    }
    assert.equal(seen, '2:ArrowRight', 'llegaron en orden las cuatro flechas y no la tecla Enter');
  } finally {
    chrome.kill();
    await sleep(300);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  }
});
