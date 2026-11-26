import {readFile} from 'node:fs/promises';
import {loadData} from '../src/data.js';
export const data=await loadData(p=>readFile(new URL('../'+p,import.meta.url),'utf8').then(JSON.parse));
