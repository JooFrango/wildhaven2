import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarConfig } from '../core/carregar.js';

export const RAIZ_LAB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const lerJsonNode = async (rel) => JSON.parse(await readFile(join(RAIZ_LAB, rel), 'utf8'));

export const carregarConfigNode = () => carregarConfig(lerJsonNode);
