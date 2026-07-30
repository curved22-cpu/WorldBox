export const ERAS = [
  {
    id: 0, name: 'Первобытность', short: 'Перв.',
    knowledgeReq: 0, popReq: 0,
    buildings: ['shack'],
  },
  {
    id: 1, name: 'Каменный век', short: 'Кам.',
    knowledgeReq: 15, popReq: 0,
    buildings: ['hut', 'storage'],
  },
  {
    id: 2, name: 'Бронзовый век', short: 'Бронз.',
    knowledgeReq: 90, popReq: 4,
    buildings: ['house', 'farm', 'well'],
  },
  {
    id: 3, name: 'Железный век', short: 'Жел.',
    knowledgeReq: 260, popReq: 8,
    buildings: ['forge', 'wall', 'barracks'],
    military: { unit: 'spearman', power: 1 },
  },
  {
    id: 4, name: 'Средневековье', short: 'Средн.',
    knowledgeReq: 600, popReq: 14,
    buildings: ['castle', 'market', 'church'],
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

export const BUILDING_INFO = {
  shack: { label: 'Шалаш', cost: { wood: 6 }, laborCost: 4, cap: 2 },
  hut: { label: 'Хижина', cost: { wood: 14 }, laborCost: 8, cap: 4 },
  storage: { label: 'Склад', cost: { wood: 10 }, laborCost: 6, cap: 0 },
  house: { label: 'Дом', cost: { wood: 20, stone: 10 }, laborCost: 14, cap: 5 },
  farm: { label: 'Ферма', cost: { wood: 16 }, laborCost: 10, cap: 0 },
  well: { label: 'Колодец', cost: { stone: 12 }, laborCost: 8, cap: 0 },
  forge: { label: 'Кузница', cost: { wood: 16, stone: 20 }, laborCost: 16, cap: 0 },
  wall: { label: 'Стена', cost: { stone: 30 }, laborCost: 18, cap: 0 },
  barracks: { label: 'Казармы', cost: { wood: 24, stone: 16 }, laborCost: 16, cap: 0 },
  castle: { label: 'Замок', cost: { stone: 60, wood: 20 }, laborCost: 30, cap: 8 },
  market: { label: 'Рынок', cost: { wood: 24, stone: 10 }, laborCost: 14, cap: 0 },
  church: { label: 'Храм', cost: { stone: 30, wood: 10 }, laborCost: 16, cap: 0 },
  factory: { label: 'Завод', cost: { stone: 50, ore: 40 }, laborCost: 26, cap: 0 },
  mine: { label: 'Шахта', cost: { wood: 20, stone: 20 }, laborCost: 18, cap: 0 },
  railway: { label: 'Железная дорога', cost: { ore: 40, wood: 30 }, laborCost: 24, cap: 0 },
  refinery: { label: 'Нефтезавод', cost: { ore: 60, stone: 40 }, laborCost: 30, cap: 0 },
  laboratory: { label: 'Лаборатория', cost: { ore: 40, stone: 30 }, laborCost: 26, cap: 0 },
  'tank factory': { label: 'Танковый завод', cost: { ore: 100, stone: 60 }, laborCost: 40, cap: 0 },
};
