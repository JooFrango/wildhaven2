// Provedor de regiões no navegador: baixa cada GLB uma vez (os mesmos bytes servem para desenhar e para a grade),
// extrai triângulos e monta grades num Web Worker, e devolve a grade pronta por callback (o jogo aplica no passo seguinte).
export function provedorWeb({ fontes, site, progressao }) {
  const worker = new Worker(new URL('./trabalhador-regiao.js', import.meta.url), { type: 'module' });
  const bytes = new Map(), noWorker = new Map(), pedidos = new Map(), falhas = new Set(), medidas = { hex: [], grade: [] };
  let seq = 0, erro = null;
  worker.postMessage({ tipo: 'iniciar', fontes: [...fontes], site, progressao });
  worker.onmessage = ({ data: d }) => {
    if (d.tipo === 'hex') { medidas.hex.push(d.ms); noWorker.get(d.id)?.ok(); }
    if (d.tipo === 'grade') { medidas.grade.push(d.ms); const t = d.t; t.perfis = new Map(); pedidos.get(d.pedido)?.(t); pedidos.delete(d.pedido); }
    if (d.tipo === 'erro') { erro = d.mensagem; console.error(d.mensagem); if (d.id) { falhas.add(d.id); noWorker.get(d.id)?.ok(); } }
  };
  // Bytes do GLB (cache por caminho; a renderização usa os mesmos).
  const baixar = (path) => {
    if (!bytes.has(path)) bytes.set(path, fetch('/' + path).then((r) => { if (!r.ok) throw Error(`HTTP ${r.status} em ${path}`); return r.arrayBuffer(); }));
    return bytes.get(path);
  };
  // Triângulos do hexágono no Worker (uma vez por hexágono).
  const garantir = (id) => {
    if (!noWorker.has(id)) {
      let ok; const p = new Promise((r) => { ok = r; });
      noWorker.set(id, { p, ok });
      baixar(fontes.get(id).path).then((ab) => worker.postMessage({ tipo: 'hex', id, path: fontes.get(id).path, bytes: ab.slice(0) }, [])).catch((e) => { falhas.add(id); erro = String(e); ok(); });
    }
    return noWorker.get(id).p;
  };
  return {
    disponivel: (id) => fontes.has(id) && !falhas.has(id),
    baixar, garantir, medidas, erro: () => erro,
    montar(spec, pronto) {
      const n = ++seq;
      Promise.all(spec.hexes.map(garantir)).then(() => {
        pedidos.set(n, pronto);
        worker.postMessage({ tipo: 'montar', pedido: n, spec: { ...spec, hexes: spec.hexes.filter((id) => !falhas.has(id)) } });
      });
    },
    // Promessa para quem precisa esperar (carga inicial e restauração).
    montarAsync(spec) { return new Promise((ok) => this.montar(spec, ok)); },
    // Libera bytes de GLB que nem a renderização nem a simulação precisam mais (os triângulos ficam no Worker).
    esquecer(path) { bytes.delete(path); },
  };
}
