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

// === State ===
const STATE = { calMonth: new Date(), viewDate: null };

// === Storage ===
// Each entry: { id, date, event, items: [{cat, amount}], createdAt }
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

  // Group by date
  const byDate = {};
  all.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  // Sort dates descending
  const dates = Object.keys(byDate).sort().reverse();

  // Month total
  const monthTotal = all.reduce((s, e) => s + (e.total || e.items.reduce((s2, i) => s2 + i.amount, 0)), 0);
  $('monthSummary').innerHTML = monthTotal > 0
    ? `今月の合計: <strong>${formatAmount(monthTotal)}</strong>`
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
    const dow = DOW[d.getDay()];
    const dowClass = d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : '';
    const total = entries.reduce((s, e) => s + (e.total || e.items.reduce((s2, i) => s2 + i.amount, 0)), 0);
    const events = [...new Set(entries.map(e => e.event))].join(', ');
    const count = entries.length;

    return `
      <li class="month-item" data-date="${ds}">
        <div class="mi-date">
          <div class="mi-day">${d.getDate()}</div>
          <div class="mi-dow ${dowClass}">${dow}</div>
        </div>
        <div class="mi-info">
          <div class="mi-event">${escapeHtml(events)}</div>
          <div class="mi-count">${count}件</div>
        </div>
        <div class="mi-total">${formatAmount(total)}</div>
      </li>`;
  }).join('');

  $('monthList').querySelectorAll('.month-item').forEach(item => {
    item.addEventListener('click', () => {
      const ds = item.dataset.date;
      STATE.viewDate = new Date(ds + 'T00:00:00');
      showScreen('dayScreen');
      renderDay();
    });
  });
}

// Month screen + button → go to add screen with today's date
$('monthAddBtn').addEventListener('click', () => {
  openAddScreen(todayStr());
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

  const dayTotal = entries.reduce((s, e) => s + (e.total || e.items.reduce((s2, i) => s2 + i.amount, 0)), 0);
  $('dayTotal').textContent = formatAmount(dayTotal);

  if (entries.length === 0) {
    $('txList').innerHTML = '';
    $('dayEmpty').style.display = 'block';
    return;
  }

  $('dayEmpty').style.display = 'none';
  $('txList').innerHTML = entries.map(e => {
    const entryTotal = e.total || e.items.reduce((s, i) => s + i.amount, 0);
    let html = `<li class="tx-item" data-id="${e.id}">
      <div class="tx-info tx-edit" data-id="${e.id}">
        <div class="tx-cat">${escapeHtml(e.event)}</div>`;
    if (e.items && e.items.length > 0) {
      html += `<div class="tx-sub">${e.items.map(i => `${escapeHtml(i.cat)} ¥${i.amount.toLocaleString()}`).join(' / ')}</div>`;
    }
    html += `</div>
      <div class="tx-amount">${formatAmount(entryTotal)}</div>
      <button class="tx-del" data-id="${e.id}">&times;</button>
    </li>`;
    return html;
  }).join('');

  // Edit on tap
  $('txList').querySelectorAll('.tx-edit').forEach(el => {
    el.addEventListener('click', () => openEditScreen(el.dataset.id));
  });

  // Delete
  $('txList').querySelectorAll('.tx-del').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (confirm('削除しますか？')) { deleteEntry(btn.dataset.id); renderDay(); }
    });
  });
}

// ========================
// SCREEN 3: Add / Edit Entry
// ========================
let addDate = '';
let editingId = null; // null = new, string = editing existing

$('addBtn').addEventListener('click', () => {
  openAddScreen(dateStr(STATE.viewDate));
});

$('addBackBtn').addEventListener('click', () => {
  if (STATE.viewDate) {
    showScreen('dayScreen');
    renderDay();
  } else {
    showScreen('monthScreen');
    renderMonth();
  }
});

function openAddScreen(ds) {
  editingId = null;
  addDate = ds;
  const d = new Date(ds + 'T00:00:00');
  $('dateDisplay').textContent = formatDateFull(d);
  $('addTitle').textContent = '支出を追加';

  const existing = getByDate(ds);
  const existingEvent = existing.length > 0 ? existing[existing.length - 1].event : '';
  $('eventInput').value = existingEvent;

  $('itemsContainer').innerHTML = createItemRowHTML('', '');
  updateAutoTotal();
  updateSaveBtn();
  showScreen('addScreen');
}

function openEditScreen(id) {
  const entry = getById(id);
  if (!entry) return;

  editingId = id;
  addDate = entry.date;
  const d = new Date(entry.date + 'T00:00:00');
  $('dateDisplay').textContent = formatDateFull(d);
  $('addTitle').textContent = '支出を編集';
  $('eventInput').value = entry.event;

  // Populate existing items + one empty row for adding
  let rowsHTML = '';
  if (entry.items && entry.items.length > 0) {
    rowsHTML = entry.items.map(i => createItemRowHTML(i.cat, i.amount)).join('');
  }
  rowsHTML += createItemRowHTML('', '');
  $('itemsContainer').innerHTML = rowsHTML;

  updateAutoTotal();
  updateSaveBtn();
  showScreen('addScreen');
}

function createItemRowHTML(cat, amount) {
  return `<div class="item-row">
    <input type="text" class="item-name" placeholder="カテゴリ（例: 電車）" value="${escapeHtml(String(cat))}">
    <input type="number" class="item-amount" placeholder="金額" inputmode="numeric" value="${amount || ''}">
  </div>`;
}

// Add item row
$('addItemBtn').addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input type="text" class="item-name" placeholder="カテゴリ（例: ランチ）">
    <input type="number" class="item-amount" placeholder="金額" inputmode="numeric">`;
  $('itemsContainer').appendChild(row);
  row.querySelector('.item-name').focus();
});

// Auto-calculate total from items
$('itemsContainer').addEventListener('input', () => {
  updateAutoTotal();
  updateSaveBtn();
});
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
  const items = getItems();
  const total = items.reduce((s, i) => s + i.amount, 0);
  $('autoTotal').textContent = `合計: ${formatAmount(total)}`;
}

function updateSaveBtn() {
  const event = $('eventInput').value.trim();
  const items = getItems();
  $('saveBtn').disabled = !(event && items.length > 0);
}

$('saveBtn').addEventListener('click', () => {
  const event = $('eventInput').value.trim();
  const items = getItems();
  if (!event || items.length === 0) return;

  const total = items.reduce((s, i) => s + i.amount, 0);

  if (editingId) {
    updateEntry(editingId, { event, total, items });
  } else {
    addEntry({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: addDate,
      event,
      total,
      items,
      createdAt: new Date().toISOString(),
    });
  }

  STATE.viewDate = new Date(addDate + 'T00:00:00');
  STATE.calMonth = new Date(STATE.viewDate);
  showScreen('dayScreen');
  renderDay();
});

// === CSV Export ===
$('exportBtn').addEventListener('click', () => {
  const ds = dateStr(STATE.viewDate);
  const entries = getByDate(ds);
  if (!entries.length) { alert('データがありません'); return; }

  const header = '日付,イベント,カテゴリ,金額';
  const rows = [];
  entries.forEach(e => {
    e.items.forEach(item => {
      rows.push(`${e.date},"${e.event.replace(/"/g,'""')}","${item.cat.replace(/"/g,'""')}",${item.amount}`);
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
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries: getAll(),
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spending-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

$('importDataBtn').addEventListener('click', () => {
  $('importFile').click();
});

$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.entries || !Array.isArray(data.entries)) {
      alert('不正なファイルです');
      return;
    }
    const current = getAll();
    const existingIds = new Set(current.map(e => e.id));
    const newEntries = data.entries.filter(e => !existingIds.has(e.id));
    const merged = [...current, ...newEntries];
    if (confirm(`${newEntries.length}件の新規データを取り込みます。（既存データはそのまま保持）`)) {
      saveAll(merged);
      alert(`${newEntries.length}件を取り込みました`);
      renderMonth();
    }
  } catch (err) {
    alert('読み込みに失敗しました: ' + err.message);
  }
  e.target.value = '';
});

// === SW: clear old caches, register network-first SW ===
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// === Init ===
renderMonth();
