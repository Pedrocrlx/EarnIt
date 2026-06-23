export const DEFAULT_POINTS_PER_EURO = 100;

export const eurosToPoints = (euroAmount: string | number, pointsPerEuro: number) =>
  Math.round(Number(euroAmount || 0) * pointsPerEuro);

export const pointsToEuros = (points: number, pointsPerEuro: number) =>
  points / pointsPerEuro;

export const formatPoints = (points: number) =>
  `${points.toLocaleString("pt-PT")}`;
