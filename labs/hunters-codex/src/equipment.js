export const WEAPONS={
 unarmed:{name:'Desarmado',reach:.7,damage:8,type:'impacto',energy:6,windup:.22,recovery:.55,penetration:.05},
 spear:{name:'Lança',reach:2.15,damage:21,type:'perfurante',energy:12,windup:.48,recovery:.85,penetration:.55},
 sword:{name:'Espada',reach:1.25,damage:24,type:'cortante',energy:10,windup:.32,recovery:.65,penetration:.28}
};
export const ARMOR={none:{name:'Sem armadura',weight:0,mobility:1,protection:0},light:{name:'Leve',weight:8,mobility:.92,protection:.26},heavy:{name:'Pesada',weight:24,mobility:.72,protection:.62}};
export function equip(a,options={}){const h=a.hunter,next={...h,...options};if(!WEAPONS[next.weapon]||!ARMOR[next.armor]||typeof next.shield!=='boolean')throw Error('Equipamento inválido');for(const k of ['weapon','armor','shield'])if(k in options)h[k]=options[k];const armor=ARMOR[h.armor];a.especie.combate.protecao={cabeca:armor.protection*.5,pescoco:armor.protection*.2,tronco:armor.protection,flanco:armor.protection,bracos:armor.protection*.7,pernas:armor.protection*.6};a.especie.movimento.andar=2.1*armor.mobility;a.especie.movimento.trote=3.6*armor.mobility;a.especie.movimento.corrida=6.2*armor.mobility;}
export function armFactor(a){return Math.max(.35,1-a.saude.ferimentos.filter(f=>f.regiao==='bracos').reduce((s,f)=>s+f.gravidade*(f.fratura?1.4:.7),0));}
