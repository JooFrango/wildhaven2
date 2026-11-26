import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { carregarConfigEcoNode } from '../src/node/eco-node.js';
import { RAIZ_LAB } from '../src/node/carregar-node.js';
import { validarEspecies } from '../src/eco/especies.js';
import { criarMundoEco, passoEco } from '../src/eco/mundo.js';
import { abrirConflito } from '../src/eco/combate.js';
import { prepararPredadoresLaboratorio, populacaoDueloPredadores } from '../src/web3d/duelo-predadores.js';

test('duelo de gigantes usa GLB real Gravarto v02 intacto (17 clipes)', async () => {
  const root = resolve(RAIZ_LAB, '../..');
  const path = 'assets/models/creatures/gravarto/v02/';
  const manifest = JSON.parse(await readFile(resolve(root, path, 'manifest.json'), 'utf8'));
  const glb = await readFile(resolve(root, path, manifest.file));
  assert.equal(glb.toString('utf8', 0, 4), 'glTF');
  assert.equal(glb.byteLength, manifest.bytes);
  assert.equal(createHash('sha256').update(glb).digest('hex'), manifest.sha256);
  assert.equal(manifest.geometry.clip_count, 17);
  const config = await carregarConfigEcoNode();
  const { gravarto, rocantraz } = prepararPredadoresLaboratorio(config);
  assert.deepEqual(validarEspecies(Object.values(config.especies)).filter(e => e.includes('gravarto')), []);
  assert.equal(gravarto.modelo.clipes.mordida, 'bite');
  assert.equal(gravarto.modelo.clipes.golpe_cauda, 'tail_sweep');
  assert.equal(gravarto.modelo.glb, path + manifest.file);
  assert.equal(gravarto.combate.iaAvancada, true);
  assert.equal(rocantraz.combate.iaAvancada, true);
});

test('ambos gigantes entram em combate no núcleo ecológico sem golpes artificiais', async () => {
  const cfg = await carregarConfigEcoNode();
  prepararPredadoresLaboratorio(cfg);
  const base = {
    id:'duelo-gravarto-rocantraz-node', nome:'Duelo de carnívoros grandes',dt:.1,duracaoSeg:35,
    relogio:{segundosPorDia:600,diaInicial:20,horaInicial:17},
    clima:{chanceChuvaChuvosa:0,chanceChuvaSeca:0,chanceIncendio:0},
    terreno:{tipo:'procedural',largura:140,profundidade:100,res:1,amplitude:1.0,capim:25,
      lago:{x:118,y:78,raio:7,fundo:1.5},rochas:[],arbustos:[]},
    populacoes:populacaoDueloPredadores()
  };
  const samples = [];
  for(const seed of [3,7,11]){
    const all = {...cfg,cenarios:{...cfg.cenarios,[base.id]:base}};
    const m = criarMundoEco(all,base,seed);
    const a=m.porId.get('v'),b=m.porId.get('rival');
    // Preserva avaliação ecológica: o cheiro não revela porte juvenil; reconhecer
    // ambos VISUALMENTE antes de comparar massas observadas e travar duelo.
    let visao=false;
    for(let i=0;i<50;i++){
      passoEco(m);
      visao=a.contatos.some(x=>x.id===b.id&&x.via==='visao')
        &&b.contatos.some(x=>x.id===a.id&&x.via==='visao');
      if(visao)break;
    }
    const inicio={visao,t:m.t,g:{massa:a.massa,idade:a.idadeAnos,contato:a.contatos?.find(x=>x.id==='rival')},
      r:{massa:b.massa,idade:b.idadeAnos,contato:b.contatos?.find(x=>x.id==='v')}};
    assert.ok(visao,'ambos predadores devem reconhecer a massa do rival por visão: '+JSON.stringify(inicio));
    const c=a.conflito?.id?m.conflitos.find(x=>x.id===a.conflito.id):abrirConflito(m,a,b,'territorio',null);
    assert.ok(c&&!c.resultado,'confronto ainda ativo após reconhecimento visual '+JSON.stringify(inicio));
    c.fase='combate';c.desde=m.t;c.fasesVistas.push('combate');
    for(let i=0;i<230;i++) passoEco(m);
    const types=m.eventos.reduce((acc,e)=>(acc[e.tipo]=(acc[e.tipo]||0)+1,acc),{});
    assert.equal(m.metricas.falhas?.length??0,0, 'falhas de núcleo semente '+seed);
    assert.ok(Number.isFinite(a.x)&&Number.isFinite(b.x), 'coordenadas finitas seed '+seed);
    samples.push({seed,inicio,ataques:types.ataque_inicio||0,golpes:types.golpe||0,feints:types.tatico_finta||0,esquivas:types.tatico_esquiva||0,
      distancia:+Math.hypot(a.x-b.x,a.y-b.y).toFixed(2),conflito:c.resultado, eventos:types,
      gravarto:{estado:a.estado,motivo:a.motivo,x:+a.x.toFixed(2),y:+a.y.toFixed(2),tatico:a.tatica?.phase,bandas:a.tatica?.bands},
      rocantraz:{estado:b.estado,motivo:b.motivo,x:+b.x.toFixed(2),y:+b.y.toFixed(2),tatico:b.tatica?.phase,bandas:b.tatica?.bands}});
  }
  assert.ok(samples.some(s=>s.ataques>0), 'duelo precisa produzir ao menos um ataque real nas três sementes: '+JSON.stringify(samples));
});
