// Static game data: resources, buildings, technologies, eras.

export const RES = {
  florins: { name: 'Florins', icon: '🪙', color: '#e8b730' },
  food:    { name: 'Grain',   icon: '🌾', color: '#d9b45b' },
  stone:   { name: 'Stone',   icon: '🪨', color: '#a9a29a' },
  wool:    { name: 'Wool',    icon: '🐑', color: '#efe9dc' },
  cloth:   { name: 'Cloth',   icon: '🧵', color: '#c0504d' },
  faith:   { name: 'Faith',   icon: '🕊️', color: '#9ec5e8' },
  art:     { name: 'Art',     icon: '🎨', color: '#b07cc6' },
  ideas:   { name: 'Ingegno', icon: '💡', color: '#f5e27a' },
};
export const RES_KEYS = Object.keys(RES);

export const CATEGORIES = [
  { id: 'housing',  name: 'Housing',   icon: '🏠' },
  { id: 'food',     name: 'Farms',     icon: '🌾' },
  { id: 'industry', name: 'Guilds',    icon: '⚒️' },
  { id: 'commerce', name: 'Commerce',  icon: '🪙' },
  { id: 'faith',    name: 'Faith',     icon: '⛪' },
  { id: 'culture',  name: 'Learning',  icon: '📜' },
  { id: 'civic',    name: 'Streets',   icon: '🛣️' },
  { id: 'decor',    name: 'Beauty',    icon: '🌷' },
  { id: 'landmark', name: 'Wonders',   icon: '🏛️' },
];

// Per-resident economics
export const ECON = {
  taxPerCitizen: 0.03,
  foodPerCitizen: 0.04,
  faithPerCitizen: 0.01,
  bubbleSeconds: 15,      // a collected bubble pays this many seconds of output
};

// Each copy of a building makes the next one pricier (per category, overridable per building)
export const COST_GROWTH = { housing: 1.09, food: 1.12, industry: 1.12, commerce: 1.15, faith: 1.13, culture: 1.15, civic: 1, decor: 1.04, landmark: 1 };

// Building definitions.
// prod/cons are per second at level 1. boosts: nearby target buildings get +mult.
// beauty spreads within beautyR tiles (Chebyshev distance).
const B = [
  // ── Streets ──
  { id: 'strada', name: 'Strada', cat: 'civic', size: 1, cost: { florins: 2 }, road: true, paint: true,
    desc: 'Cobbled street. Buildings beside a street work 10% better, and citizens stroll along them.' },
  { id: 'piazza', name: 'Piazza', cat: 'civic', size: 1, cost: { florins: 4, stone: 1 }, road: true, paint: true, beauty: 1, beautyR: 1,
    desc: 'Paved square. Counts as a street and adds a little beauty.' },
  { id: 'ponte', name: 'Ponte', cat: 'civic', size: 1, tech: 'ponti', cost: { florins: 30, stone: 10 }, road: true, paint: true, onWater: true, beauty: 1, beautyR: 1,
    desc: 'Stone bridge across the Arno. Must be placed on water.' },

  // ── Housing ──
  { id: 'casa', name: 'Casa', cat: 'housing', size: 1, cost: { florins: 25 }, housing: 6,
    desc: 'Modest townhouse for 6 Florentines. Residents pay taxes, more when happy and surrounded by beauty.' },
  { id: 'casaTorre', name: 'Casa-Torre', cat: 'housing', size: 1, tech: 'muratura', cost: { florins: 60, stone: 15 }, housing: 12,
    desc: 'Tall medieval tower house. Houses 12.' },
  { id: 'palazzo', name: 'Palazzo', cat: 'housing', size: 2, tech: 'urbanistica', cost: { florins: 600, stone: 150, cloth: 30 }, housing: 40, beauty: 3, beautyR: 2, prod: { art: 0.2 },
    desc: 'Patrician palace with a courtyard. Houses 40 and patronises the arts.' },

  // ── Farms ──
  { id: 'podere', name: 'Podere', cat: 'food', size: 2, cost: { florins: 40 }, workers: 4, prod: { food: 1.6 },
    desc: 'Tuscan farmstead growing grain.' },
  { id: 'granaio', name: 'Granaio', cat: 'food', size: 1, tech: 'rotazione', cost: { florins: 80, stone: 20 }, workers: 2,
    boosts: [{ targets: ['podere', 'vigna', 'mulino'], radius: 3, mult: 0.3 }],
    desc: 'Granary. Farms within 3 tiles produce +30%.' },
  { id: 'vigna', name: 'Vigna', cat: 'food', size: 2, tech: 'vigneti', cost: { florins: 120, stone: 10 }, workers: 4, prod: { food: 1.2, florins: 0.6 }, beauty: 1, beautyR: 1,
    desc: 'Chianti vineyard. Grain and wine sales.' },

  // ── Guilds / industry ──
  { id: 'pascolo', name: 'Pascolo', cat: 'industry', size: 2, cost: { florins: 35 }, workers: 2, prod: { wool: 0.6 },
    desc: 'Sheep pasture producing raw wool.' },
  { id: 'cava', name: 'Cava', cat: 'industry', size: 1, cost: { florins: 30 }, workers: 3, prod: { stone: 0.4 }, beauty: -2, beautyR: 2,
    desc: 'Stone quarry (pietra serena). Noisy and dusty: reduces nearby beauty.' },
  { id: 'lanificio', name: 'Lanificio', cat: 'industry', size: 1, tech: 'arteLana', cost: { florins: 120, stone: 20 }, workers: 6, cons: { wool: 0.6 }, prod: { cloth: 0.45 },
    desc: 'Wool workshop of the Arte della Lana. Turns wool into fine cloth.' },
  { id: 'tintoria', name: 'Tintoria', cat: 'industry', size: 1, tech: 'tintura', cost: { florins: 150, stone: 30 }, workers: 4, cons: { wool: 0.2 }, prod: { cloth: 0.2 }, beauty: -3, beautyR: 2,
    boosts: [{ targets: ['lanificio'], radius: 2, mult: 0.4 }],
    desc: 'Dye works. Lanifici within 2 tiles +40%. Smelly: keep away from homes.' },
  { id: 'mulino', name: 'Gualchiera', cat: 'industry', size: 1, tech: 'gualchiera', cost: { florins: 250, stone: 60 }, workers: 3, nearWater: true, prod: { food: 0.6 },
    boosts: [{ targets: ['lanificio', 'tintoria'], radius: 3, mult: 0.35 }],
    desc: 'Water-powered fulling mill. Must touch the river. Cloth makers within 3 tiles +35%.' },
  { id: 'setificio', name: 'Setificio', cat: 'industry', size: 1, tech: 'arteSeta', cost: { florins: 400, stone: 80, cloth: 40 }, workers: 8, cons: { florins: 0.4 }, prod: { cloth: 1.0 },
    desc: 'Silk workshop of the Arte della Seta. Luxury cloth without wool.' },

  // ── Commerce ──
  { id: 'mercato', name: 'Mercato', cat: 'commerce', size: 1, cost: { florins: 60, stone: 5 }, workers: 3, prod: { florins: 0.8 },
    boosts: [{ targets: ['casa', 'casaTorre', 'palazzo'], radius: 3, mult: 0.25 }],
    desc: 'Market stalls. Homes within 3 tiles pay +25% tax.' },
  { id: 'cambio', name: 'Banco di Cambio', cat: 'commerce', size: 1, tech: 'partita', cost: { florins: 150, stone: 20 }, workers: 3, prod: { florins: 2.0 },
    desc: 'Money-changer\'s table. Steady florins.' },
  { id: 'banca', name: 'Banca', cat: 'commerce', size: 1, tech: 'credito', cost: { florins: 500, stone: 80 }, workers: 5, prod: { florins: 5, ideas: 0.2 },
    boosts: [{ targets: ['cambio', 'mercato', 'fondaco'], radius: 3, mult: 0.3 }],
    desc: 'Merchant bank. Commerce within 3 tiles +30%.' },
  { id: 'fondaco', name: 'Fondaco', cat: 'commerce', size: 1, tech: 'fondaco', cost: { florins: 300, stone: 50 }, workers: 4, cons: { cloth: 1.0 }, prod: { florins: 6 },
    desc: 'Trading warehouse. Exports cloth across Europe for florins.' },
  { id: 'zecca', name: 'Zecca', cat: 'commerce', size: 1, tech: 'fiorino', cost: { florins: 1500, stone: 300 }, workers: 8, prod: { florins: 12 },
    desc: 'The Mint, striking the gold fiorino.' },

  // ── Faith ──
  { id: 'cappella', name: 'Cappella', cat: 'faith', size: 1, cost: { florins: 40, stone: 10 }, workers: 1, prod: { faith: 0.3 }, beauty: 1, beautyR: 2,
    desc: 'Small chapel. Faith keeps citizens content.' },
  { id: 'convento', name: 'Convento', cat: 'faith', size: 2, tech: 'mendicanti', cost: { florins: 200, stone: 60 }, workers: 4, prod: { faith: 1.2, ideas: 0.3, food: 0.3 }, beauty: 2, beautyR: 2,
    desc: 'Friary with cloister. Faith, learning and a kitchen garden.' },
  { id: 'chiesa', name: 'Chiesa', cat: 'faith', size: 2, tech: 'confraternite', cost: { florins: 500, stone: 150 }, workers: 3, prod: { faith: 3, art: 0.2 }, beauty: 3, beautyR: 3,
    desc: 'Parish church with a fine façade.' },

  // ── Learning & arts ──
  { id: 'scuola', name: 'Scuola d\'Abaco', cat: 'culture', size: 1, cost: { florins: 50, stone: 5 }, workers: 2, prod: { ideas: 0.25 },
    desc: 'Abacus school. Generates Ingegno for research.' },
  { id: 'bottega', name: 'Bottega', cat: 'culture', size: 1, tech: 'bottega', cost: { florins: 80, stone: 10 }, workers: 3, cons: { florins: 0.2 }, prod: { art: 0.3 },
    boosts: [{ targets: ['bottega'], radius: 1, mult: 0.15 }],
    desc: 'Artist\'s workshop. Neighbouring botteghe inspire each other (+15% each).' },
  { id: 'biblioteca', name: 'Biblioteca', cat: 'culture', size: 1, tech: 'umanesimo', cost: { florins: 300, stone: 60 }, workers: 3, prod: { ideas: 1.0 },
    boosts: [{ targets: ['scuola', 'accademia', 'stamperia'], radius: 3, mult: 0.3 }],
    desc: 'Humanist library. Learning within 3 tiles +30%.' },
  { id: 'accademia', name: 'Accademia', cat: 'culture', size: 2, tech: 'accademia', cost: { florins: 1000, stone: 200 }, workers: 6, prod: { ideas: 3, art: 0.5 }, beauty: 2, beautyR: 2,
    desc: 'Platonic Academy at Careggi. Great minds gather.' },
  { id: 'stamperia', name: 'Stamperia', cat: 'culture', size: 1, tech: 'stampa', cost: { florins: 1500, stone: 200, cloth: 100 }, workers: 6, cons: { cloth: 0.3 }, prod: { ideas: 5 },
    desc: 'Printing press. Rag paper from cloth becomes knowledge.' },
  { id: 'ospedale', name: 'Ospedale', cat: 'civic', size: 2, growth: 1.25, tech: 'innocenti', cost: { florins: 600, stone: 150 }, workers: 4, prod: { faith: 0.5 }, happy: 6, beauty: 2, beautyR: 2,
    desc: 'Foundling hospital with Brunelleschi\'s loggia. +6 happiness city-wide.' },

  // ── Beauty ──
  { id: 'cipresso', name: 'Cipresso', cat: 'decor', size: 1, cost: { florins: 5 }, beauty: 1, beautyR: 2, paint: true,
    desc: 'Tuscan cypress. +1 beauty around it.' },
  { id: 'giardino', name: 'Giardino', cat: 'decor', size: 1, cost: { florins: 12 }, beauty: 2, beautyR: 2, paint: true,
    desc: 'Formal garden of box hedges and roses. +2 beauty.' },
  { id: 'fontana', name: 'Fontana', cat: 'decor', size: 1, tech: 'acquedotti', cost: { florins: 80, stone: 20 }, beauty: 4, beautyR: 3, happy: 1,
    desc: 'Public fountain. +4 beauty in a wide radius.' },
  { id: 'statua', name: 'Statua', cat: 'decor', size: 1, tech: 'prospettiva', cost: { florins: 150, stone: 30, art: 20 }, beauty: 6, beautyR: 3, prestige: 20,
    desc: 'Marble statue in the antique manner. +6 beauty.' },
  { id: 'loggia', name: 'Loggia', cat: 'decor', size: 2, tech: 'argano', cost: { florins: 400, stone: 120 }, prod: { art: 0.3 }, beauty: 8, beautyR: 4, prestige: 50,
    desc: 'Open arcade for ceremonies and sculpture. +8 beauty.' },

  // ── Wonders (unique) ──
  { id: 'palazzoVecchio', name: 'Palazzo della Signoria', cat: 'landmark', size: 2, unique: true, hidden: true, cost: {}, prod: { florins: 1, ideas: 0.3 }, beauty: 3, beautyR: 3,
    desc: 'Seat of the Republic. The heart of your Florence.' },
  { id: 'orsanmichele', name: 'Orsanmichele', cat: 'landmark', size: 2, unique: true, tech: 'guildHall', cost: { florins: 4000, stone: 600, cloth: 300 }, workers: 2, prod: { art: 1.5 }, global: { cloth: 0.25 }, prestige: 300, beauty: 4, beautyR: 3,
    desc: 'Guild church and granary. All cloth +25%.' },
  { id: 'santaCroce', name: 'Santa Croce', cat: 'landmark', size: 2, unique: true, tech: 'santacroce', cost: { florins: 3000, stone: 600, faith: 250 }, workers: 2, prod: { faith: 4, art: 1 }, prestige: 300, beauty: 5, beautyR: 3,
    desc: 'Great Franciscan basilica.' },
  { id: 'battistero', name: 'Battistero', cat: 'landmark', size: 2, unique: true, tech: 'portadoro', cost: { florins: 8000, stone: 1200, faith: 600, art: 400 }, workers: 2, prod: { faith: 3, art: 3 }, prestige: 600, beauty: 6, beautyR: 3,
    desc: 'Octagonal baptistery with Ghiberti\'s Gates of Paradise.' },
  { id: 'campanile', name: 'Campanile di Giotto', cat: 'landmark', size: 1, unique: true, tech: 'concilio', cost: { florins: 15000, stone: 2000, art: 800 }, prestige: 800, beauty: 8, beautyR: 4, happy: 5,
    desc: 'Slender marble bell tower. +5 happiness.' },
  { id: 'pontevecchio', name: 'Ponte Vecchio', cat: 'landmark', size: 1, unique: true, tech: 'pontevecchio', onWater: true, road: true, cost: { florins: 6000, stone: 1000, cloth: 400 }, workers: 4, prod: { florins: 8, art: 1 }, prestige: 500, beauty: 4, beautyR: 2,
    desc: 'Bridge lined with goldsmiths\' shops. Must be on the Arno.' },
  { id: 'palazzoMedici', name: 'Palazzo Medici', cat: 'landmark', size: 2, unique: true, tech: 'bancoMedici', cost: { florins: 40000, stone: 4000, art: 2500 }, workers: 4, prod: { florins: 15, art: 3, ideas: 2 }, global: { florins: 0.1 }, prestige: 1500, beauty: 5, beautyR: 3,
    desc: 'Michelozzo\'s palace for Cosimo. All florins +10%.' },
  { id: 'uffizi', name: 'Uffizi', cat: 'landmark', size: 2, unique: true, tech: 'uffiziT', cost: { florins: 120000, stone: 10000, art: 12000 }, workers: 6, prod: { art: 10 }, prestige: 3000, beauty: 6, beautyR: 3,
    desc: 'Vasari\'s offices, soon the greatest gallery in the world.' },
  { id: 'duomo', name: 'Santa Maria del Fiore', cat: 'landmark', size: 3, unique: true, tech: 'cupola', cost: { florins: 150000, stone: 25000, faith: 10000, art: 10000 }, workers: 6, prod: { faith: 10, art: 8 }, prestige: 8000, beauty: 10, beautyR: 5, happy: 10,
    desc: 'The Cathedral, crowned by Brunelleschi\'s impossible dome.' },
  { id: 'palazzoPitti', name: 'Palazzo Pitti', cat: 'landmark', size: 3, unique: true, tech: 'boboli', cost: { florins: 140000, stone: 15000, cloth: 5000, art: 8000 }, housing: 80, prod: { art: 5 }, prestige: 5000, beauty: 8, beautyR: 4,
    desc: 'Grand-ducal palace with the Boboli Gardens. Houses 80.' },
  { id: 'leonardo', name: 'Studio di Leonardo', cat: 'landmark', size: 1, unique: true, tech: 'vinci', cost: { florins: 100000, stone: 6000, art: 15000 }, workers: 2, prod: { ideas: 12, art: 6 }, prestige: 4000, beauty: 3, beautyR: 2,
    desc: 'Workshop of the universal genius.' },
];

export const BUILDINGS = {};
for (const b of B) {
  b.workers ??= 0; b.housing ??= 0; b.beauty ??= 0; b.beautyR ??= 0; b.prod ??= {}; b.cons ??= {};
  b.happy ??= 0; b.prestige ??= 0; b.boosts ??= [];
  b.growth ??= COST_GROWTH[b.cat];
  BUILDINGS[b.id] = b;
}
export const BUILDING_LIST = B;
export const LANDMARKS = B.filter(b => b.cat === 'landmark' && !b.hidden).map(b => b.id);

// ── Technology tree ──
export const BRANCHES = [
  { id: 'C', name: 'Commerce',    icon: '🪙', color: '#d9a62e' },
  { id: 'G', name: 'Guilds',      icon: '🧵', color: '#c0504d' },
  { id: 'L', name: 'Land & City', icon: '🌾', color: '#7aa64b' },
  { id: 'F', name: 'Faith',       icon: '🕊️', color: '#6f9fd8' },
  { id: 'A', name: 'Humanism',    icon: '🎨', color: '#a06cc0' },
  { id: 'E', name: 'Engineering', icon: '📐', color: '#8b8178' },
];

// tier → base Ingegno cost; florins cost is 3×
export const TIER_COST = [0, 15, 60, 240, 800, 2500, 7000];
// tier → era required
export const TIER_ERA = [0, 1, 1, 2, 2, 3, 4];

// Effects: unlock (building ids), mult (global resource multiplier add), bmult (per building add),
// costMult (resource cost multiplier), happy (flat happiness)
const T = [
  // Commerce
  { id: 'partita', branch: 'C', tier: 1, name: 'Double-Entry Bookkeeping', unlock: ['cambio'], bmult: { mercato: 0.2 }, desc: 'Luca Pacioli would be proud. Markets +20%.' },
  { id: 'credito', branch: 'C', tier: 2, name: 'Letters of Credit', req: ['partita'], unlock: ['banca'], desc: 'Move money without moving gold.' },
  { id: 'fondaco', branch: 'C', tier: 3, name: 'Merchant Fondaci', req: ['credito', 'arteLana'], unlock: ['fondaco'], desc: 'Export Florentine cloth to Bruges and London.' },
  { id: 'fiorino', branch: 'C', tier: 4, name: 'The Gold Florin', req: ['fondaco'], unlock: ['zecca'], mult: { florins: 0.15 }, desc: 'The dollar of the Middle Ages. Florins +15%.' },
  { id: 'bancoMedici', branch: 'C', tier: 5, name: 'The Medici Bank', req: ['fiorino'], unlock: ['palazzoMedici'], bmult: { banca: 0.5 }, desc: 'Branches from Rome to London. Banks +50%.' },
  { id: 'papale', branch: 'C', tier: 6, name: 'Bankers to the Pope', req: ['bancoMedici'], mult: { florins: 0.25 }, desc: 'Hold the Papal accounts. Florins +25%.' },
  // Guilds
  { id: 'arteLana', branch: 'G', tier: 1, name: 'Arte della Lana', unlock: ['lanificio'], desc: 'Charter the powerful wool guild.' },
  { id: 'tintura', branch: 'G', tier: 2, name: 'Dyers\' Secrets', req: ['arteLana'], unlock: ['tintoria'], mult: { wool: 0.15 }, desc: 'Kermes red and woad blue. Wool +15%.' },
  { id: 'gualchiera', branch: 'G', tier: 3, name: 'Fulling Mills', req: ['tintura', 'ponti'], unlock: ['mulino'], desc: 'Harness the Arno to pound cloth.' },
  { id: 'arteSeta', branch: 'G', tier: 4, name: 'Arte della Seta', req: ['gualchiera'], unlock: ['setificio'], desc: 'Silk brocades for the courts of Europe.' },
  { id: 'guildHall', branch: 'G', tier: 5, name: 'Guild Patronage', req: ['arteSeta'], unlock: ['orsanmichele'], mult: { cloth: 0.25 }, desc: 'Guilds commission statues for Orsanmichele. Cloth +25%.' },
  { id: 'telai', branch: 'G', tier: 6, name: 'Leonardo\'s Looms', req: ['guildHall'], mult: { cloth: 0.5, wool: 0.3 }, desc: 'Mechanised weaving. Cloth +50%, wool +30%.' },
  // Land & City
  { id: 'rotazione', branch: 'L', tier: 1, name: 'Crop Rotation', unlock: ['granaio'], mult: { food: 0.25 }, desc: 'Fallow fields no more. Grain +25%.' },
  { id: 'vigneti', branch: 'L', tier: 2, name: 'Chianti Vineyards', req: ['rotazione'], unlock: ['vigna'], desc: 'Wine from the hills between Florence and Siena.' },
  { id: 'acquedotti', branch: 'L', tier: 3, name: 'Aqueducts', req: ['vigneti'], unlock: ['fontana'], happy: 3, desc: 'Fresh water for public fountains. +3 happiness.' },
  { id: 'innocenti', branch: 'L', tier: 4, name: 'Foundling Hospital', req: ['acquedotti', 'mendicanti'], unlock: ['ospedale'], desc: 'Charity becomes architecture.' },
  { id: 'urbanistica', branch: 'L', tier: 5, name: 'The Ideal City', req: ['innocenti'], unlock: ['palazzo'], happy: 5, desc: 'Alberti\'s principles of urban design. +5 happiness.' },
  { id: 'boboli', branch: 'L', tier: 6, name: 'Boboli Gardens', req: ['urbanistica', 'accademia'], unlock: ['palazzoPitti'], happy: 5, desc: 'The garden as open-air museum.' },
  // Faith
  { id: 'mendicanti', branch: 'F', tier: 1, name: 'Mendicant Orders', unlock: ['convento'], desc: 'Franciscans and Dominicans arrive.' },
  { id: 'confraternite', branch: 'F', tier: 2, name: 'Confraternities', req: ['mendicanti'], unlock: ['chiesa'], mult: { faith: 0.5 }, desc: 'Lay brotherhoods. Faith +50%.' },
  { id: 'santacroce', branch: 'F', tier: 3, name: 'Franciscan Basilica', req: ['confraternite'], unlock: ['santaCroce'], desc: 'Raise Santa Croce, pantheon of Florence.' },
  { id: 'portadoro', branch: 'F', tier: 4, name: 'Gates of Paradise', req: ['santacroce', 'prospettiva'], unlock: ['battistero'], desc: 'Ghiberti\'s gilded bronze doors.' },
  { id: 'concilio', branch: 'F', tier: 5, name: 'Council of Florence', req: ['portadoro'], unlock: ['campanile'], mult: { faith: 0.5 }, happy: 3, desc: 'East and West meet in your city. Faith +50%.' },
  { id: 'sistina', branch: 'F', tier: 6, name: 'A Medici Pope', req: ['concilio'], mult: { faith: 1, art: 0.2 }, desc: 'Leo X ascends. Faith +100%, Art +20%.' },
  // Humanism
  { id: 'bottega', branch: 'A', tier: 1, name: 'Workshop Tradition', unlock: ['bottega'], desc: 'Masters take apprentices. Unlocks the Bottega.' },
  { id: 'umanesimo', branch: 'A', tier: 2, name: 'Humanism', req: ['bottega'], unlock: ['biblioteca'], mult: { ideas: 0.2 }, desc: 'Petrarch\'s heirs revive the ancients. Ingegno +20%.' },
  { id: 'prospettiva', branch: 'A', tier: 3, name: 'Linear Perspective', req: ['umanesimo'], unlock: ['statua'], mult: { art: 0.3 }, desc: 'Brunelleschi\'s mirror experiment. Art +30%.' },
  { id: 'accademia', branch: 'A', tier: 4, name: 'Platonic Academy', req: ['prospettiva'], unlock: ['accademia'], desc: 'Ficino translates Plato under Cosimo\'s roof.' },
  { id: 'stampa', branch: 'A', tier: 5, name: 'Printing Press', req: ['accademia'], unlock: ['stamperia'], mult: { ideas: 0.3 }, desc: 'Movable type reaches Florence. Ingegno +30%.' },
  { id: 'uffiziT', branch: 'A', tier: 6, name: 'Vasari\'s Gallery', req: ['stampa', 'bancoMedici'], unlock: ['uffizi'], mult: { art: 0.5 }, desc: 'Art history is born. Art +50%.' },
  // Engineering
  { id: 'muratura', branch: 'E', tier: 1, name: 'Masonry', unlock: ['casaTorre'], mult: { stone: 0.25 }, desc: 'Pietra forte and pietra serena. Stone +25%.' },
  { id: 'ponti', branch: 'E', tier: 2, name: 'Bridge Building', req: ['muratura'], unlock: ['ponte'], desc: 'Span the Arno.' },
  { id: 'argano', branch: 'E', tier: 3, name: 'Brunelleschi\'s Hoist', req: ['ponti'], unlock: ['loggia'], costMult: { stone: -0.2 }, desc: 'Ox-driven reversible hoist. Stone costs −20%.' },
  { id: 'pontevecchio', branch: 'E', tier: 4, name: 'Shops on the Bridge', req: ['argano'], unlock: ['pontevecchio'], desc: 'Butchers out, goldsmiths in.' },
  { id: 'cupola', branch: 'E', tier: 5, name: 'The Great Dome', req: ['pontevecchio', 'santacroce'], unlock: ['duomo'], desc: 'Herringbone brickwork, no centering. Impossible made real.' },
  { id: 'vinci', branch: 'E', tier: 6, name: 'Da Vinci\'s Notebooks', req: ['cupola', 'stampa'], unlock: ['leonardo'], mult: { ideas: 0.3, stone: 0.3 }, desc: 'Flying machines and canal locks. Ingegno and stone +30%.' },
];

export const TECHS = {};
for (const t of T) {
  t.req ??= []; t.unlock ??= []; t.mult ??= {}; t.bmult ??= {}; t.costMult ??= {}; t.happy ??= 0;
  t.cost = { ideas: TIER_COST[t.tier], florins: TIER_COST[t.tier] * 3 };
  t.era = TIER_ERA[t.tier];
  TECHS[t.id] = t;
}
export const TECH_LIST = T;

export const ERAS = [
  null,
  { n: 1, name: 'Trecento', sub: 'A Republic of Merchants', prestige: 0, pop: 0 },
  { n: 2, name: 'Early Quattrocento', sub: 'The Dawn of the Renaissance', prestige: 300, pop: 60,
    text: 'Brunelleschi, Donatello and Masaccio walk your streets. New ideas are within reach.' },
  { n: 3, name: 'High Renaissance', sub: 'The Age of Lorenzo il Magnifico', prestige: 4000, pop: 300,
    text: 'Florence is the envy of Italy. Botticelli paints, Ficino teaches, the Medici bank lends to kings.' },
  { n: 4, name: 'Medici Golden Age', sub: 'Gloria di Firenze', prestige: 25000, pop: 700,
    text: 'Leonardo and Michelangelo come of age. Only the greatest wonders remain to be built.' },
];

export const PATRONS = {
  housing: 'The Priori', food: 'The Contadini', industry: 'Arte della Lana', commerce: 'Cosimo de\' Medici',
  faith: 'The Archbishop', culture: 'Marsilio Ficino', civic: 'The Signoria', decor: 'Lorenzo il Magnifico',
  landmark: 'The Opera del Duomo',
};
