// Ícones próprios da V02 (SVG inline, traço único, estilo gravura). Sem assets externos.
const S = (p: string, vb = "0 0 24 24") => `<svg viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const ICON: Record<string, string> = {
  explorar: S('<circle cx="7" cy="15" r="3.2"/><circle cx="17" cy="15" r="3.2"/><path d="M10 14h4M4.5 12.5 7 5h3l1 5M19.5 12.5 17 5h-3l-1 5"/>'),
  cacar: S('<path d="M4 20 18 6M14 4h6v6M4 4l16 16M6 20H4v-2"/>'),
  rastrear: S('<ellipse cx="8" cy="15" rx="2.3" ry="3"/><circle cx="5" cy="9.5" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="11" cy="9.5" r="1.1"/><ellipse cx="17" cy="10" rx="2" ry="2.6"/><circle cx="14.6" cy="5.4" r="1"/><circle cx="17" cy="4.2" r="1"/><circle cx="19.4" cy="5.4" r="1"/>'),
  armadilhas: S('<path d="M3 15c2-6 5-8 9-8s7 2 9 8"/><path d="M5 15l1.5-3M8 15l1-3.5M12 15v-4M16 15l-1-3.5M19 15l-1.5-3"/><path d="M2 15h20M12 15v5"/>'),
  viajar: S('<rect x="3" y="9" width="12" height="6" rx="1"/><path d="M3 9c0-3 2-5 6-5s6 2 6 5"/><circle cx="6" cy="17.5" r="2"/><circle cx="13" cy="17.5" r="2"/><path d="M15 12h4l2 3"/>'),
  acampamento: S('<path d="M3 20 12 5l9 15H3Z"/><path d="M12 5v15M9.5 20 12 15l2.5 5"/>'),
  descansar: S('<path d="M3 16h18M5 16v-3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 19v-3M21 19v-3"/><path d="M16 4h4l-4 4h4"/>'),
  recolher: S('<path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>'),
  vila: S('<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>'),
  bestiario: S('<path d="M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2V5Z"/><path d="M20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2V5Z"/>'),
  inventario: S('<path d="M7 7V5a5 5 0 0 1 10 0v2"/><rect x="4" y="7" width="16" height="14" rx="2"/><path d="M9 12h6"/>'),
  equipamento: S('<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z"/><path d="M9 12l2 2 4-4"/>'),
  mapa: S('<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>'),
  sistema: S('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
  sol: S('<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>'),
  lua: S('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'),
  espada: S('<path d="M14.5 3H21v6.5L9 21.5 2.5 15 14.5 3Z"/><path d="M6 18l-3 3M5 13l6 6"/>'),
  lanca: S('<path d="M3 21 17 7"/><path d="M17 7l4-4-1 5-3-1Z"/><path d="M6 16l2 2"/>'),
  espadao: S('<path d="M16 3h5v5L8 21l-5-5L16 3Z"/><path d="M6 13l5 5M3.5 20.5l2-2"/>'),
  vento: S('<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>'),
  temp: S('<path d="M10 14V4a2 2 0 0 1 4 0v10a4 4 0 1 1-4 0Z"/><path d="M12 9v7"/>'),
  folha: S('<path d="M5 19c0-8 6-14 15-14-1 9-7 14-15 14Z"/><path d="M5 19 13 11"/>'),
  alerta: S('<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>'),
  chuva: S('<path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 15H7Z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>'),
  neve: S('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>'),
  nuvem: S('<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.5A3.5 3.5 0 0 1 17 18H7Z"/>'),
  areia: S('<path d="M3 9h13a2.5 2.5 0 1 0-2.5-2.5M3 13h17M3 17h10a2.5 2.5 0 1 1-2.5 2.5"/>'),
  cruz: S('<path d="M12 5v14M5 12h14"/>'),
  fechar: S('<path d="M6 6l12 12M18 6 6 18"/>'),
  item: S('<path d="M12 3 4 8v8l8 5 8-5V8l-8-5Z"/>'),
  pele: S('<path d="M6 4c2 1 4 1 6 0 2 1 4 1 6 0l-1 6 2 4-3 6H8l-3-6 2-4-1-6Z"/>'),
  carne: S('<path d="M15 4a6 6 0 0 1 4 9l-6 6a4 4 0 0 1-6-6l6-6"/><path d="M7 17l-3 3"/><circle cx="15" cy="9" r="1.5"/>'),
  pena: S('<path d="M20 4C10 4 5 10 4 20c7-1 14-6 16-16Z"/><path d="M4 20 14 10"/>'),
  presa: S('<path d="M7 3c0 7 2 13 5 18 3-5 5-11 5-18"/>'),
  check: S('<path d="M5 12l5 5 9-10"/>'),
};
export function itemIcon(name: string) {
  const n = name.toLowerCase();
  if (/pele|couro/.test(n)) return ICON.pele;
  if (/carne/.test(n)) return ICON.carne;
  if (/pena/.test(n)) return ICON.pena;
  if (/presa|garra|dente|chifre|osso/.test(n)) return ICON.presa;
  return ICON.item;
}
export function weatherIcon(kind: string, night: boolean) {
  if (kind === "chuva" || kind === "tempestade") return ICON.chuva;
  if (kind === "neve" || kind === "nevasca") return ICON.neve;
  if (kind === "areia") return ICON.areia;
  if (kind === "nublado") return ICON.nuvem;
  return night ? ICON.lua : ICON.sol;
}
