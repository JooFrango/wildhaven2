import {carregarConfigEco} from '../../ia-criaturas/src/eco/config.js';
export async function loadData(read){const[config,nav,geometry]=await Promise.all([carregarConfigEco(p=>read('../ia-criaturas/'+p),{preCarregarTerrenos:false}),read('assets/terrain-nav.json'),read('assets/terrain-geometry.json')]);return{eco:{species:config.especies,diseases:config.doencas},nav,geometry};}
