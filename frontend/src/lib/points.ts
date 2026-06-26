// Rewards and balances are stored in POINTS. The family rate `point_value_eur`
// is euros-per-point (e.g. 0.01 = 1 point worth €0.01). The parent enters euros,
// so we convert euros -> points = euros / point_value_eur.

export const formatPoints = (points: number) => `${points.toLocaleString("pt-PT")}`;

export const formatEuros = (euros: number) =>
  `${euros.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

export const eurosToPoints = (euros: string, pointValueEur: number) =>
  pointValueEur > 0 ? Math.round((Number(euros) || 0) / pointValueEur) : 0;
