import {buscarCaminho,perfilMobilidade} from '../../ia-criaturas/src/eco/terreno.js';
// Feed one safe corner at a time to the existing locomotor. Its broad arrival radius otherwise cuts
// corners valid on the grid but invalid against a precise triangle + body radius.
export function routeIntent(sim,a,intent){if(!intent?.destino)return intent;const target=intent.destino,h=a.hunter;let route=h.preciseRoute;
 if(route&&(Math.hypot(route.target.x-target.x,route.target.y-target.y)>2||sim.world.t-route.t>5))route=h.preciseRoute=null;
 if(!route&&!sim.geometry.sweep(a,target,.38,1.8).blocked)return intent;
 if(!route){const p=buscarCaminho(sim.world.terreno,perfilMobilidade(sim.world.terreno,a.especie.movimento),a,target,{raio:.7,maxExpansoes:20000});route=h.preciseRoute={target:{...target},points:p?.pontos.slice(1)??[],t:sim.world.t};}
 while(route.points.length&&Math.hypot(a.x-route.points[0].x,a.y-route.points[0].y)<.43){route.points.shift();a.caminho=null;}
 if(!route.points.length){h.preciseRoute=null;return intent;}
 return{...intent,destino:route.points[0]};}
