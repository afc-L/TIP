'use strict';
MB.TYPES = ['Normal', 'Flame', 'Aqua', 'Nature', 'Electric', 'Earth', 'Wind', 'Ice', 'Shadow', 'Light', 'Metal', 'Psychic', 'Venom', 'Dragon', 'Spirit'];
MB.TYPE_COLORS = {
  Normal: '#a8a290', Flame: '#ee6a2c', Aqua: '#3b8ee8', Nature: '#5cb84a', Electric: '#f2c12e', Earth: '#b8874a', Wind: '#8fc8e6',
  Ice: '#86dde0', Shadow: '#5a4a78', Light: '#f5e7a0', Metal: '#9aa6b4', Psychic: '#e65c9c', Venom: '#9a4cc2', Dragon: '#6a5ae6', Spirit: '#7f8fd6',
};
// chart[attacker][defender] = multiplier (missing = 1)
MB.TYPE_CHART = {
  Normal: { Metal: 0.5, Spirit: 0 },
  Flame: { Nature: 2, Ice: 2, Metal: 2, Venom: 2, Aqua: 0.5, Earth: 0.5, Flame: 0.5, Dragon: 0.5 },
  Aqua: { Flame: 2, Earth: 2, Metal: 2, Aqua: 0.5, Nature: 0.5, Dragon: 0.5, Ice: 0.5 },
  Nature: { Aqua: 2, Earth: 2, Light: 2, Flame: 0.5, Nature: 0.5, Venom: 0.5, Wind: 0.5, Metal: 0.5, Dragon: 0.5 },
  Electric: { Aqua: 2, Wind: 2, Metal: 2, Electric: 0.5, Nature: 0.5, Dragon: 0.5, Earth: 0 },
  Earth: { Flame: 2, Electric: 2, Venom: 2, Metal: 2, Nature: 0.5, Ice: 0.5, Wind: 0 },
  Wind: { Nature: 2, Venom: 2, Earth: 2, Electric: 0.5, Metal: 0.5, Ice: 0.5 },
  Ice: { Nature: 2, Earth: 2, Wind: 2, Dragon: 2, Flame: 0.5, Aqua: 0.5, Ice: 0.5, Metal: 0.5 },
  Shadow: { Psychic: 2, Spirit: 2, Light: 0.5, Shadow: 0.5, Normal: 0.5 },
  Light: { Shadow: 2, Dragon: 2, Venom: 2, Metal: 0.5, Flame: 0.5, Light: 0.5 },
  Metal: { Ice: 2, Light: 2, Earth: 2, Flame: 0.5, Aqua: 0.5, Electric: 0.5, Metal: 0.5 },
  Psychic: { Venom: 2, Normal: 2, Spirit: 0.5, Psychic: 0.5, Metal: 0.5, Shadow: 0 },
  Venom: { Nature: 2, Light: 2, Venom: 0.5, Earth: 0.5, Spirit: 0.5, Metal: 0 },
  Dragon: { Dragon: 2, Wind: 2, Metal: 0.5, Light: 0 },
  Spirit: { Spirit: 2, Psychic: 2, Shadow: 0.5, Normal: 0 },
};
MB.typeEff = function (atkType, defTypes) {
  let m = 1;
  const row = MB.TYPE_CHART[atkType] || {};
  for (const t of defTypes) if (t && row[t] !== undefined) m *= row[t];
  return m;
};
