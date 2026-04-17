// === Helpers ===
const $ = id => document.getElementById(id);
function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function todayStr() { return dateStr(new Date()); }
function formatAmount(n) { return '¥' + Number(n).toLocaleString(); }
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
const DOW = ['日','月','火','水','木','金','土'];
function formatDateFull(d) { return `${d.getMonth()+1}月${d.getDate()}日（${DOW[d.getDay()]}）`; }

// === Preset Categories ===
const PRESETS = ['電車', 'バス', '自転車', 'タクシー', 'コンビニ', 'ランチ', 'ディナー', 'カフェ', '延長保育'];

// === State ===
const STATE = { calMonth: new Date(), viewDate: null, statsYear: new Date().getFullYear() };

// === Storage ===
function getAll() {
  try { return JSON.parse(localStorage.getItem('spend_v2') || '[]'); }
  catch { return []; }
}
function saveAll(d) { localStorage.setItem('spend_v2', JSON.stringify(d)); }
function addEntry(e) { const d = getAll(); d.push(e); saveAll(d); }
function deleteEntry(id) { saveAll(getAll().filter(e => e.id !== id)); }
function updateEntry(id, updates) {
  const all = getAll();
  const idx = all.findIndex(e => e.id === id);
  if (idx >= 0) { Object.assign(all[idx], updates); saveAll(all); }
}
function getById(id) { return getAll().find(e => e.id === id) || null; }
function getByDate(ds) { return getAll().filter(e => e.date === ds); }
function entryTotal(e) { return e.total || e.items.reduce((s, i) => s + i.amount, 0); }
function entryType(e) { return e.type || 'private'; }

// ========================
// SCREEN 1: Month List
// ========================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  window.scrollTo(0, 0);
}

$('monthPrev').addEventListener('click', () => {
  STATE.calMonth.setMonth(STATE.calMonth.getMonth() - 1);
  renderMonth();
});
$('monthNext').addEventListener('click', () => {
  STATE.calMonth.setMonth(STATE.calMonth.getMonth() + 1);
  renderMonth();
});

function renderMonth() {
  const year = STATE.calMonth.getFullYear();
  const month = STATE.calMonth.getMonth();
  $('monthTitle').textContent = `${year}年${month + 1}月`;

  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const all = getAll().filter(e => e.date.startsWith(prefix));

  const byDate = {};
  all.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  const dates = Object.keys(byDate).sort().reverse();
  const monthTotal = all.reduce((s, e) => s + entryTotal(e), 0);

  $('monthSummary').innerHTML = monthTotal > 0
    ? `今月の合計: <strong>${formatAmount(monthTotal)}</strong>`
    : '';

  // カテゴリ別内訳
  const privateTotal = all.filter(e => entryType(e) === 'private').reduce((s, e) => s + entryTotal(e), 0);
  const workTotal    = all.filter(e => entryType(e) === 'work').reduce((s, e) => s + entryTotal(e), 0);
  $('monthBreakdown').innerHTML = monthTotal > 0
    ? `<span class="bd-private">🏠 ${formatAmount(privateTotal)}</span><span class="bd-work">💼 ${formatAmount(workTotal)}</span>`
    : '';

  if (dates.length === 0) {
    $('monthList').innerHTML = '';
    $('monthEmpty').style.display = 'block';
    return;
  }

  $('monthEmpty').style.display = 'none';
  $('monthList').innerHTML = dates.map(ds => {
    const entries = byDate[ds];
    const d = new Date(ds + 'T00:00:00');
    const dowClass = d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : '';
    const total = entries.reduce((s, e) => s + entryTotal(e), 0);
    const events = [...new Set(entries.map(e => e.event))].join(', ');
    const count = entries.length;
    const hasPrivate = entries.some(e => entryType(e) === 'private');
    const hasWork    = entries.some(e => entryType(e) === 'work');
    const dots = (hasPrivate ? '<span class="type-dot private"></span>' : '')
               + (hasWork    ? '<span class="type-dot work"></span>'    : '');

    return `
      <li class="month-item" data-date="${ds}">
        <div class="mi-date">
          <div class="mi-day">${d.getDate()}</div>
          <div class="mi-dow ${dowClass}">${DOW[d.getDay()]}</div>
        </div>
        <div class="mi-info">
          <div class="mi-event">${dots}${escapeHtml(events)}</div>
          <div class="mi-count">${count}件</div>
        </div>
        <div class="mi-total">${formatAmount(total)}</div>
      </li>`;
  }).join('');

  $('monthList').querySelectorAll('.month-item').forEach(item => {
    item.addEventListener('click', () => {
      STATE.viewDate = new Date(item.dataset.date + 'T00:00:00');
      showScreen('dayScreen');
      renderDay();
    });
  });
}

$('monthAddBtn').addEventListener('click', () => openAddScreen(todayStr()));
$('statsBtn').addEventListener('click', () => {
  STATE.statsYear = STATE.calMonth.getFullYear();
  showScreen('statsScreen');
  renderStats();
});

// ========================
// SCREEN 2: Day Detail
// ========================
$('backBtn').addEventListener('click', () => {
  STATE.calMonth = new Date(STATE.viewDate);
  showScreen('monthScreen');
  renderMonth();
});

function renderDay() {
  const ds = dateStr(STATE.viewDate);
  $('dayDate').textContent = formatDateFull(STATE.viewDate);

  const entries = getByDate(ds);
  const events = [...new Set(entries.map(e => e.event))].filter(Boolean);
  $('dayEvent').textContent = events.join(', ') || '';
  $('dayEvent').style.display = events.length ? '' : 'none';

  const dayTotal = entries.reduce((s, e) => s + entryTotal(e), 0);
  $('dayTotal').textContent = formatAmount(dayTotal);

  if (entries.length === 0) {
    $('txList').innerHTML = '';
    $('hibiSummary').style.display = 'none';
    $('dayEmpty').style.display = 'block';
    return;
  }

  $('dayEmpty').style.display = 'none';
  $('txList').innerHTML = entries.map(e => {
    const eTotal = entryTotal(e);
    const typeTag = entryType(e) === 'work'
      ? '<span class="type-tag work">💼 仕事</span>'
      : '<span class="type-tag private">🏠 プライベート</span>';
    let html = `<li class="tx-item" data-id="${e.id}">
      <div class="tx-info tx-edit" data-id="${e.id}">
        <div class="tx-cat">${escapeHtml(e.event)}${typeTag}</div>`;
    if (e.items && e.items.length > 0) {
      html += `<div class="tx-sub">${e.items.map(i => `${escapeHtml(i.cat)} ¥${i.amount.toLocaleString()}`).join(' / ')}</div>`;
    }
    html += `</div>
      <div class="tx-amount">${formatAmount(eTotal)}</div>
      <button class="tx-del" data-id="${e.id}">&times;</button>
    </li>`;
    return html;
  }).join('');

  // 費目別合計
  const hibiMap = {};
  entries.forEach(e => e.items.forEach(item => {
    hibiMap[item.cat] = (hibiMap[item.cat] || 0) + item.amount;
  }));
  const hibis = Object.entries(hibiMap).sort((a, b) => b[1] - a[1]);
  if (hibis.length > 1) {
    $('hibiSummary').style.display = '';
    $('hibiSummary').innerHTML = '<div class="hibi-title">費目別合計</div>'
      + hibis.map(([cat, amt]) =>
          `<div class="hibi-row"><span>${escapeHtml(cat)}</span><span>${formatAmount(amt)}</span></div>`
        ).join('');
  } else {
    $('hibiSummary').style.display = 'none';
  }

  $('txList').querySelectorAll('.tx-edit').forEach(el => {
    el.addEventListener('click', () => openEditScreen(el.dataset.id));
  });
  $('txList').querySelectorAll('.tx-del').forEach(btn => {
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      if (confirm('削除しますか？')) { deleteEntry(btn.dataset.id); renderDay(); }
    });
  });
}

// ========================
// SCREEN 3: Add / Edit Entry
// ========================
let addDate = '';
let editingId = null;
let addType = 'private';

$('addBtn').addEventListener('click', () => openAddScreen(dateStr(STATE.viewDate)));

$('addBackBtn').addEventListener('click', () => {
  if (STATE.viewDate) { showScreen('dayScreen'); renderDay(); }
  else               { showScreen('monthScreen'); renderMonth(); }
});

// Type toggle
$('typeToggle').addEventListener('click', e => {
  const btn = e.target.closest('.type-btn');
  if (!btn) return;
  addType = btn.dataset.type;
  $('typeToggle').querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b === btn));
});

function renderPresetGrid() {
  $('presetGrid').innerHTML = PRESETS.map(cat =>
    `<button type="button" class="preset-btn" data-cat="${escapeHtml(cat)}">${cat}</button>`
  ).join('') + `<button type="button" class="preset-btn preset-other" data-cat="">その他</button>`;

  $('presetGrid').querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      // 空の行があれば埋める、なければ追加
      let added = false;
      for (const row of $('itemsContainer').querySelectorAll('.item-row')) {
        const nameInput = row.querySelector('.item-name');
        const amtInput  = row.querySelector('.item-amount');
        if (!nameInput.value.trim() && !amtInput.value) {
          nameInput.value = cat;
          amtInput.focus();
          added = true;
          break;
        }
      }
      if (!added) {
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
          <input type="text" class="item-name" placeholder="カテゴリ" value="${escapeHtml(cat)}">
          <input type="number" class="item-amount" placeholder="金額" inputmode="numeric">
          <button type="button" class="item-del-btn">×</button>`;
        $('itemsContainer').appendChild(row);
        row.querySelector('.item-amount').focus();
      }
      updateAutoTotal();
      updateSaveBtn();
    });
  });
}

function openAddScreen(ds) {
  editingId = null;
  addDate = ds;
  addType = 'private';
  const d = new Date(ds + 'T00:00:00');
  $('dateDisplay').textContent = formatDateFull(d);
  $('addTitle').textContent = '支出を追加';
  $('typeToggle').querySelectorAll('.type-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.type === addType));

  const existing = getByDate(ds);
  $('eventInput').value = existing.length > 0 ? existing[existing.length - 1].event : '';

  $('itemsContainer').innerHTML = createItemRowHTML('', '');
  renderPresetGrid();
  updateAutoTotal();
  updateSaveBtn();
  showScreen('addScreen');
}

function openEditScreen(id) {
  const entry = getById(id);
  if (!entry) return;

  editingId = id;
  addDate = entry.date;
  addType = entry.type || 'private';
  const d = new Date(entry.date + 'T00:00:00');
  $('dateDisplay').textContent = formatDateFull(d);
  $('addTitle').textContent = '支出を編集';
  $('eventInput').value = entry.event;
  $('typeToggle').querySelectorAll('.type-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.type === addType));

  let rowsHTML = entry.items && entry.items.length > 0
    ? entry.items.map(i => createItemRowHTML(i.cat, i.amount)).join('')
    : '';
  rowsHTML += createItemRowHTML('', '');
  $('itemsContainer').innerHTML = rowsHTML;

  renderPresetGrid();
  updateAutoTotal();
  updateSaveBtn();
  showScreen('addScreen');
}

function createItemRowHTML(cat, amount) {
  return `<div class="item-row">
    <input type="text" class="item-name" placeholder="カテゴリ" value="${escapeHtml(String(cat))}">
    <input type="number" class="item-amount" placeholder="金額" inputmode="numeric" value="${amount || ''}">
    <button type="button" class="item-del-btn">×</button>
  </div>`;
}

// 行削除
$('itemsContainer').addEventListener('click', e => {
  if (!e.target.classList.contains('item-del-btn')) return;
  const row = e.target.closest('.item-row');
  const rows = $('itemsContainer').querySelectorAll('.item-row');
  if (rows.length > 1) { row.remove(); }
  else { row.querySelector('.item-name').value = ''; row.querySelector('.item-amount').value = ''; }
  updateAutoTotal(); updateSaveBtn();
});

$('addItemBtn').addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input type="text" class="item-name" placeholder="カテゴリ">
    <input type="number" class="item-amount" placeholder="金額" inputmode="numeric">
    <button type="button" class="item-del-btn">×</button>`;
  $('itemsContainer').appendChild(row);
  row.querySelector('.item-name').focus();
});

$('itemsContainer').addEventListener('input', () => { updateAutoTotal(); updateSaveBtn(); });
$('eventInput').addEventListener('input', updateSaveBtn);

function getItems() {
  const items = [];
  $('itemsContainer').querySelectorAll('.item-row').forEach(row => {
    const cat = row.querySelector('.item-name').value.trim();
    const amount = parseInt(row.querySelector('.item-amount').value) || 0;
    if (cat && amount > 0) items.push({ cat, amount });
  });
  return items;
}

function updateAutoTotal() {
  const total = getItems().reduce((s, i) => s + i.amount, 0);
  $('autoTotal').textContent = `合計: ${formatAmount(total)}`;
}

function updateSaveBtn() {
  $('saveBtn').disabled = !($('eventInput').value.trim() && getItems().length > 0);
}

$('saveBtn').addEventListener('click', () => {
  const event = $('eventInput').value.trim();
  const items = getItems();
  if (!event || items.length === 0) return;
  const total = items.reduce((s, i) => s + i.amount, 0);

  if (editingId) {
    updateEntry(editingId, { event, type: addType, total, items });
  } else {
    addEntry({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: addDate, event, type: addType, total, items,
      createdAt: new Date().toISOString(),
    });
  }

  STATE.viewDate = new Date(addDate + 'T00:00:00');
  STATE.calMonth = new Date(STATE.viewDate);
  showScreen('dayScreen');
  renderDay();
});

// ========================
// SCREEN 4: Stats
// ========================
$('statsBackBtn').addEventListener('click', () => { showScreen('monthScreen'); renderMonth(); });

$('statsPrevYear').addEventListener('click', () => { STATE.statsYear--; renderStats(); });
$('statsNextYear').addEventListener('click', () => { STATE.statsYear++; renderStats(); });

function renderStats() {
  const year = STATE.statsYear;
  $('statsYearLabel').textContent = `${year}年`;

  const all = getAll().filter(e => e.date.startsWith(`${year}-`));
  const privateTotal = all.filter(e => entryType(e) === 'private').reduce((s, e) => s + entryTotal(e), 0);
  const workTotal    = all.filter(e => entryType(e) === 'work').reduce((s, e) => s + entryTotal(e), 0);
  const yearTotal    = privateTotal + workTotal;

  // 費目別（年間）
  const hibiMap = {};
  all.forEach(e => e.items.forEach(item => {
    hibiMap[item.cat] = (hibiMap[item.cat] || 0) + item.amount;
  }));
  const hibis = Object.entries(hibiMap).sort((a, b) => b[1] - a[1]);

  // 月別
  const monthData = {};
  for (let m = 1; m <= 12; m++) {
    const prefix = `${year}-${String(m).padStart(2, '0')}`;
    const me = all.filter(e => e.date.startsWith(prefix));
    if (me.length > 0) {
      monthData[m] = {
        private: me.filter(e => entryType(e) === 'private').reduce((s, e) => s + entryTotal(e), 0),
        work:    me.filter(e => entryType(e) === 'work').reduce((s, e) => s + entryTotal(e), 0),
      };
    }
  }

  if (yearTotal === 0) {
    $('statsContent').innerHTML = `<div class="empty-msg">${year}年のデータがありません</div>`;
    return;
  }

  let html = '';

  // 年間合計カード
  html += `<div class="stats-card">
    <div class="stats-card-title">年間合計</div>
    <div class="stats-total">${formatAmount(yearTotal)}</div>
    <div class="stats-breakdown">
      <div class="stats-row"><span>🏠 プライベート</span><span class="bd-private">${formatAmount(privateTotal)}</span></div>
      <div class="stats-row"><span>💼 仕事</span><span class="bd-work">${formatAmount(workTotal)}</span></div>
    </div>
  </div>`;

  // 費目別
  if (hibis.length > 0) {
    html += `<div class="stats-card">
      <div class="stats-card-title">費目別合計（年間）</div>
      ${hibis.map(([cat, amt]) =>
        `<div class="stats-row"><span>${escapeHtml(cat)}</span><span>${formatAmount(amt)}</span></div>`
      ).join('')}
    </div>`;
  }

  // 月別内訳
  const months = Object.keys(monthData).sort((a, b) => Number(b) - Number(a));
  if (months.length > 0) {
    html += `<div class="stats-card">
      <div class="stats-card-title">月別内訳</div>
      ${months.map(m => {
        const d = monthData[m];
        return `<div class="stats-month-row">
          <span class="stats-month-label">${m}月</span>
          <div class="stats-month-detail">
            <span class="bd-private">🏠 ${formatAmount(d.private)}</span>
            <span class="bd-work">💼 ${formatAmount(d.work)}</span>
          </div>
          <span class="stats-month-total">${formatAmount(d.private + d.work)}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  // CSV出力
  html += `<div class="stats-export">
    <button id="statsCsvAll" class="data-btn">📥 全てCSV</button>
    <button id="statsCsvPrivate" class="data-btn">📥 プライベート</button>
    <button id="statsCsvWork" class="data-btn">📥 仕事</button>
  </div>`;

  $('statsContent').innerHTML = html;
  $('statsCsvAll').addEventListener('click', () => exportYearCSV(year, null));
  $('statsCsvPrivate').addEventListener('click', () => exportYearCSV(year, 'private'));
  $('statsCsvWork').addEventListener('click', () => exportYearCSV(year, 'work'));
}

function exportYearCSV(year, typeFilter) {
  let all = getAll().filter(e => e.date.startsWith(`${year}-`));
  if (typeFilter) all = all.filter(e => entryType(e) === typeFilter);
  if (!all.length) { alert('データがありません'); return; }

  const header = '日付,種別,イベント,カテゴリ,金額';
  const rows = [];
  all.sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
    const typeName = entryType(e) === 'work' ? '仕事' : 'プライベート';
    e.items.forEach(item => {
      rows.push(`${e.date},"${typeName}","${e.event.replace(/"/g,'""')}","${item.cat.replace(/"/g,'""')}",${item.amount}`);
    });
  });

  const suffix = typeFilter === 'work' ? '_仕事' : typeFilter === 'private' ? '_プライベート' : '';
  const csv = '\uFEFF' + header + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `spending_${year}${suffix}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// === CSV Export (日別) ===
$('exportBtn').addEventListener('click', () => {
  const ds = dateStr(STATE.viewDate);
  const entries = getByDate(ds);
  if (!entries.length) { alert('データがありません'); return; }

  const header = '日付,種別,イベント,カテゴリ,金額';
  const rows = [];
  entries.forEach(e => {
    const typeName = entryType(e) === 'work' ? '仕事' : 'プライベート';
    e.items.forEach(item => {
      rows.push(`${e.date},"${typeName}","${e.event.replace(/"/g,'""')}","${item.cat.replace(/"/g,'""')}",${item.amount}`);
    });
  });

  const csv = '\uFEFF' + header + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `spending_${ds}.csv`; a.click();
  URL.revokeObjectURL(url);
});

// === Data Export / Import ===
$('exportDataBtn').addEventListener('click', () => {
  const data = { version: 1, exportedAt: new Date().toISOString(), entries: getAll() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `spending-backup-${todayStr()}.json`; a.click();
  URL.revokeObjectURL(url);
});

$('importDataBtn').addEventListener('click', () => $('importFile').click());

$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data.entries || !Array.isArray(data.entries)) { alert('不正なファイルです'); return; }
    const current = getAll();
    const existingIds = new Set(current.map(e => e.id));
    const newEntries = data.entries.filter(e => !existingIds.has(e.id));
    const merged = [...current, ...newEntries];
    if (confirm(`${newEntries.length}件の新規データを取り込みます。（既存データはそのまま保持）`)) {
      saveAll(merged);
      alert(`${newEntries.length}件を取り込みました`);
      renderMonth();
    }
  } catch (err) { alert('読み込みに失敗しました: ' + err.message); }
  e.target.value = '';
});

// === SW ===
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// === Init ===
renderMonth();
