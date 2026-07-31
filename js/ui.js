import { STAT_KEYS, STAT_LABEL, randomStat, randomName } from './person.js';
import { ERAS, BUILDING_INFO, BUILDING_DESC, HOUSING_TYPES } from './eras.js';
import { SPEEDS, dayToYear, ageInYears } from './time.js';
import { TOOLS } from './tools.js';
import { livingPeople, housingCap } from './settlement.js';
import { JOB_LABEL } from './render.js';

export function setupOnboarding(onStart) {
  const root = document.getElementById('setup-screen');
  root.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'setup-card';
  card.innerHTML = `
    <h1>Новая сага</h1>
    <p class="setup-sub">Двое приходят на пустые земли. Всё остальное — от них: срубленное дерево, шалаш, дети,
    внуки, и однажды — войны их потомков. Ты можешь лишь помогать им как бог.</p>
    <label class="setup-field">Название поселения
      <input id="set-settlement-name" value="Первое поселение" maxlength="24" />
    </label>
    <div class="founders-row" id="founders-row"></div>
    <div class="setup-actions">
      <button id="randomize-btn" type="button">🎲 Случайные характеристики</button>
      <button id="start-btn" type="button">Начать сагу</button>
    </div>
  `;
  root.appendChild(card);

  const foundersRow = card.querySelector('#founders-row');
  const founderForms = [0, 1].map(idx => {
    const f = document.createElement('div');
    f.className = 'founder-form';
    f.innerHTML = `
      <input class="f-name" value="${idx === 0 ? 'Ярослав' : 'Забава'}" maxlength="16" />
      <select class="f-sex">
        <option value="m" ${idx === 0 ? 'selected' : ''}>Мужчина</option>
        <option value="f" ${idx === 1 ? 'selected' : ''}>Женщина</option>
      </select>
      <div class="stat-rows"></div>
    `;
    const statRows = f.querySelector('.stat-rows');
    const sliders = {};
    for (const key of STAT_KEYS) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      const val = randomStat();
      row.innerHTML = `<span class="stat-name">${STAT_LABEL[key]}</span>
        <input type="range" min="10" max="90" value="${val}" class="stat-slider" data-stat="${key}" />
        <span class="stat-val">${val}</span>`;
      const slider = row.querySelector('.stat-slider');
      const valSpan = row.querySelector('.stat-val');
      slider.addEventListener('input', () => { valSpan.textContent = slider.value; });
      sliders[key] = slider;
      statRows.appendChild(row);
    }
    f._sliders = sliders;
    foundersRow.appendChild(f);
    return f;
  });

  card.querySelector('#randomize-btn').addEventListener('click', () => {
    for (const f of founderForms) {
      for (const key of STAT_KEYS) {
        const v = randomStat();
        f._sliders[key].value = v;
        f._sliders[key].nextElementSibling.textContent = v;
      }
      const sex = f.querySelector('.f-sex').value;
      f.querySelector('.f-name').value = randomName(sex);
    }
  });

  card.querySelector('#start-btn').addEventListener('click', () => {
    const settlementName = card.querySelector('#set-settlement-name').value.trim() || 'Первое поселение';
    const founders = founderForms.map(f => {
      const stats = {};
      for (const key of STAT_KEYS) stats[key] = parseInt(f._sliders[key].value, 10);
      return { name: f.querySelector('.f-name').value.trim() || 'Безымянный', sex: f.querySelector('.f-sex').value, stats, age: 20 };
    });
    root.style.display = 'none';
    onStart(settlementName, founders[0], founders[1]);
  });
}

function statBar(label, value, max = 100) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return `<div class="bar-row"><span class="bar-label">${label}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
    <span class="bar-val">${Math.round(value)}</span></div>`;
}

export function setupGameUI(game, onToolApply, onNewGame) {
  const yearDisplay = document.getElementById('year-display');
  const popDisplay = document.getElementById('pop-display');
  const speedRow = document.getElementById('speed-row');
  const liveToggle = document.getElementById('live-toggle');
  const eventFeed = document.getElementById('event-feed');
  const inspector = document.getElementById('inspector');
  const newGameBtn = document.getElementById('new-game-btn');

  liveToggle.checked = game.liveWithoutMe;
  liveToggle.addEventListener('change', () => { game.liveWithoutMe = liveToggle.checked; });
  newGameBtn.addEventListener('click', () => { if (confirm('Начать новую сагу? Текущий прогресс будет стёрт.')) onNewGame(); });

  const speedButtons = [];
  for (const s of SPEEDS) {
    const b = document.createElement('button');
    b.className = 'speed-btn';
    b.textContent = s.mult === 0 ? '⏸' : s.label;
    b.addEventListener('click', () => { game.speedMult = s.mult; syncSpeed(); });
    speedButtons.push([s.mult, b]);
    speedRow.appendChild(b);
  }
  function syncSpeed() {
    for (const [mult, b] of speedButtons) b.classList.toggle('active', game.speedMult === mult);
  }
  syncSpeed();

  let lastEventCount = 0;
  function syncEventFeed() {
    if (game.events.length === lastEventCount) return;
    lastEventCount = game.events.length;
    const recent = game.events.slice(-60).reverse();
    eventFeed.innerHTML = recent.map(e =>
      `<div class="ev ev-${e.level}"><span class="ev-year">Год ${e.year}</span>${e.text}</div>`
    ).join('');
  }

  function renderPersonInspector(person) {
    const age = Math.floor(ageInYears(game.day, person.birthDay));
    const applicable = TOOLS.filter(t => t.target === 'person');
    const parents = person.parents.filter(Boolean).map(id => game.people.get(id)).filter(Boolean);
    const children = person.childrenIds.map(id => game.people.get(id)).filter(Boolean);
    const partner = person.partnerId ? game.people.get(person.partnerId) : null;
    inspector.innerHTML = `
      <button class="close-btn" id="insp-close">✕</button>
      <h2>${person.name} ${person.sex === 'f' ? '♀' : '♂'}</h2>
      <div class="insp-sub">${person.alive ? `${age} лет` : `умер${person.sex === 'f' ? 'ла' : ''} в ${Math.floor(ageInYears(person.deathDay, person.birthDay))} лет (${person.deathCause})`}
        ${person.job ? ` · ${JOB_LABEL[person.job] || person.job}` : ''}${person.founder ? ' · основатель(ница)' : ''}</div>
      ${person.alive ? `
        ${statBar('Голод', person.needs.hunger)}
        ${statBar('Здоровье', person.needs.health)}
        ${statBar('Настроение', person.needs.mood)}
      ` : ''}
      <h3>Характеристики</h3>
      ${STAT_KEYS.map(k => statBar(STAT_LABEL[k], person.stats[k])).join('')}
      <h3>Семья</h3>
      <div class="insp-family">
        ${partner ? `Партнёр: <a data-sel="person:${partner.id}">${partner.name}</a><br/>` : ''}
        ${parents.length ? `Родители: ${parents.map(p => `<a data-sel="person:${p.id}">${p.name}</a>`).join(', ')}<br/>` : ''}
        ${children.length ? `Дети: ${children.map(c => `<a data-sel="person:${c.id}">${c.name}</a>`).join(', ')}` : '<em>детей пока нет</em>'}
      </div>
      ${person.alive ? `<h3>Силы</h3><div class="power-row">${applicable.map(t =>
        `<button class="power-btn" data-tool="${t.id}">${t.icon} ${t.name}</button>`).join('')}</div>` : ''}
    `;
    inspector.style.display = 'block';
    inspector.querySelector('#insp-close').addEventListener('click', () => selectTarget(null));
    inspector.querySelectorAll('[data-sel]').forEach(a => a.addEventListener('click', () => {
      const [type, id] = a.dataset.sel.split(':');
      selectTarget({ type, id: parseInt(id, 10) });
    }));
    if (person.alive) inspector.querySelectorAll('.power-btn').forEach(b => b.addEventListener('click', () => onToolApply(b.dataset.tool, person)));
  }

  function renderSettlementInspector(s) {
    const living = livingPeople(s, game);
    const applicable = TOOLS.filter(t => t.target === 'settlement');
    const cap = housingCap(s);
    inspector.innerHTML = `
      <button class="close-btn" id="insp-close">✕</button>
      <h2>${s.name}</h2>
      <div class="insp-sub">${ERAS[s.era].name} · население ${living.length}/${cap}</div>
      <h3>Запасы</h3>
      <div class="stock-grid">
        <span>🪵 ${Math.floor(s.stock.wood)}</span><span>🍎 ${Math.floor(s.stock.food)}</span>
        <span>🪨 ${Math.floor(s.stock.stone)}</span><span>⚙️ ${Math.floor(s.stock.ore)}</span>
        <span>📚 ${Math.floor(s.stock.knowledge)}</span>
      </div>
      <h3>Постройки</h3>
      <div class="buildings-list">${s.buildings.length ? s.buildings.map((b, i) =>
        `<a data-selbuild="${i}">${BUILDING_INFO[b.type].icon} ${BUILDING_INFO[b.type].label}</a>`).join(', ') : '<em>нет</em>'}
        ${s.constructionQueue ? `<br/>Строится: ${s.constructionQueue.label} (${Math.floor(s.constructionQueue.progress)}/${s.constructionQueue.laborCost})` : ''}</div>
      <h3>Жители</h3>
      <div class="people-list">${living.map(p =>
        `<a data-sel="person:${p.id}">${p.name}</a> (${p.job ? JOB_LABEL[p.job] || p.job : 'без дела'})`).join(', ')}</div>
      ${s.atWarWith.length ? `<div class="war-banner">⚔️ Воюет с ${s.atWarWith.length} поселением(ями)</div>` : ''}
      <h3>Силы</h3>
      <div class="power-row">${applicable.map(t => `<button class="power-btn" data-tool="${t.id}">${t.icon} ${t.name}</button>`).join('')}</div>
    `;
    inspector.style.display = 'block';
    inspector.querySelector('#insp-close').addEventListener('click', () => selectTarget(null));
    inspector.querySelectorAll('[data-sel]').forEach(a => a.addEventListener('click', () => {
      const [type, id] = a.dataset.sel.split(':');
      selectTarget({ type, id: parseInt(id, 10) });
    }));
    inspector.querySelectorAll('[data-selbuild]').forEach(a => a.addEventListener('click', () =>
      selectTarget({ type: 'building', settlementId: s.id, index: parseInt(a.dataset.selbuild, 10) })));
    inspector.querySelectorAll('.power-btn').forEach(b => b.addEventListener('click', () => onToolApply(b.dataset.tool, s)));
  }

  function renderBuildingInspector(settlementId, index) {
    const s = game.settlements.find(x => x.id === settlementId);
    if (!s) { selectTarget(null); return; }
    if (index === -1) {
      const q = s.constructionQueue;
      if (!q) { selectTarget(null); return; }
      const info = BUILDING_INFO[q.type];
      inspector.innerHTML = `
        <button class="close-btn" id="insp-close">✕</button>
        <h2>${info.icon} ${q.label}</h2>
        <div class="insp-sub">Стройка в поселении «${s.name}»</div>
        <div class="bar-row"><span class="bar-label">Готовность</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, q.progress / q.laborCost * 100)}%"></div></div>
          <span class="bar-val">${Math.floor(q.progress)}/${q.laborCost}</span></div>
      `;
      inspector.style.display = 'block';
      inspector.querySelector('#insp-close').addEventListener('click', () => selectTarget(null));
      return;
    }
    const b = s.buildings[index];
    if (!b) { selectTarget(null); return; }
    const info = BUILDING_INFO[b.type];
    const isHousing = HOUSING_TYPES.includes(b.type);
    const residents = isHousing ? (b.residents || []).map(id => game.people.get(id)).filter(Boolean) : [];
    inspector.innerHTML = `
      <button class="close-btn" id="insp-close">✕</button>
      <h2>${info.icon} ${info.label}</h2>
      <div class="insp-sub">Поселение «${s.name}» · построено в ${dayToYear(b.builtDay)} г.</div>
      <p class="insp-desc">${BUILDING_DESC[b.type] || ''}</p>
      ${b.type === 'storage' ? `
        <h3>Запасы поселения</h3>
        <div class="stock-grid">
          <span>🪵 ${Math.floor(s.stock.wood)}</span><span>🍎 ${Math.floor(s.stock.food)}</span>
          <span>🪨 ${Math.floor(s.stock.stone)}</span><span>⚙️ ${Math.floor(s.stock.ore)}</span>
          <span>📚 ${Math.floor(s.stock.knowledge)}</span>
        </div>` : ''}
      ${isHousing ? `
        <h3>Жители (${residents.length}/${info.cap})</h3>
        <div class="people-list">${residents.length ? residents.map(p => `<a data-sel="person:${p.id}">${p.name}</a>`).join(', ') : '<em>пусто</em>'}</div>
      ` : ''}
    `;
    inspector.style.display = 'block';
    inspector.querySelector('#insp-close').addEventListener('click', () => selectTarget(null));
    inspector.querySelectorAll('[data-sel]').forEach(a => a.addEventListener('click', () => {
      const [type, id] = a.dataset.sel.split(':');
      selectTarget({ type, id: parseInt(id, 10) });
    }));
  }

  function selectTarget(hit) {
    if (!hit) { game.selected = null; inspector.style.display = 'none'; return; }
    game.selected = hit;
    if (hit.type === 'person') {
      const p = game.people.get(hit.id);
      if (p) renderPersonInspector(p); else selectTarget(null);
    } else if (hit.type === 'building') {
      renderBuildingInspector(hit.settlementId, hit.index);
    } else {
      const s = game.settlements.find(x => x.id === hit.id);
      if (s) renderSettlementInspector(s); else selectTarget(null);
    }
  }

  function syncTopbar() {
    const totalPop = [...game.people.values()].filter(p => p.alive).length;
    yearDisplay.textContent = `Год ${dayToYear(game.day)}`;
    popDisplay.textContent = `👥 ${totalPop} · 🏘 ${game.settlements.length}`;
  }

  function syncAll() {
    syncTopbar();
    syncEventFeed();
    if (game.selected) {
      if (game.selected.type === 'person') {
        const p = game.people.get(game.selected.id);
        if (p) renderPersonInspector(p);
      } else if (game.selected.type === 'building') {
        renderBuildingInspector(game.selected.settlementId, game.selected.index);
      } else {
        const s = game.settlements.find(x => x.id === game.selected.id);
        if (s) renderSettlementInspector(s);
      }
    }
  }

  return { selectTarget, syncAll, syncSpeed };
}
