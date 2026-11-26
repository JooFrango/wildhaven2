import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { atan2, cos, hipot, sen } from '../src/core/matematica.js';
import { RAIZ_LAB } from '../src/node/carregar-node.js';

test('matemática determinística aproxima Math com erro < 1e-12', () => {
  for (let i = -2000; i <= 2000; i++) {
    const x = i * 0.0137;
    assert.ok(Math.abs(sen(x) - Math.sin(x)) < 1e-12, `sen(${x})`);
    assert.ok(Math.abs(cos(x) - Math.cos(x)) < 1e-12, `cos(${x})`);
    const y = Math.sin(i * 1.3) * 7, z = Math.cos(i * 0.7) * 5;
    assert.ok(Math.abs(atan2(y, z) - Math.atan2(y, z)) < 1e-12, `atan2(${y}, ${z})`);
    assert.ok(Math.abs(hipot(y, z) - Math.hypot(y, z)) < 1e-12);
  }
  assert.equal(atan2(0, 0), 0);
  assert.ok(Math.abs(atan2(1, 0) - Math.PI / 2) < 1e-15);
});

test('src/core não usa funções transcendentais do Math (quebram o determinismo entre motores)', async () => {
  const proibido = /Math\.(sin|cos|tan|atan2?|asin|acos|hypot|exp|log\w*|pow|cbrt|sinh|cosh|tanh)\b|\*\*/;
  const pastas = [join(RAIZ_LAB, 'src', 'core'), join(RAIZ_LAB, 'src', 'core', 'comportamentos')];
  for (const pasta of pastas) {
    for (const f of (await readdir(pasta)).filter((x) => x.endsWith('.js') && x !== 'matematica.js')) {
      const linhas = (await readFile(join(pasta, f), 'utf8')).split('\n');
      linhas.forEach((l, i) => {
        if (!l.trim().startsWith('//')) assert.doesNotMatch(l, proibido, `${f}:${i + 1}`);
      });
    }
  }
});
