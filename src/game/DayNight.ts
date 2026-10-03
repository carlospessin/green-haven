export const DAY_MS = 180_000; // 3 minutos reais = 1 dia completo

export interface DayNightPhase {
  dayFactor: number;   // 0..1, força do sol (0 = totalmente de noite, 1 = meio-dia)
  nightFactor: number; // 0..1, força da lua (espelhado: alto quando dayFactor é baixo)
  azimuthDeg: number;  // varredura contínua ao longo do dia inteiro
  t: number;            // 0..1, hora do dia bruta
}

/**
 * Pura e contínua: nada de alternar entre duas fórmulas diferentes no meio do ciclo.
 * `altitude` é uma senoide suave (-1 à meia-noite, +1 ao meio-dia); dayFactor/nightFactor
 * são apenas o lado positivo dela, então a transição entre sol e lua é sempre gradual,
 * nunca um salto instantâneo.
 */
export function dayNightPhase(now: number): DayNightPhase {
  const t = (now % DAY_MS) / DAY_MS;
  const altitude = -Math.cos(2 * Math.PI * t);
  const dayFactor = Math.max(0, altitude);
  const nightFactor = Math.max(0, -altitude);
  const azimuthDeg = -100 + t * 360;
  return { dayFactor, nightFactor, azimuthDeg, t };
}
