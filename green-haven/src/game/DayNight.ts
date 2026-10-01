export const DAY_MS = 180_000; // 3 minutos reais = 1 dia completo (nascer -> nascer do sol)

export interface DayNightPhase {
  isDay: boolean;
  elev: number;       // 0 no horizonte, 1 no auge do arco
  azimuthDeg: number;  // varredura de um lado ao outro do céu
  dayIndex: number;    // índice do dia atual, usado para gerar o pedido do correio
}

/** Pura: mesmo `now` sempre dá a mesma fase. Sol de dia, lua de noite, sem clima/estações. */
export function dayNightPhase(now: number): DayNightPhase {
  const dayIndex = Math.floor(now / DAY_MS);
  const t = (now % DAY_MS) / DAY_MS; // 0..1 dentro do dia
  const isDay = t < 0.5;
  const local = isDay ? t / 0.5 : (t - 0.5) / 0.5; // 0..1 dentro do período (dia ou noite)
  const elev = Math.sin(local * Math.PI);
  const azimuthDeg = -100 + local * 200;
  return { isDay, elev, azimuthDeg, dayIndex };
}
