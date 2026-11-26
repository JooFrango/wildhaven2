// RNG determinístico com estado serializável (persistência exata entre sessões).
import { hashTexto } from '../core/rng.js';

export class Rng {
  constructor(semente) { this.s = semente >>> 0; }
  proximo() {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  entre(a, b) { return a + (b - a) * this.proximo(); }
  inteiro(a, b) { return Math.floor(a + (b - a + 1) * this.proximo()); }
  chance(p) { return this.proximo() < p; }
  // Aproximação normal (Irwin–Hall com 6 uniformes): sem log/cos, idêntica em qualquer motor.
  normal(media = 0, dp = 1) {
    let s = 0; for (let i = 0; i < 6; i++) s += this.proximo();
    return media + dp * (s - 3) * 1.4142135623730951;
  }
  escolher(lista) { return lista[Math.floor(this.proximo() * lista.length)]; }
}

export const derivarSemente = (semente, rotulo) => (hashTexto(String(rotulo)) ^ Math.imul(semente >>> 0, 2654435761)) >>> 0;
export const rngDerivado = (semente, rotulo) => new Rng(derivarSemente(semente, rotulo));
// Sorteio sem estado, chaveado por evento: o mesmo evento sempre dá o mesmo resultado (útil entre níveis de simulação).
export const sorteioChaveado = (semente, chave) => new Rng(derivarSemente(semente, chave)).proximo();
