#!/usr/bin/env node
// Comparação de desempenho A/B no mesmo Chrome e na mesma sessão, com o mesmo roteiro de cliques.
// Uso: node tools/desempenho-ab.mjs game/_ab_v02 game/playable-v02   (pastas relativas à raiz do repositório)
// A pasta A é uma cópia da V02 publicada (git archive do commit-base); nada nela é versionado.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const pastas = process.argv.slice(2), PORTA = 5214, rodadas = 2;
const servidor = spawn(process.execPath, [fileURLToPath(new URL('../../playable-v01/tools/servir.mjs', import.meta.url)), '--porta', String(PORTA)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-precise-memory-info'] });
const res = [];
try {
  for (let r = 0; r < rodadas; r++) for (const pasta of pastas) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } }), page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORTA}/${pasta}/?semente=1`);
    await page.waitForSelector('#novaDemo:not([hidden])', { timeout: 180000 });
    await page.click('#novaDemo'); await page.waitForSelector('#esquadrao .cartao'); await page.waitForTimeout(1500);
    const c = (id) => page.locator(`.cartao[data-id="${id}"]`);
    await c('arvo').click(); await c('brena').click({ modifiers: ['Control'] }); await page.click('[data-ordem="cacar"]');
    await c('caio').click(); await page.click('[data-ordem="patrulhar"]');
    await c('dara').click(); await page.click('[data-ordem="vila"]');
    await c('arvo').dblclick();
    const medir = () => page.evaluate(() => wildhaven2.medir());
    await page.click('[data-vel="1"]'); await page.waitForTimeout(11000); const x1 = await medir();
    await page.click('[data-vel="8"]'); await page.waitForTimeout(11000); const x8 = await medir();
    res.push({ pasta, rodada: r + 1, x1, x8 });
    console.log(pasta, r + 1, '1×', x1.fpsMedio, 'fps p95', x1.msP95, '| 8×', x8.fpsMedio, 'fps p95', x8.msP95);
    await ctx.close();
  }
} finally {
  await writeFile(new URL('../resultados/v022/desempenho-ab.json', import.meta.url), JSON.stringify({ data: new Date().toISOString(), pastas, res }, null, 1));
  await browser.close(); servidor.kill();
}
