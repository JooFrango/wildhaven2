import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { carregarConfigEco } from '../eco/config.js';
import { RAIZ_LAB } from './carregar-node.js';

export const lerJsonLab = async (rel) => JSON.parse(await readFile(join(RAIZ_LAB, rel), 'utf8'));
export const carregarConfigEcoNode = () => carregarConfigEco(lerJsonLab);
