/// <reference types="vite/client" />
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {startRange} from '../../../world/playable-eastern-range-v01/play/range.mjs';
import region from '../../../world/playable-eastern-range-v01/play/region.json';

const files=import.meta.glob<string>([
  "../../../world/playable-eastern-range-v01/models/*.glb",
  "../../../world/forest-continuity-v02/models/f_e3_floresta_5km_v02.glb",
  "../../../world/plains-east-gap-30/models/34_pradaria_dos_ventos_leste_5km.glb",
  "../../../world/plains-east-gap-30/models/35_planicie_rochas_claras_5km.glb",
  "../../../world/forest-extension-21-v01/models/fx_02_5km_v01.glb",
  "../../../world/forest-extension-21-v01/models/fx_03_5km_v01.glb",
  "../../../world/forest-extension-21-v01/models/fx_07_5km_v01.glb",
  "../../../world/forest-extension-21-v01/models/fx_11_5km_v01.glb",
  "../../../world/forest-extension-21-v01/models/fx_16_5km_v01.glb",
  "../../../world/forest-extension-21-v01/models/fx_19_5km_v01.glb",
  "../../../world/forest-extension-21-v01/models/fx_20_5km_v01.glb",
  "../../../world/forest-extension-21-v01/models/fx_21_5km_v01.glb"
], {eager:true,query:'?url',import:'default'});
export async function enterRange(){
  await startRange(THREE,GLTFLoader,region,(path:string)=>{
    const url=files['../../../'+path];
    if(!url)throw Error('GLB ausente: '+path);
    return url;
  });
}
