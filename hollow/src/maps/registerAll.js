// Registers the remaining maps.
import { registerMap } from './index.js';
import { buildForest } from './forest.js';
import { buildCity } from './city.js';
import { buildHospital } from './hospital.js';
import { buildOther } from './other.js';

registerMap('forest', { order: 2, title: 'Blackpine', sub: 'Dense Forest', desc: 'Pines, fog, a black lake and trails that loop back on themselves.', build: buildForest });
registerMap('city', { order: 3, title: 'Harrow City', sub: 'Downtown', desc: 'Rain, neon and crowds. So many of them, and so much light.', build: buildCity });
registerMap('hospital', { order: 4, title: "St. Aldric's", sub: 'Abandoned Hospital', desc: 'Closed in 1994. The PA system still works. It should not.', build: buildHospital });
registerMap('other', { order: 5, title: 'The Other Side', sub: '???', desc: 'Everything you remember, in the wrong places.', build: buildOther });
