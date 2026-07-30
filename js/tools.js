import { addEvent } from './events.js';
import { livingPeople } from './settlement.js';

function getSettlement(game, id) { return game.settlements.find(s => s.id === id); }

export const TOOLS = [
  {
    id: 'heal', name: 'Исцелить', icon: '💚', target: 'person',
    apply(game, person) {
      person.needs.health = 100;
      person.needs.mood = Math.min(100, person.needs.mood + 15);
      addEvent(game.events, game.day, `${person.name} чудесным образом исцелён${person.sex === 'f' ? 'а' : ''}.`, 'normal');
    },
  },
  {
    id: 'inspire', name: 'Вдохновить', icon: '✨', target: 'person',
    apply(game, person) {
      person.needs.mood = 100;
      person.skills.research = Math.min(100, person.skills.research + 5);
      addEvent(game.events, game.day, `${person.name} посетило озарение.`, 'normal');
    },
  },
  {
    id: 'gift', name: 'Дар ресурсов', icon: '🎁', target: 'settlement',
    apply(game, settlement) {
      settlement.stock.wood += 60; settlement.stock.food += 60; settlement.stock.stone += 25;
      addEvent(game.events, game.day, `«${settlement.name}» получает щедрый дар от небес.`, 'normal');
    },
  },
  {
    id: 'knowledge', name: 'Откровение', icon: '📖', target: 'settlement',
    apply(game, settlement) {
      settlement.stock.knowledge += 40;
      addEvent(game.events, game.day, `Жители «${settlement.name}» получают откровение свыше.`, 'normal');
    },
  },
  {
    id: 'plague', name: 'Чума', icon: '🦠', target: 'settlement',
    apply(game, settlement) {
      for (const p of livingPeople(settlement, game)) {
        p.needs.health = Math.max(0, p.needs.health - (15 + Math.random() * 25));
      }
      addEvent(game.events, game.day, `Чума поражает поселение «${settlement.name}»!`, 'major');
    },
  },
  {
    id: 'disaster', name: 'Стихия', icon: '🔥', target: 'settlement',
    apply(game, settlement) {
      if (settlement.constructionQueue) settlement.constructionQueue.progress *= 0.4;
      settlement.stock.wood = Math.max(0, settlement.stock.wood - 30);
      settlement.stock.food = Math.max(0, settlement.stock.food - 30);
      for (const p of livingPeople(settlement, game)) {
        if (Math.random() < 0.3) p.needs.health = Math.max(0, p.needs.health - 20);
      }
      addEvent(game.events, game.day, `Стихийное бедствие обрушивается на «${settlement.name}»!`, 'major');
    },
  },
];

export function getTool(id) { return TOOLS.find(t => t.id === id); }
export { getSettlement };
