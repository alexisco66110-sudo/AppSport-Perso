// Estimation des calories : MET × poids (kg) × durée (h).
// Valeurs MET : 2024 Adult Compendium of Physical Activities (https://pacompendium.com), code entre parenthèses dans docs/CALORIES.md.
export const INTENSITIES = { low: 'Légère', mid: 'Modérée', high: 'Intense' };

export const MET = {
  course: { low: [7.5, '12020'], mid: [9.3, '12050'], high: [11.8, '12080'] },
  muscu: { low: [3.5, '02054'], mid: [5.0, '02052'], high: [6.0, '02050'] },
  kickboxing: { low: [5.3, '15425'], mid: [7.3, '15457'], high: [10.3, '15430'] },
  velo: { low: [4.0, '01010'], mid: [6.8, '01020'], high: [10.0, '01040'] },
  natation: { low: [5.8, '18240'], mid: [8.0, '18290'], high: [9.8, '18230'] },
  marche: { low: [3.0, '17170'], mid: [3.8, '17190'], high: [4.8, '17200'] },
  yoga: { low: [2.3, '02175'], mid: [2.7, '02185'], high: [4.0, '02160'] },
  hiit: { low: [5.0, '02035'], mid: [7.0, '02210'], high: [11.0, '02214'] },
  autre: { low: [3.5, '02034'], mid: [5.5, '02060'], high: [7.5, '02040'] },
};

// Quand la distance est saisie, la vitesse réelle remplace l'intensité : [vitesse maxi en km/h, MET].
const BY_SPEED = {
  course: [[6.9, 6.5], [7.8, 7.8], [8.8, 8.5], [9.6, 9.0], [10.4, 9.3], [11, 10.5], [11.7, 11.0], [12.4, 11.8], [14, 12.0], [17, 14.8], [Infinity, 18.5]],
  velo: [[16, 4.0], [19.2, 6.8], [22.5, 8.0], [25.7, 10.0], [32, 12.0], [Infinity, 16.8]],
  marche: [[4.5, 3.0], [5.6, 3.8], [6.4, 4.8], [Infinity, 5.5]],
};

export function metFor(w) {
  const table = BY_SPEED[w.type];
  if (table && w.distance > 0 && w.duration > 0) {
    const speed = w.distance / (w.duration / 60);
    return table.find(([max]) => speed < max)[1];
  }
  const row = MET[w.type] || MET.autre;
  return (row[w.intensity] || row.mid)[0];
}

// Poids du jour de la séance : dernière pesée à cette date ou avant, sinon la toute première pesée.
export function weightOn(weights, date) {
  let before = null;
  let first = null;
  for (const r of weights) {
    if (r.date <= date && (!before || r.date > before.date || (r.date === before.date && (r.createdAt || 0) > (before.createdAt || 0)))) before = r;
    if (!first || r.date < first.date) first = r;
  }
  return (before || first)?.value ?? null;
}

export function kcal(w, weights) {
  const kg = weightOn(weights, w.date);
  if (kg == null || !(w.duration > 0)) return null;
  return Math.round(metFor(w) * kg * (w.duration / 60));
}
