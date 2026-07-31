export const ERAS = [
  {
    id: 0, name: 'Первобытность', short: 'Перв.',
    knowledgeReq: 0, popReq: 0,
    buildings: ['shack', 'hunterHut'],
  },
  {
    id: 1, name: 'Каменный век', short: 'Кам.',
    knowledgeReq: 15, popReq: 0,
    buildings: ['hut', 'storage', 'sawmill', 'dock'],
  },
  {
    id: 2, name: 'Бронзовый век', short: 'Бронз.',
    knowledgeReq: 90, popReq: 4,
    buildings: ['house', 'farm', 'well', 'granary', 'mill'],
  },
  {
    id: 3, name: 'Железный век', short: 'Жел.',
    knowledgeReq: 260, popReq: 8,
    buildings: ['forge', 'wall', 'barracks', 'library', 'bakery', 'workshop'],
    military: { unit: 'spearman', power: 1 },
  },
  {
    id: 4, name: 'Средневековье', short: 'Средн.',
    knowledgeReq: 600, popReq: 14,
    buildings: ['castle', 'market', 'church', 'school'],
    military: { unit: 'knight', power: 2.2 },
  },
  {
    id: 5, name: 'Индустриальная эпоха', short: 'Индустр.',
    knowledgeReq: 1400, popReq: 22,
    buildings: ['factory', 'mine', 'railway'],
    military: { unit: 'rifleman', power: 4 },
  },
  {
    id: 6, name: 'Современная эпоха', short: 'Соврем.',
    knowledgeReq: 2800, popReq: 32,
    buildings: ['refinery', 'laboratory', 'tank factory'],
    military: { unit: 'танк', power: 9 },
  },
];

export function eraForSettlement(knowledge, population) {
  let era = 0;
  for (let i = ERAS.length - 1; i >= 0; i--) {
    if (knowledge >= ERAS[i].knowledgeReq && population >= ERAS[i].popReq) { era = i; break; }
  }
  return era;
}

export const HOUSING_TYPES = ['shack', 'hut', 'house', 'castle'];

// Storage is finite: goods (wood/stone/ore/tools/clothes) are capped by how
// much 'storage' the settlement has built, food (grain/flour/bread/meat/fish)
// by 'granary' (plus a little from storage too). Both can be built more than
// once — each extra one raises the ceiling instead of sitting unused.
export const MAX_STORAGE_BUILDINGS = 3;
export const GOODS_KEYS = ['wood', 'stone', 'ore', 'tools', 'clothes'];
export const FOOD_KEYS = ['grain', 'flour', 'bread', 'meat', 'fish'];

export function storageCapacity(settlement) {
  const storageCount = settlement.buildings.filter(b => b.type === 'storage').length;
  const granaryCount = settlement.buildings.filter(b => b.type === 'granary').length;
  return {
    goods: 60 + storageCount * 110,
    food: 60 + granaryCount * 110 + storageCount * 40,
  };
}

export function capFor(settlement, key) {
  const cap = storageCapacity(settlement);
  return GOODS_KEYS.includes(key) ? cap.goods : cap.food;
}

export const RESOURCE_LABEL = {
  wood: 'дерево', stone: 'камень', ore: 'руда', tools: 'инструменты', clothes: 'одежда',
  grain: 'зерно', flour: 'мука', bread: 'хлеб', meat: 'мясо', fish: 'рыба', knowledge: 'знания',
};

export const BUILDING_INFO = {
  shack: { label: 'Шалаш', cost: { wood: 6 }, laborCost: 4, cap: 2, icon: '⛺' },
  hut: { label: 'Хижина', cost: { wood: 14 }, laborCost: 8, cap: 4, icon: '🛖' },
  storage: { label: 'Склад', cost: { wood: 10 }, laborCost: 6, cap: 0, icon: '📦' },
  house: { label: 'Дом', cost: { wood: 20, stone: 10 }, laborCost: 14, cap: 5, icon: '🏠' },
  farm: { label: 'Ферма', cost: { wood: 16 }, laborCost: 10, cap: 0, icon: '🌾' },
  well: { label: 'Колодец', cost: { stone: 12 }, laborCost: 8, cap: 0, icon: '🪣' },
  hunterHut: { label: 'Хижина охотника', cost: { wood: 10 }, laborCost: 6, cap: 0, icon: '🏹' },
  sawmill: { label: 'Лесопилка', cost: { wood: 14, stone: 6 }, laborCost: 10, cap: 0, icon: '🪚' },
  granary: { label: 'Амбар', cost: { wood: 16, stone: 8 }, laborCost: 10, cap: 0, icon: '🌽' },
  dock: { label: 'Причал', cost: { wood: 14 }, laborCost: 8, cap: 0, icon: '⚓' },
  mill: { label: 'Мельница', cost: { wood: 18, stone: 6 }, laborCost: 12, cap: 0, icon: '🌬️' },
  bakery: { label: 'Пекарня', cost: { wood: 16, stone: 10 }, laborCost: 12, cap: 0, icon: '🍞' },
  workshop: { label: 'Мастерская', cost: { wood: 20, stone: 10 }, laborCost: 14, cap: 0, icon: '🧵' },
  forge: { label: 'Кузница', cost: { wood: 16, stone: 20 }, laborCost: 16, cap: 0, icon: '⚒️' },
  wall: { label: 'Стена', cost: { stone: 30 }, laborCost: 18, cap: 0, icon: '🧱' },
  barracks: { label: 'Казармы', cost: { wood: 24, stone: 16 }, laborCost: 16, cap: 0, icon: '🪖' },
  library: { label: 'Библиотека', cost: { wood: 20, stone: 16 }, laborCost: 16, cap: 0, icon: '📚' },
  castle: { label: 'Замок', cost: { stone: 60, wood: 20 }, laborCost: 30, cap: 8, icon: '🏰' },
  market: { label: 'Рынок', cost: { wood: 24, stone: 10 }, laborCost: 14, cap: 0, icon: '🏪' },
  church: { label: 'Храм', cost: { stone: 30, wood: 10 }, laborCost: 16, cap: 0, icon: '⛪' },
  school: { label: 'Школа', cost: { wood: 24, stone: 20 }, laborCost: 18, cap: 0, icon: '🏫' },
  factory: { label: 'Завод', cost: { stone: 50, ore: 40 }, laborCost: 26, cap: 0, icon: '🏭' },
  mine: { label: 'Шахта', cost: { wood: 20, stone: 20 }, laborCost: 18, cap: 0, icon: '⛏️' },
  railway: { label: 'Железная дорога', cost: { ore: 40, wood: 30 }, laborCost: 24, cap: 0, icon: '🚂' },
  refinery: { label: 'Нефтезавод', cost: { ore: 60, stone: 40 }, laborCost: 30, cap: 0, icon: '🛢️' },
  laboratory: { label: 'Лаборатория', cost: { ore: 40, stone: 30 }, laborCost: 26, cap: 0, icon: '🧪' },
  'tank factory': { label: 'Танковый завод', cost: { ore: 100, stone: 60 }, laborCost: 40, cap: 0, icon: '🎖️' },
};

export const BUILDING_DESC = {
  shack: 'Первое временное жильё поселенцев.',
  hut: 'Более крепкое жильё для растущей семьи.',
  storage: 'Хранит запасы дерева, камня, руды, инструментов и одежды. Можно построить ещё, если склад переполнен.',
  house: 'Просторный дом на несколько семей.',
  farm: 'Повышает урожай земледельцев на 30%.',
  well: 'Чистая вода замедляет голод жителей.',
  hunterHut: 'Охотники приносят дополнительную еду из леса.',
  sawmill: 'Ускоряет заготовку дерева и позволяет дровосекам сажать новые деревья.',
  granary: 'Хранит больше еды и снижает её потребление жителями. Можно построить ещё, если переполнен.',
  dock: 'Открывает промысел рыбаков и дальние морские переселения.',
  mill: 'Перемалывает зерно в муку.',
  bakery: 'Печёт хлеб из муки — сытнее, чем сырое зерно.',
  workshop: 'Изготавливает инструменты и одежду из дерева, руды и шкур.',
  forge: 'Ускоряет добычу камня и металла.',
  wall: 'Укрепляет оборону поселения.',
  barracks: 'Готовит воинов к защите поселения.',
  library: 'Ускоряет исследования на 30%.',
  castle: 'Главная резиденция знати поселения.',
  market: 'Торговля приносит дополнительную еду.',
  church: 'Поднимает настроение жителей.',
  school: 'Ещё быстрее ускоряет исследования.',
  factory: 'Значительно ускоряет добычу камня и металла.',
  mine: 'Ускоряет добычу камня.',
  railway: 'Ускоряет все виды работ на 10%.',
  refinery: 'Ускоряет добычу металла.',
  laboratory: 'Сильно ускоряет исследования.',
  'tank factory': 'Производит танки для армии поселения.',
};
