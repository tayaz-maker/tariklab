// Original HANEDANIAN rules. No network, clock or presentation dependencies.
export const SCHEMA_VERSION = 1;
export const RESOURCES = {
  food: { label: 'Erzak', icon: '◒', color: '#d5b96b' },
  wood: { label: 'Kereste', icon: '♣', color: '#8fa783' },
  stone: { label: 'Taş', icon: '◆', color: '#b5b2a3' },
  iron: { label: 'Demir', icon: '⬟', color: '#b08b75' },
};
export const TERRAINS = {
  plain: { label: 'Bereketli ova', color: '#9fa779', rates: [1.6, 0.8, 0.8, 0.7], defense: 1, movement: 1, description: 'Erzak üretimi güçlü. Yeni bir tarım merkezi için uygun.' },
  forest: { label: 'Sedir ormanı', color: '#526e59', rates: [0.8, 1.8, 0.8, 0.7], defense: 1.2, movement: 1.4, description: 'Kereste bol; orman savunmayı güçlendirir, yürüyüşü yavaşlatır.' },
  mountain: { label: 'Taşlık dağ', color: '#929087', rates: [0.6, 0.6, 1.9, 1.2], defense: 1.5, movement: 1.8, description: 'Taş ve savunma avantajı. Erzak ve seyahat maliyeti yüksek.' },
  ore: { label: 'Demir sırtı', color: '#a08370', rates: [0.7, 0.7, 1.1, 2], defense: 1.2, movement: 1.3, description: 'Demir ordunun omurgasıdır. Bu merkez erzak desteği ister.' },
  valley: { label: 'Nehir vadisi', color: '#7f9c90', rates: [1.7, 1.2, 0.7, 0.6], defense: 1.05, movement: 1.05, description: 'Su, erzak ve kereste sağlar. Bütün nehir geçişleri yürünebilir.' },
  road: { label: 'Kervan yolu', color: '#b4a381', rates: [1, 1, 1, 1], defense: 0.95, movement: 0.65, description: 'Birlikler ve kervanlar hızlanır. Ticaret merkezi için uygun.' },
  pass: { label: 'Dağ geçidi', color: '#9b988c', rates: [0.7, 0.7, 1.6, 1.3], defense: 1.65, movement: 0.8, description: 'Dağlar arasında hızlı ve savunulabilir geçiş.' },
  arid: { label: 'Kıraç yamaç', color: '#b8a37d', rates: [0.55, 0.65, 1.4, 1.6], defense: 1.15, movement: 1.2, description: 'Kıt erzak karşılığında taş ve demir. Lojistik gerekir.' },
  steppe: { label: 'Bozkır', color: '#b2ad84', rates: [1.2, 0.7, 0.9, 0.9], defense: 1, movement: 0.85, description: 'Hızlı hareket, dengeli gelişim; sınır yerleşimi için elverişli.' },
};
export const POIS = {
  pasture: { label: 'Serin yayla', icon: '❧', resource: 'food', bonus: 0.35, guard: 18, description: 'Bağlı yerleşime %35 erzak üretimi.' },
  iron: { label: 'Kızıl damar', icon: '⬟', resource: 'iron', bonus: 0.4, guard: 30, description: 'Bağlı yerleşime %40 demir üretimi.' },
  forest: { label: 'Kadim sedirlik', icon: '♣', resource: 'wood', bonus: 0.35, guard: 20, description: 'Bağlı yerleşime %35 kereste üretimi.' },
  quarry: { label: 'Beyaz taş ocağı', icon: '◆', resource: 'stone', bonus: 0.35, guard: 22, description: 'Bağlı yerleşime %35 taş üretimi.' },
  caravanserai: { label: 'Yedi Kapı Hanı', icon: '▥', resource: null, bonus: 0.5, guard: 25, description: 'Kervan kapasitesi %50 ve ticaret geliri %10 artar.' },
  pass: { label: 'Kilit geçit', icon: '⋈', resource: null, bonus: 0.15, guard: 32, description: 'Bağlı yerleşimden çıkan birliklerin yolculuğu %15 kısalır.' },
  watchtower: { label: 'Gözetleme tepesi', icon: '⌖', resource: null, bonus: 5, guard: 20, description: 'Çevresindeki 12 karoda yabancı birlikleri görür.' },
  ruins: { label: 'Sessiz divan', icon: '♜', resource: null, bonus: 15, guard: 38, description: 'İlk keşifte 15 nüfuz ve hanedan deneyimi verir.' },
};
export const BUILDINGS = {
  farm: { label: 'Ambar tarlaları', description: 'Erzak üretir. Askerlerin iaşesi buradan karşılanır.', baseCost: [25, 55, 30, 10], minutes: 30, maxLevel: 12 },
  lumber: { label: 'Sedir atölyesi', description: 'Yapı ve kervanlar için kereste üretir.', baseCost: [35, 25, 40, 10], minutes: 35, maxLevel: 12 },
  quarry: { label: 'Taş işliği', description: 'Surlar ve büyük yapılar için taş üretir.', baseCost: [30, 50, 20, 15], minutes: 40, maxLevel: 12 },
  mine: { label: 'Demir ocağı', description: 'Teçhizat ve gelişmiş yapılar için demir üretir.', baseCost: [40, 55, 50, 10], minutes: 45, maxLevel: 12 },
  warehouse: { label: 'Depolar', description: 'Her kaynak için depolama sınırını 600 artırır.', baseCost: [25, 75, 65, 20], minutes: 50, maxLevel: 12 },
  barracks: { label: 'Talimgâh', description: 'Seviye 1: milis, mızraklı, gözcü; 2: okçu; 3: atlı; 4: kuşatma.', baseCost: [70, 85, 60, 45], minutes: 60, maxLevel: 8 },
  wall: { label: 'Sınır suru', description: 'Her seviyede savunmayı %15 artırır; kuşatma hasarını sınırlar.', baseCost: [15, 55, 110, 25], minutes: 65, maxLevel: 8 },
  market: { label: 'Kervan avlusu', description: 'Dost yerleşimlere mal taşır; mesafeye bağlı ticaret primi kazanır.', baseCost: [50, 100, 75, 30], minutes: 60, maxLevel: 8 },
  hall: { label: 'Hanedan konağı', description: 'Genişleme menzilini, inşa hızını ve siyasi ağı artırır.', baseCost: [90, 120, 100, 55], minutes: 80, maxLevel: 8 },
};
export const UNITS = {
  militia: { label: 'Milis', attack: 7, defense: 9, speed: 1, upkeep: 0.012, carry: 12, cost: [18, 10, 0, 2], minutes: 4, barracks: 1 },
  spear: { label: 'Mızraklı', attack: 10, defense: 17, speed: 0.95, upkeep: 0.016, carry: 14, cost: [22, 15, 0, 9], minutes: 6, barracks: 1 },
  archer: { label: 'Okçu', attack: 18, defense: 11, speed: 1.05, upkeep: 0.02, carry: 10, cost: [26, 28, 0, 8], minutes: 7, barracks: 2 },
  rider: { label: 'Atlı', attack: 32, defense: 20, speed: 1.9, upkeep: 0.05, carry: 35, cost: [55, 20, 0, 28], minutes: 12, barracks: 3 },
  scout: { label: 'Gözcü', attack: 2, defense: 3, speed: 2.3, upkeep: 0.015, carry: 3, cost: [25, 15, 0, 5], minutes: 6, barracks: 1 },
  siege: { label: 'Koçbaşı', attack: 55, defense: 9, speed: 0.5, upkeep: 0.06, carry: 0, cost: [45, 70, 30, 35], minutes: 18, barracks: 4 },
};
export const VICTORY_PATHS = { dominion: 'Hâkimiyet', wealth: 'Zenginlik', dynasty: 'Hanedan' };
export const FACTION_PRESETS = [
  ['Sedirli', '#a8bd83', 'merchant', 'Tüccar'], ['Karakaya', '#b49dcc', 'fortress', 'Kale beyi'],
  ['Kızılbörk', '#d98c7c', 'raider', 'Akıncı'], ['Turnayurt', '#7eafbe', 'expansionist', 'Yayılmacı'],
  ['Bozkandil', '#d3b367', 'opportunist', 'Fırsatçı'], ['Alazhan', '#ca92af', 'ambitious', 'Hırslı'],
  ['Akarsu', '#78b5a1', 'merchant', 'Tüccar'], ['Taşkılıç', '#a9a6cc', 'fortress', 'Kale beyi'],
  ['Gökserçe', '#9db6d4', 'expansionist', 'Yayılmacı'], ['Akkor', '#dba77c', 'opportunist', 'Fırsatçı'],
];
export const LIMITS = { settlements: 96, perFaction: 12, armies: 160, queue: 6, troops: 5000, reports: 180, resource: 100000, influence: 9999, time: 100000000 };
export const resourceObject = (values = [0, 0, 0, 0]) => Object.fromEntries(Object.keys(RESOURCES).map((key, i) => [key, values[i] || 0]));
export const troopObject = () => Object.fromEntries(Object.keys(UNITS).map(key => [key, 0]));
