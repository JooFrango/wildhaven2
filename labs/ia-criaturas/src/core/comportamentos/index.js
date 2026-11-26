// Registro de comportamentos. Para adicionar um novo arquétipo (ex.: necrofago, onivoro),
// crie um módulo com { id, estadosFuga, estadosCaca, inicioPerseguicao, decidir(sentidos, mente) }
// e registre aqui. A ficha da espécie escolhe o arquétipo pelo campo "comportamento".
import { hipot } from '../matematica.js';
import { herbivoro } from './herbivoro.js';
import { predador } from './predador.js';

// Boneco de teste: fica parado (ou segue uma rota fixa) sem reagir a nada. Útil para testes isolados.
export const estatico = {
  id: 'estatico',
  estadosFuga: [],
  estadosCaca: [],
  inicioPerseguicao: null,
  decidir(s, mente) {
    const rota = s.eu.patrulha;
    if (!rota || !rota.length) return { estado: 'parado', codigo: 'estatico', motivo: 'boneco de teste', alvo: null, destino: null, ritmo: 'parado' };
    mente.i ??= 0;
    const [x, y] = rota[mente.i];
    if (hipot(s.eu.x - x, s.eu.y - y) < 0.5 && mente.i < rota.length - 1) mente.i++;
    return { estado: 'rota_fixa', codigo: 'rota', motivo: `rota fixa ponto ${mente.i + 1}`, alvo: null, destino: { x: rota[mente.i][0], y: rota[mente.i][1] }, ritmo: s.eu.ritmoFixo ?? 'andar' };
  },
};

export const COMPORTAMENTOS = { herbivoro, predador, estatico };

export function registrarComportamento(def) {
  COMPORTAMENTOS[def.id] = def;
}
