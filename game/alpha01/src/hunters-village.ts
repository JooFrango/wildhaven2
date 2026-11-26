import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { startVillage } from '../../../world/hunters-village-v01/viewer/app.mjs';
import markup from '../../../world/hunters-village-v01/viewer/index.html?raw';

const prefix = '../../../world/hunters-village-v01/';
const files = import.meta.glob<string>([
  '../../../world/hunters-village-v01/models/*.glb',
  '../../../world/hunters-village-v01/site.json',
  '../../../world/hunters-village-v01/progression.json',
  '../../../world/hunters-village-v01/composition_171.json',
], { eager: true, query: '?url', import: 'default' });
const worldPrefix = '../../../world/world-visual-coherence-v12/';
const landscape = import.meta.glob<string>([
  '../../../world/world-visual-coherence-v12/models/world_170_v12.glb',
  '../../../world/world-visual-coherence-v12/detailed/*.glb',
], { eager: true, query: '?url', import: 'default' });

export async function enterVillage() {
  const template = new DOMParser().parseFromString(markup, 'text/html');
  const style = template.querySelector('style');
  if (style) document.head.append(style);
  template.body.querySelectorAll('script').forEach(script => script.remove());
  document.body.replaceChildren(...Array.from(template.body.children));
  document.title = template.title;
  const mirror = import.meta.env.VITE_WILDHAVEN_V12_URL;
  await startVillage(THREE, OrbitControls, GLTFLoader, key => {
    const file = files[prefix + key];
    if (!file) throw new Error('Arquivo da vila ausente: ' + key);
    return file;
  }, key => {
    if (mirror) return new URL(key, new URL(mirror + '/', location.href)).href;
    const file = landscape[worldPrefix + key];
    if (!file) throw new Error('Arquivo da v12 ausente: ' + key);
    return file;
  });
}
