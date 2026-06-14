// app/kerja/budget/js/budget-ui.js
import { getAllFromStore, putToStore, getFromStore, deleteFromStore, getAllByIndexFromStore } from './budget-db.js';
import { calculateBudgetSummary, getBulanName, createBudgetFromTemplate, copyBudgetToNextPeriod, DEFAULT_TEMPLATES } from './budget-core.js';
import { parseCSVText, autoMatchCategory } from './importer.js';
import { analyzeFinances, simulateDebtPayoff } from './advisor.js';

let activeTab = 'dashboard';
let currentBudgetId = null;
let activeYear = new Date().getFullYear();
let activeMonth = new Date().getMonth() + 1;

document.addEventListener('DOMContentLoaded', async () => {
  if (window.TMPT_Auth) {
    await window.TMPT_Auth.init();
    window.TMPT_Auth.requireAuth();
  }

  currentBudgetId = `budget_${activeYear}_${activeMonth}`;
  let budget = await getFromStore('budgets', currentBudgetId);
  if (!budget) {
    await createBudgetFromTemplate('tmpl_50_30_20', activeYear, activeMonth, 0);
  }

  setupHeaderAndSidebar();
  await renderTab();
  setupEventListeners();
});

function setupHeaderAndSidebar() {
  const checkHeader = setInterval(() => {
    const appHeaderName = document.getElementById('header-app-name');
    const headerSearch = document.getElementById('header-search');
    if (appHeaderName && headerSearch) {
      appHeaderName.textContent = 'Budget';
      headerSearch.placeholder = 'Cari pengeluaran, pemasukan, atau tagihan...';
      clearInterval(checkHeader);
    }
  }, 100);
  setTimeout(() => clearInterval(checkHeader), 5000);

  document.addEventListener('tmpt:sidebar-toggle', (e) => {
    e.preventDefault();
    const sidebar = document.querySelector('.budget-sidebar');
    if (sidebar) sidebar.classList.toggle('collapsed');
  });
}

function setupEventListeners() {
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'header-search') {
      const query = e.target.value.toLowerCase().trim();
      filterBudgetItems(query);
    }
  });
}

function filterBudgetItems(query) {
  const rows = document.querySelectorAll('.budget-item-row');
  const catBoxes = document.querySelectorAll('.budget-category-box');

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    if (text.includes(query)) {
      row.style.display = 'flex';
    } else {
      row.style.display = 'none';
    }
  });

  catBoxes.forEach(box => {
    const hdrEl = box.querySelector('.budget-category-header');
    const visibleRows = box.querySelectorAll('.budget-item-row[style="display: flex;"]');
    const headerText = hdrEl ? hdrEl.textContent.toLowerCase() : '';
    if (visibleRows.length > 0 || headerText.includes(query) || !query) {
      box.style.display = 'block';
    } else {
      box.style.display = 'none';
    }
  });
}

window.switchTab = function(tabName) {
  activeTab = tabName;
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`nav-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');
  renderTab();
};

async function renderTab() {
  const container = document.getElementById('budget-tab-content');
  if (!container) return;

  const summary = await calculateBudgetSummary(currentBudgetId);

  if (activeTab === 'dashboard') {
    await renderDashboard(container, summary);
  } else if (activeTab === 'transactions') {
    await renderTransactions(container);
  } else if (activeTab === 'reports') {
    await renderReports(container, summary);
  } else if (activeTab === 'goals') {
    await renderGoals(container);
  } else if (activeTab === 'debts') {
    await renderDebts(container);
  } else if (activeTab === 'advisor') {
    await renderAdvisor(container, summary);
  } else if (activeTab === 'import') {
    await renderImport(container);
  }
}

const formatRupiah = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

/** Render period selector (bulan & tahun) */
function renderPeriodSelector() {
  const bulanOptions = Array.from({ length: 12 }, (_, i) => {
    const num = i + 1;
    const selected = num === activeMonth ? 'selected' : '';
    return `<option value="${num}" ${selected}>${getBulanName(num)}</option>`;
  }).join('');

  const currentYear = new Date().getFullYear();
  // Tampilkan 3 tahun ke belakang dan 1 tahun ke depan
  const years = [];
  for (let y = currentYear - 3; y <= currentYear + 1; y++) years.push(y);
  const tahunOptions = years.map(y => {
    const selected = y === activeYear ? 'selected' : '';
    return `<option value="${y}" ${selected}>${y}</option>`;
  }).join('');

  return `
    <div style="display: flex; align-items: center; gap: 0.5rem; background: var(--pico-form-element-background-color); padding: 0.5rem 1rem; border-radius: 10px; border: 1px solid var(--budget-card-border);">
      <span style="font-size: 0.85rem; font-weight: 600; color: var(--pico-muted-color);">📅 Periode:</span>
      <select id="sel-bulan" style="margin: 0; padding: 0.2rem 0.5rem; font-size: 0.9rem; width: auto;" onchange="changePeriod()">
        ${bulanOptions}
      </select>
      <select id="sel-tahun" style="margin: 0; padding: 0.2rem 0.5rem; font-size: 0.9rem; width: auto;" onchange="changePeriod()">
        ${tahunOptions}
      </select>
      <span id="period-status-badge" style="font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 6px; background: #10b981; color: white;"></span>
    </div>
  `;
}

window.changePeriod = async function() {
  const bulan = parseInt(document.getElementById('sel-bulan').value);
  const tahun = parseInt(document.getElementById('sel-tahun').value);
  activeMonth = bulan;
  activeYear = tahun;
  currentBudgetId = `budget_${activeYear}_${activeMonth}`;

  // Cek apakah budget periode ini sudah ada, jika belum buat kosong
  let budget = await getFromStore('budgets', currentBudgetId);
  if (!budget) {
    await createBudgetFromTemplate('tmpl_50_30_20', activeYear, activeMonth, 0);
    if (window.TMPT_UI) window.TMPT_UI.toast(`Budget ${getBulanName(activeMonth)} ${activeYear} dibuat baru.`, 'info');
  }

  await renderTab();
};

async function renderDashboard(container, summary) {
  // Hitung total alokasi persentase rencana (hanya non-income)
  const categories = await getAllFromStore('categories');
  const filteredCats = categories.filter(c => c.budget_id === currentBudgetId);
  const totalAllocationPct = filteredCats
    .filter(c => c.category_type !== 'income')
    .reduce((sum, c) => sum + parseFloat(c.target_pct || 0), 0);

  // Saldo awal (Pemasukan) merupakan Aktual dari total Pemasukkan
  const availableBalance = summary.actualIncome;

  const selisihRencana = availableBalance - summary.plannedExpense;
  const sisaUang = availableBalance - summary.actualExpense;
  const kemungkinanSisa = availableBalance - summary.plannedExpense;

  // Cek apakah periode ini sudah ditutup
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  const isClosed = budgetRecord && budgetRecord.status === 'closed';
  const periodBadge = isClosed
    ? `<span style="display:inline-block; font-size: 0.75rem; font-weight:700; padding: 0.15rem 0.6rem; border-radius: 6px; background: #ef4444; color: white; margin-left: 0.75rem;">✓ DITUTUP</span>`
    : `<span style="display:inline-block; font-size: 0.75rem; font-weight:700; padding: 0.15rem 0.6rem; border-radius: 6px; background: #10b981; color: white; margin-left: 0.75rem;">AKTIF</span>`;

  // Warning jika alokasi pengeluaran melebihi 100%
  const overAllocWarning = totalAllocationPct > 100 ? `
    <div style="background: rgba(239, 68, 68, 0.1); border: 2px solid #ef4444; border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.75rem;">
      <span style="font-size: 1.25rem;">🚨</span>
      <div>
        <strong style="color: #ef4444;">Alokasi Pengeluaran Melebihi 100%!</strong>
        <p style="margin: 0; font-size: 0.85rem; color: var(--pico-muted-color);">Total alokasi rencana pengeluaran Anda saat ini adalah <strong>${totalAllocationPct}%</strong>. Mohon sesuaikan alokasi persentase agar tidak melebihi 100%.</p>
      </div>
    </div>
  ` : '';

  const incomeCats = filteredCats.filter(c => c.category_type === 'income').sort((a, b) => (a.order || 0) - (b.order || 0));
  const expenseCats = filteredCats.filter(c => c.category_type !== 'income').sort((a, b) => (a.order || 0) - (b.order || 0));
  const allItems = await getAllFromStore('items');

  // --- Donut Chart Generation ---
  let donutHtml = '';
  if (expenseCats.length > 0) {
    const chartData = [];
    for (const c of expenseCats) {
      const catItems = allItems.filter(item => item.category_id === c.id);
      const actual = catItems.reduce((sum, i) => sum + parseFloat(i.actual_amount || 0), 0);
      const planned = catItems.reduce((sum, i) => sum + parseFloat(i.planned_amount || 0), 0);
      chartData.push({
        name: c.name,
        color: c.color || '#3b82f6',
        value: actual > 0 ? actual : planned,
        isActual: actual > 0
      });
    }

    const filteredChartData = chartData.filter(d => d.value > 0);
    const totalChartVal = filteredChartData.reduce((sum, d) => sum + d.value, 0);
    
    if (totalChartVal > 0) {
      let accumulatedPercent = 0;
      let svgCircles = '';
      filteredChartData.forEach(d => {
        const percent = (d.value / totalChartVal) * 100;
        const strokeDash = `${(percent / 100) * 314.16} 314.16`;
        const strokeOffset = `-${(accumulatedPercent / 100) * 314.16}`;
        svgCircles += `<circle cx="100" cy="100" r="50" fill="transparent" stroke="${d.color}" stroke-width="20" stroke-dasharray="${strokeDash}" stroke-dashoffset="${strokeOffset}" transform="rotate(-90 100 100)" />`;
        accumulatedPercent += percent;
        d.percent = percent;
      });

      const legendHtml = filteredChartData.map(d => `
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: var(--pico-muted-color);">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: ${d.color};"></span>
          <span>${d.name} (${d.percent.toFixed(0)}%)</span>
        </div>
      `).join('');

      donutHtml = `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem; width: 100%;">
          <svg viewBox="0 0 200 200" width="160" height="160" style="overflow: visible;">
            ${svgCircles}
            <circle cx="100" cy="100" r="40" fill="var(--pico-form-element-background-color)" />
            <text x="100" y="98" text-anchor="middle" font-size="10" font-weight="bold" fill="var(--pico-muted-color)" style="text-transform: uppercase;">Total</text>
            <text x="100" y="114" text-anchor="middle" font-size="12" font-weight="850" fill="var(--pico-heading-color)">${totalChartVal > 1000000 ? (totalChartVal/1000000).toFixed(1) + 'M' : totalChartVal.toLocaleString('id-ID')}</text>
          </svg>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 1rem; width: 100%;">
            ${legendHtml}
          </div>
        </div>
      `;
    } else {
      donutHtml = `<p class="secondary" style="font-size: 0.85rem; text-align: center;">Belum ada alokasi rencana atau realisasi pengeluaran.</p>`;
    }
  } else {
    donutHtml = `<p class="secondary" style="font-size: 0.85rem; text-align: center;">Belum ada kategori pengeluaran.</p>`;
  }

  // --- Line Chart Generation ---
  const txs = await getAllFromStore('transactions');
  const activeTxs = txs.filter(t => t.budget_id === currentBudgetId && (t.type === 'expense' || t.type === 'transfer'));
  
  const dailySpending = {};
  const daysInMonth = new Date(activeYear, activeMonth, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${activeYear}-${String(activeMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    dailySpending[dateStr] = 0;
  }
  
  activeTxs.forEach(t => {
    if (dailySpending[t.date] !== undefined) {
      dailySpending[t.date] += parseFloat(t.amount || 0);
    }
  });

  const dates = Object.keys(dailySpending).sort();
  const values = dates.map(d => dailySpending[d]);
  const maxVal = Math.max(...values, 100000);

  const width = 300;
  const height = 120;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 10;
  const paddingBottom = 20;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  const points = [];
  dates.forEach((date, index) => {
    const x = paddingLeft + (index / (dates.length - 1 || 1)) * chartWidth;
    const y = paddingTop + chartHeight - (values[index] / maxVal) * chartHeight;
    points.push(`${x},${y}`);
  });
  
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `M ${paddingLeft},${paddingTop + chartHeight} L ${points.join(' L ')} L ${paddingLeft + chartWidth},${paddingTop + chartHeight} Z`;

  const lineChartHtml = `
    <svg viewBox="0 0 300 120" style="width: 100%; height: auto; overflow: visible;">
      <!-- Grid lines -->
      <line x1="${paddingLeft}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${paddingTop}" stroke="var(--budget-card-border)" stroke-dasharray="3" />
      <line x1="${paddingLeft}" y1="${paddingTop + chartHeight/2}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight/2}" stroke="var(--budget-card-border)" stroke-dasharray="3" />
      <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight}" stroke="var(--budget-card-border)" />
      
      <!-- Y Axis Labels -->
      <text x="${paddingLeft - 5}" y="${paddingTop + 4}" font-size="8" text-anchor="end" fill="var(--pico-muted-color)">${maxVal >= 1000000 ? (maxVal/1000000).toFixed(1) + 'jt' : maxVal.toLocaleString()}</text>
      <text x="${paddingLeft - 5}" y="${paddingTop + chartHeight/2 + 4}" font-size="8" text-anchor="end" fill="var(--pico-muted-color)">${((maxVal/2) >= 1000000 ? (maxVal/2/1000000).toFixed(1) + 'jt' : (maxVal/2).toLocaleString())}</text>
      <text x="${paddingLeft - 5}" y="${paddingTop + chartHeight + 4}" font-size="8" text-anchor="end" fill="var(--pico-muted-color)">0</text>
      
      <!-- Area & Line -->
      <path d="${areaPath}" fill="rgba(59, 130, 246, 0.1)" />
      <path d="${linePath}" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      
      <!-- X Axis Labels -->
      <text x="${paddingLeft}" y="${height - 4}" font-size="8" text-anchor="start" fill="var(--pico-muted-color)">1 ${getBulanName(activeMonth).substring(0, 3)}</text>
      <text x="${paddingLeft + chartWidth/2}" y="${height - 4}" font-size="8" text-anchor="middle" fill="var(--pico-muted-color)">15 ${getBulanName(activeMonth).substring(0, 3)}</text>
      <text x="${width - paddingRight}" y="${height - 4}" font-size="8" text-anchor="end" fill="var(--pico-muted-color)">${daysInMonth} ${getBulanName(activeMonth).substring(0, 3)}</text>
    </svg>
  `;

  let pemHtml = '';
  for (let cat of incomeCats) {
    const catItems = allItems.filter(item => item.category_id === cat.id).sort((a, b) => (a.order || 0) - (b.order || 0));
    const catPlanned = catItems.reduce((sum, i) => sum + parseFloat(i.planned_amount || 0), 0);
    const catActual = catItems.reduce((sum, i) => sum + parseFloat(i.actual_amount || 0), 0);
    const progressVal = catPlanned > 0 ? Math.min(100, (catActual / catPlanned) * 100) : 0;
    const targetNominal = (cat.target_pct / 100) * availableBalance;

    pemHtml += `
      <div class="draggable-category" draggable="${!isClosed}" ondragstart="categoryDragStart(event, '${cat.id}')" ondragend="categoryDragEnd(event)" ondragover="allowDrop(event)" ondrop="categoryDrop(event, '${cat.id}')" style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px dashed var(--budget-card-border); cursor: ${isClosed ? 'default' : 'grab'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <strong style="color: #10b981; font-size: 1.05rem;">${cat.icon} ${cat.name}</strong>
            <span style="font-size: 0.82rem; font-weight: 600; color: var(--pico-muted-color);">${cat.target_pct || 0}% (${formatRupiah(targetNominal)})</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="secondary" style="font-size: 0.82rem;">Realisasi: ${formatRupiah(catActual)}</span>
            <strong style="font-size: 0.9rem;">Rencana: ${formatRupiah(catPlanned)}</strong>
            <button class="outline" style="padding: 0.15rem 0.4rem; font-size: 0.72rem; margin: 0; width: auto; color: var(--pico-muted-color); ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `editCategory('${cat.id}', '${cat.name}', ${cat.target_pct || 0})`}" ${isClosed ? 'disabled' : ''}>✏️</button>
            <button class="outline" style="padding: 0.15rem 0.4rem; font-size: 0.72rem; margin: 0; width: auto; color: #ef4444; border-color: #ef4444; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `deleteCategory('${cat.id}')`}" ${isClosed ? 'disabled' : ''}>🗑️</button>
          </div>
        </div>
        <progress value="${progressVal}" max="100" style="margin-bottom: 0.5rem; height: 8px; --pico-progress-color: #10b981; color: #10b981;"></progress>
        <div style="padding: 0 0.5rem;">
          ${catItems.map(item => `
            <div class="budget-item-row" draggable="${!isClosed}" ondragstart="itemDragStart(event, '${item.id}')" ondragend="itemDragEnd(event)" ondragover="allowDrop(event)" ondrop="itemDrop(event, '${item.id}')" style="display: flex; flex-direction: column; gap: 0.25rem; padding: 0.75rem 0; border-bottom: 1px solid var(--budget-card-border); cursor: ${isClosed ? 'default' : 'grab'};">
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  ${item.planned_amount > 0 ? `<input type="checkbox" style="margin: 0; transform: scale(1.1); cursor: pointer;" onchange="toggleItemRealization(this, '${item.id}', '${cat.category_type}', ${item.planned_amount})" ${item.actual_amount >= item.planned_amount ? 'checked' : ''} ${isClosed ? 'disabled' : ''}>` : ''}
                  <span style="font-weight: 600; font-size: 0.92rem; color: var(--pico-heading-color);">${item.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <span class="secondary" style="font-size: 0.8rem;">Rencana: <strong>${formatRupiah(item.planned_amount)}</strong></span>
                  <span class="secondary" style="font-size: 0.8rem;">Aktual: <strong style="color: ${item.actual_amount > item.planned_amount && item.planned_amount > 0 ? '#ef4444' : 'inherit'};">${formatRupiah(item.actual_amount)}</strong></span>
                  <div style="display: flex; gap: 0.35rem;">
                    <button class="outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; margin: 0; width: auto; border-radius: 6px; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `openEditItemModal('${item.id}')`}" ${isClosed ? 'disabled' : ''}>✏️ Edit</button>
                    <button class="outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; margin: 0; width: auto; color: #ef4444; border-color: #ef4444; border-radius: 6px; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `deleteItem('${item.id}')`}" ${isClosed ? 'disabled' : ''}>🗑️ Hapus</button>
                  </div>
                </div>
              </div>
              <progress value="${item.planned_amount > 0 ? Math.min(100, (item.actual_amount / item.planned_amount) * 100) : 0}" max="100" style="margin: 0.25rem 0 0 0; height: 6px; --pico-progress-color: #10b981; color: #10b981;"></progress>
            </div>
          `).join('')}
          <button class="outline" style="width: 100%; margin-top: 0.5rem; font-size: 0.82rem; padding: 0.3rem; color: #10b981; border-color: #10b981; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `openAddItemModal('${cat.id}')`}" ${isClosed ? 'disabled' : ''}>+ Tambah Item</button>
        </div>
      </div>
    `;
  }

  // --- Render Pengeluaran (Left Column) ---
  let pengCategoriesHtml = '';
  for (let cat of expenseCats) {
    const catItems = allItems.filter(item => item.category_id === cat.id).sort((a, b) => (a.order || 0) - (b.order || 0));
    const catPlanned = catItems.reduce((sum, i) => sum + parseFloat(i.planned_amount || 0), 0);
    const catActual = catItems.reduce((sum, i) => sum + parseFloat(i.actual_amount || 0), 0);
    const progressVal = catPlanned > 0 ? Math.min(100, (catActual / catPlanned) * 100) : 0;
    const targetNominal = (cat.target_pct / 100) * availableBalance;

    const isOverBudget = catActual > catPlanned && catPlanned > 0;
    const progressColor = isOverBudget ? '#ef4444' : (cat.color || '#3b82f6');
    const overBudgetBadge = isOverBudget 
      ? `<span style="font-size:0.75rem; font-weight:bold; background:rgba(239,68,68,0.1); color:#ef4444; padding:0.1rem 0.4rem; border-radius:4px; border: 1px solid #ef4444; margin-left:0.5rem;">🚨 MELEBIHI RENCANA</span>` 
      : '';

    pengCategoriesHtml += `
      <div class="draggable-category" draggable="${!isClosed}" ondragstart="categoryDragStart(event, '${cat.id}')" ondragend="categoryDragEnd(event)" ondragover="allowDrop(event)" ondrop="categoryDrop(event, '${cat.id}')" style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px dashed var(--budget-card-border); cursor: ${isClosed ? 'default' : 'grab'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <strong style="color: ${progressColor}; font-size: 1.05rem;">${cat.icon} ${cat.name} ${cat.target_pct || 0}%</strong>
            ${overBudgetBadge}
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="secondary" style="font-size: 0.82rem; color: ${isOverBudget ? '#ef4444' : 'inherit'};">Realisasi: ${formatRupiah(catActual)}</span>
            <strong style="font-size: 0.9rem;">Rencana: ${formatRupiah(catPlanned)} (Target: ${formatRupiah(targetNominal)})</strong>
            <button class="outline" style="padding: 0.15rem 0.4rem; font-size: 0.72rem; margin: 0; width: auto; color: var(--pico-muted-color); ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `editCategory('${cat.id}', '${cat.name}', ${cat.target_pct || 0})`}" ${isClosed ? 'disabled' : ''}>✏️</button>
            <button class="outline" style="padding: 0.15rem 0.4rem; font-size: 0.72rem; margin: 0; width: auto; color: #ef4444; border-color: #ef4444; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `deleteCategory('${cat.id}')`}" ${isClosed ? 'disabled' : ''}>🗑️</button>
          </div>
        </div>
        <progress value="${progressVal}" max="100" class="${isOverBudget ? 'progress-danger' : ''}" style="margin-bottom: 0.5rem; height: 8px; --pico-progress-color: ${progressColor}; color: ${progressColor};"></progress>
        <div style="padding: 0 0.5rem;">
          ${catItems.map(item => `
            <div class="budget-item-row" draggable="${!isClosed}" ondragstart="itemDragStart(event, '${item.id}')" ondragend="itemDragEnd(event)" ondragover="allowDrop(event)" ondrop="itemDrop(event, '${item.id}')" style="display: flex; flex-direction: column; gap: 0.25rem; padding: 0.75rem 0; border-bottom: 1px solid var(--budget-card-border); cursor: ${isClosed ? 'default' : 'grab'};">
              <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  ${item.planned_amount > 0 ? `<input type="checkbox" style="margin: 0; transform: scale(1.1); cursor: pointer;" onchange="toggleItemRealization(this, '${item.id}', '${cat.category_type}', ${item.planned_amount})" ${item.actual_amount >= item.planned_amount ? 'checked' : ''} ${isClosed ? 'disabled' : ''}>` : ''}
                  <span style="font-weight: 600; font-size: 0.92rem; color: var(--pico-heading-color);">${item.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <span class="secondary" style="font-size: 0.8rem;">Rencana: <strong>${formatRupiah(item.planned_amount)}</strong></span>
                  <span class="secondary" style="font-size: 0.8rem;">Aktual: <strong style="color: ${item.actual_amount > item.planned_amount && item.planned_amount > 0 ? '#ef4444' : 'inherit'};">${formatRupiah(item.actual_amount)}</strong></span>
                  <div style="display: flex; gap: 0.35rem;">
                    <button class="outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; margin: 0; width: auto; border-radius: 6px; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `openEditItemModal('${item.id}')`}" ${isClosed ? 'disabled' : ''}>✏️ Edit</button>
                    <button class="outline" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; margin: 0; width: auto; color: #ef4444; border-color: #ef4444; border-radius: 6px; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `deleteItem('${item.id}')`}" ${isClosed ? 'disabled' : ''}>🗑️ Hapus</button>
                  </div>
                </div>
              </div>
              <progress value="${item.planned_amount > 0 ? Math.min(100, (item.actual_amount / item.planned_amount) * 100) : 0}" max="100" style="margin: 0.25rem 0 0 0; height: 6px; --pico-progress-color: ${progressColor}; color: ${progressColor};"></progress>
            </div>
          `).join('')}
          <button class="outline" style="width: 100%; margin-top: 0.5rem; font-size: 0.82rem; padding: 0.3rem; color: ${progressColor}; border-color: ${progressColor}; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `openAddItemModal('${cat.id}')`}" ${isClosed ? 'disabled' : ''}>+ Tambah Item</button>
        </div>
      </div>
    `;
  }

  // --- Final Redesigned HTML Output ---
  container.innerHTML = `
    <!-- Top Dashboard Header & Subtitle -->
    <div style="margin-bottom: 1.5rem;">
      <h2 style="margin-bottom: 0.25rem; font-weight: 850; letter-spacing: -0.02em; color: var(--pico-heading-color);">Ringkasan Anggaran ${getBulanName(activeMonth)} ${activeYear}</h2>
      <p class="secondary" style="font-size: 0.9rem; margin-bottom: 0;">Perencanaan anggaran disiplin, pencatatan realtime, tutup buku carry forward, 100% lokal di browser Anda.</p>
    </div>

    <!-- Toolbar / Control Bar -->
    <div style="background: var(--budget-card-bg); border: 1px solid var(--budget-card-border); border-radius: 14px; padding: 0.75rem 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; box-shadow: var(--budget-glow);">
      <!-- Period Selector -->
      ${renderPeriodSelector()}
      
      <!-- Action Buttons -->
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button class="outline" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; margin: 0; border-radius: 8px;" onclick="${isClosed ? '' : "openAddCategoryModal('income')"}" ${isClosed ? 'disabled style="opacity:0.5; cursor:default;"' : ''}>+ Kat. Pemasukan</button>
        <button class="outline" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; margin: 0; border-radius: 8px;" onclick="${isClosed ? '' : 'openTemplatePicker()'}" ${isClosed ? 'disabled style="opacity:0.5; cursor:default;"' : ''}>Ganti Template</button>
        <button class="outline" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; margin: 0; border-radius: 8px; color: #8b5cf6; border-color: #8b5cf6;" onclick="${isClosed ? '' : 'openSaveTemplateModal()'}" ${isClosed ? 'disabled style="opacity:0.5; cursor:default;"' : ''}>💾 Simpan Template</button>
        ${isClosed 
          ? `<button class="btn-navy" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; margin: 0; border-radius: 8px; background: #d97706; border-color: #d97706;" onclick="reopenPeriod()">🔓 Buka Kembali</button>`
          : `<button class="btn-navy" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; margin: 0; border-radius: 8px;" onclick="openClosePeriodWizard()">🔒 Tutup Buku</button>`
        }
        <button class="outline" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; margin: 0; border-radius: 8px; color: #ef4444; border-color: #ef4444;" onclick="deleteActivePeriod()">🗑️ Hapus Periode</button>
      </div>
    </div>

    ${overAllocWarning}

    <!-- Three Summary Cards -->
    <div class="budget-grid-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 2rem;">
      <!-- Card 1: Pemasukan -->
      <div style="background: linear-gradient(135deg, #1e70e3 0%, #1e40af 100%); color: white; border-radius: 16px; padding: 1.5rem; border: none; box-shadow: 0 4px 15px rgba(30, 64, 175, 0.15); display: flex; flex-direction: column; justify-content: space-between; min-height: 150px;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-weight: 600; font-size: 0.95rem; opacity: 0.9;">Total Pemasukan</span>
            <span style="background: rgba(255, 255, 255, 0.2); color: white; font-size: 0.72rem; font-weight: 700; border-radius: 6px; padding: 0.15rem 0.5rem;">Pemasukan 100%</span>
          </div>
          <div style="font-size: 1.85rem; font-weight: 850; letter-spacing: -0.02em; margin-bottom: 1rem;">${formatRupiah(availableBalance)}</div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.15); padding-top: 0.75rem; font-size: 0.85rem; opacity: 0.9;">
          <span>Status: ${formatRupiah(availableBalance)}</span>
          <span style="font-size: 1.1rem; line-height: 1;">↗</span>
        </div>
      </div>

      <!-- Card 2: Rencana Pengeluaran -->
      <div style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: white; border-radius: 16px; padding: 1.5rem; border: none; box-shadow: 0 4px 15px rgba(185, 28, 28, 0.15); display: flex; flex-direction: column; justify-content: space-between; min-height: 150px;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-weight: 600; font-size: 0.95rem; opacity: 0.9;">Total Rencana Pengeluaran</span>
            <span style="background: rgba(255, 255, 255, 0.2); color: white; font-size: 0.72rem; font-weight: 700; border-radius: 6px; padding: 0.15rem 0.5rem;">Pengeluaran ${((summary.plannedExpense / (availableBalance || 1)) * 100).toFixed(0)}%</span>
          </div>
          <div style="font-size: 1.85rem; font-weight: 850; letter-spacing: -0.02em; margin-bottom: 1rem;">${formatRupiah(summary.plannedExpense)}</div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.15); padding-top: 0.75rem; font-size: 0.85rem; opacity: 0.9;">
          <span>Status: ${formatRupiah(summary.actualExpense)}</span>
          <span style="font-size: 1.1rem; line-height: 1;">→</span>
        </div>
      </div>

      <!-- Card 3: Sisa Anggaran -->
      <div style="background: linear-gradient(135deg, #10b981 0%, #047857 100%); color: white; border-radius: 16px; padding: 1.5rem; border: none; box-shadow: 0 4px 15px rgba(4, 120, 87, 0.15); display: flex; flex-direction: column; justify-content: space-between; min-height: 150px;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-weight: 600; font-size: 0.95rem; opacity: 0.9;">Sisa Anggaran</span>
            <span style="background: rgba(255, 255, 255, 0.2); color: white; font-size: 0.72rem; font-weight: 700; border-radius: 6px; padding: 0.15rem 0.5rem;">Sisa Anggaran ${isClosed ? 'DITUTUP' : 'AKTIF'}</span>
          </div>
          <div style="font-size: 1.85rem; font-weight: 850; letter-spacing: -0.02em; margin-bottom: 1rem;">${formatRupiah(availableBalance - summary.plannedExpense)}</div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.15); padding-top: 0.75rem; font-size: 0.85rem; opacity: 0.9;">
          <span>Status: ${formatRupiah(sisaUang)}</span>
          <span style="font-size: 1.1rem; line-height: 1;">↗</span>
        </div>
      </div>
    </div>

    <!-- Two-Column Layout Grid -->
    <div class="dashboard-grid-layout" style="display: grid; grid-template-columns: 1.6fr 1.0fr; gap: 2rem; align-items: start;">
      
      <!-- Left Column: Alokasi Pengeluaran & Pemasukan -->
      <div style="display: flex; flex-direction: column; gap: 2rem;">
        
        <!-- PEMASUKAN CARD BOX -->
        <div style="background: var(--budget-card-bg); border: 1px solid var(--budget-card-border); border-radius: 16px; padding: 1.5rem; box-shadow: var(--budget-glow);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--budget-card-border); padding-bottom: 0.75rem; margin-bottom: 1.25rem;">
            <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #10b981; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
              <span>💵</span> PEMASUKAN BULANAN
            </h4>
          </div>
          <div>
            ${pemHtml || `<p class="secondary" style="font-size: 0.85rem; text-align: center;">Belum ada kategori pemasukan. Klik tombol di atas untuk membuat.</p>`}
          </div>
        </div>

        <!-- PENGELUARAN & TRANSFER CARD BOX -->
        <div style="background: var(--budget-card-bg); border: 1px solid var(--budget-card-border); border-radius: 16px; padding: 1.5rem; box-shadow: var(--budget-glow);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--budget-card-border); padding-bottom: 0.75rem; margin-bottom: 1.25rem;">
            <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #ef4444; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
              <span>💸</span> PENGELUARAN &amp; TRANSFER
            </h4>
            <button class="outline" style="font-size: 0.82rem; padding: 0.35rem 0.75rem; margin: 0; border-radius: 8px;" onclick="${isClosed ? '' : "openAddCategoryModal('expense')"}" ${isClosed ? 'disabled style="opacity:0.5; cursor:default;"' : ''}>+ Kategori Pengeluaran</button>
          </div>
          <div>
            ${pengCategoriesHtml || `<p class="secondary" style="font-size: 0.85rem; text-align: center;">Belum ada kategori pengeluaran.</p>`}
          </div>
        </div>
      </div>

      <!-- Right Column: Analisis Keuangan -->
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Donut Chart Card -->
        <div style="background: var(--budget-card-bg); border: 1px solid var(--budget-card-border); border-radius: 16px; padding: 1.5rem; box-shadow: var(--budget-glow);">
          <h5 style="margin-bottom: 1rem; font-weight: 700; font-size: 1rem; color: var(--pico-heading-color);">Distribusi Pengeluaran</h5>
          <div style="display: flex; align-items: center; justify-content: center; min-height: 250px;">
            ${donutHtml}
          </div>
        </div>

        <!-- Line Chart Card -->
        <div style="background: var(--budget-card-bg); border: 1px solid var(--budget-card-border); border-radius: 16px; padding: 1.5rem; box-shadow: var(--budget-glow);">
          <h5 style="margin-bottom: 1rem; font-weight: 700; font-size: 1rem; color: var(--pico-heading-color);">Tren Pengeluaran Harian</h5>
          <div style="display: flex; justify-content: center; align-items: center; min-height: 140px;">
            ${lineChartHtml}
          </div>
        </div>
      </div>

    </div>
  `;

  // Update status badge di period selector jika elementnya ada
  const badge = document.getElementById('period-status-badge');
  if (badge) badge.textContent = isClosed ? '✓ DITUTUP' : 'AKTIF';
}

/** Helper: render satu baris item dengan tombol edit & hapus */
function renderItemRow(item, accentColor, isClosed = false) {
  return `
    <div class="budget-item-row" style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0; border-bottom: 1px solid var(--budget-card-border);">
      <span style="font-size: 0.9rem; flex: 1;">${item.name}</span>
      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end;">
        <span class="secondary" style="font-size: 0.8rem;">Rencana: ${formatRupiah(item.planned_amount)}</span>
        <strong style="font-size: 0.85rem;">Aktual: ${formatRupiah(item.actual_amount)}</strong>
        <button class="outline" style="padding: 0.1rem 0.4rem; font-size: 0.72rem; margin: 0; width: auto; color: ${accentColor}; border-color: ${accentColor}; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `openEditItemModal('${item.id}')`}" ${isClosed ? 'disabled' : ''}>✏️ Edit</button>
        <button class="outline" style="padding: 0.1rem 0.4rem; font-size: 0.72rem; margin: 0; width: auto; color: #ef4444; border-color: #ef4444; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `deleteItem('${item.id}')`}" ${isClosed ? 'disabled' : ''}>🗑️</button>
      </div>
    </div>
  `;
}

// ============================================================
// CRUD KATEGORI
// ============================================================

/** Buka modal tambah kategori */
window.openAddCategoryModal = function(defaultType = 'expense') {
  const overlay = document.createElement('dialog');
  overlay.id = 'modal-cat-add';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 480px; width: 95%;">
      <div class="modal-header">
        <h3>Tambah Kategori</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-cat-add').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <form id="form-cat-add" onsubmit="saveNewCategory(event)">
        <div style="margin-bottom: 1rem;">
          <label>Tipe Kategori</label>
          <select id="cat-type">
            <option value="expense" ${defaultType === 'expense' ? 'selected' : ''}>Pengeluaran</option>
            <option value="income" ${defaultType === 'income' ? 'selected' : ''}>Pemasukan</option>
            <option value="transfer">Transfer/Tabungan</option>
          </select>
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Nama Kategori</label>
          <input type="text" id="cat-name" required placeholder="Contoh: TAGIHAN RUTIN">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Ikon (emoji)</label>
          <input type="text" id="cat-icon" placeholder="Contoh: 📋" value="📁" maxlength="4">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Alokasi % dari Pemasukan</label>
          <input type="number" id="cat-pct" min="0" max="200" step="0.5" placeholder="Contoh: 10" value="0">
          <small class="secondary">Perkiraan alokasi dari total pemasukan (0–100%)</small>
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Warna (hex)</label>
          <input type="color" id="cat-color" value="#3b82f6" style="height: 2.5rem; padding: 0.2rem;">
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn-gray" onclick="document.getElementById('modal-cat-add').close(); this.closest('dialog').remove();">Batal</button>
          <button type="submit" class="btn-navy" style="margin: 0;">Simpan Kategori</button>
        </div>
      </form>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.saveNewCategory = async function(e) {
  e.preventDefault();
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat menambah kategori pada periode yang ditutup.', 'warning');
    return;
  }
  const name = document.getElementById('cat-name').value.trim().toUpperCase();
  const icon = document.getElementById('cat-icon').value.trim() || '📁';
  const pct = parseFloat(document.getElementById('cat-pct').value) || 0;
  const color = document.getElementById('cat-color').value;
  const type = document.getElementById('cat-type').value;

  const catId = `cat_${currentBudgetId}_custom_${Date.now()}`;
  const category = {
    id: catId,
    budget_id: currentBudgetId,
    name,
    icon,
    color,
    target_pct: pct,
    category_type: type,
    order: 99
  };
  await putToStore('categories', category);
  document.getElementById('modal-cat-add').close();
  document.getElementById('modal-cat-add').remove();
  if (window.TMPT_UI) window.TMPT_UI.toast(`Kategori ${name} berhasil ditambahkan`, 'success');
  await renderTab();
};

/** Edit nama dan persen kategori */
window.editCategory = async function(catId, currentName, currentPct) {
  const overlay = document.createElement('dialog');
  overlay.id = 'modal-cat-edit';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 440px; width: 95%;">
      <div class="modal-header">
        <h3>Edit Kategori</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-cat-edit').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <form id="form-cat-edit" onsubmit="saveCategoryEdit(event, '${catId}')">
        <div style="margin-bottom: 1rem;">
          <label>Nama Kategori</label>
          <input type="text" id="cat-edit-name" required value="${currentName}">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Alokasi % dari Pemasukan</label>
          <input type="number" id="cat-edit-pct" min="0" max="200" step="0.5" value="${currentPct}">
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn-gray" onclick="document.getElementById('modal-cat-edit').close(); this.closest('dialog').remove();">Batal</button>
          <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
        </div>
      </form>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.saveCategoryEdit = async function(e, catId) {
  e.preventDefault();
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat mengedit kategori pada periode yang ditutup.', 'warning');
    return;
  }
  const cat = await getFromStore('categories', catId);
  if (!cat) return;
  cat.name = document.getElementById('cat-edit-name').value.trim().toUpperCase();
  cat.target_pct = parseFloat(document.getElementById('cat-edit-pct').value) || 0;
  await putToStore('categories', cat);
  document.getElementById('modal-cat-edit').close();
  document.getElementById('modal-cat-edit').remove();
  if (window.TMPT_UI) window.TMPT_UI.toast('Kategori berhasil diperbarui', 'success');
  await renderTab();
};

window.deleteCategory = async function(catId) {
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat menghapus kategori pada periode yang ditutup.', 'warning');
    return;
  }
  const confirmed = await showConfirmModal('Hapus kategori ini beserta semua item di dalamnya?');
  if (!confirmed) return;
  // Hapus semua item dalam kategori
  const items = await getAllByIndexFromStore('items', 'by_category', catId);
  for (const item of items) {
    await deleteFromStore('items', item.id);
  }
  await deleteFromStore('categories', catId);
  if (window.TMPT_UI) window.TMPT_UI.toast('Kategori berhasil dihapus', 'info');
  await renderTab();
};

// ============================================================
// CRUD ITEM
// ============================================================

/** Buka modal tambah item baru ke kategori */
window.openAddItemModal = function(categoryId) {
  const overlay = document.createElement('dialog');
  overlay.id = 'modal-item-add';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 460px; width: 95%;">
      <div class="modal-header">
        <h3>Tambah Item</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-item-add').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <form id="form-item-add" onsubmit="saveNewItem(event, '${categoryId}')">
        <div style="margin-bottom: 1rem;">
          <label>Nama Item</label>
          <input type="text" id="item-add-name" required placeholder="Contoh: Gaji Pokok">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Jumlah Rencana (Rp)</label>
          <input type="number" id="item-add-planned" min="0" placeholder="0" value="0">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Jumlah Aktual (Rp)</label>
          <input type="number" id="item-add-actual" min="0" placeholder="0" value="0">
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn-gray" onclick="document.getElementById('modal-item-add').close(); this.closest('dialog').remove();">Batal</button>
          <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
        </div>
      </form>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.saveNewItem = async function(e, categoryId) {
  e.preventDefault();
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat menambah item pada periode yang ditutup.', 'warning');
    return;
  }
  const name = document.getElementById('item-add-name').value.trim();
  const planned = parseFloat(document.getElementById('item-add-planned').value) || 0;
  const actual = parseFloat(document.getElementById('item-add-actual').value) || 0;

  const itemId = `item_${categoryId}_${Date.now()}`;
  const item = {
    id: itemId,
    category_id: categoryId,
    name,
    description: '',
    planned_amount: planned,
    actual_amount: actual,
    is_fixed: false,
    due_date: null,
    order: Date.now()
  };
  await putToStore('items', item);

  if (actual > 0) {
    const cat = await getFromStore('categories', categoryId);
    const txType = cat && cat.category_type === 'income' ? 'income' : 'expense';
    const tx = {
      id: `tx_manual_${itemId}_${Date.now()}`,
      budget_id: currentBudgetId,
      budget_item_id: itemId,
      type: txType,
      amount: actual,
      description: `Penyesuaian Awal: ${name}`,
      date: new Date().toISOString().substring(0, 10),
      payment_method: 'Manual',
      tags: ['manual']
    };
    await putToStore('transactions', tx);
  }

  document.getElementById('modal-item-add').close();
  document.getElementById('modal-item-add').remove();
  if (window.TMPT_UI) window.TMPT_UI.toast(`Item "${name}" berhasil ditambahkan`, 'success');
  await renderTab();
};

/** Buka modal edit item (nama, rencana, aktual) */
window.openEditItemModal = async function(itemId) {
  const item = await getFromStore('items', itemId);
  if (!item) return;

  const overlay = document.createElement('dialog');
  overlay.id = 'modal-item-edit';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 460px; width: 95%;">
      <div class="modal-header">
        <h3>Edit Item: ${item.name}</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-item-edit').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <form id="form-item-edit" onsubmit="saveItemEdit(event, '${itemId}')">
        <div style="margin-bottom: 1rem;">
          <label>Nama Item</label>
          <input type="text" id="item-edit-name" required value="${item.name}">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Jumlah Rencana (Rp)</label>
          <input type="number" id="item-edit-planned" min="0" value="${item.planned_amount || 0}">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Jumlah Aktual (Rp)</label>
          <input type="number" id="item-edit-actual" min="0" value="${item.actual_amount || 0}">
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn-gray" onclick="document.getElementById('modal-item-edit').close(); this.closest('dialog').remove();">Batal</button>
          <button type="submit" class="btn-navy" style="margin: 0;">Simpan Perubahan</button>
        </div>
      </form>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.saveItemEdit = async function(e, itemId) {
  e.preventDefault();
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat mengedit item pada periode yang ditutup.', 'warning');
    return;
  }
  const item = await getFromStore('items', itemId);
  if (!item) return;
  
  const name = document.getElementById('item-edit-name').value.trim();
  const planned = parseFloat(document.getElementById('item-edit-planned').value) || 0;
  const actual = parseFloat(document.getElementById('item-edit-actual').value) || 0;
  
  item.name = name;
  item.planned_amount = planned;
  item.actual_amount = actual;
  await putToStore('items', item);

  const cat = await getFromStore('categories', item.category_id);
  const txType = cat && cat.category_type === 'income' ? 'income' : 'expense';
  const allTxs = await getAllFromStore('transactions');
  const itemTxs = allTxs.filter(t => t.budget_item_id === item.id);

  if (itemTxs.length === 0) {
    if (actual > 0) {
      const tx = {
        id: `tx_manual_${item.id}_${Date.now()}`,
        budget_id: currentBudgetId,
        budget_item_id: item.id,
        type: txType,
        amount: actual,
        description: `Penyesuaian: ${item.name}`,
        date: new Date().toISOString().substring(0, 10),
        payment_method: 'Manual',
        tags: ['manual']
      };
      await putToStore('transactions', tx);
    }
  } else if (itemTxs.length === 1) {
    if (actual > 0) {
      itemTxs[0].amount = actual;
      itemTxs[0].type = txType;
      itemTxs[0].description = `Penyesuaian: ${item.name}`;
      await putToStore('transactions', itemTxs[0]);
    } else {
      await deleteFromStore('transactions', itemTxs[0].id);
    }
  } else {
    for (const t of itemTxs) {
      await deleteFromStore('transactions', t.id);
    }
    if (actual > 0) {
      const tx = {
        id: `tx_manual_${item.id}_${Date.now()}`,
        budget_id: currentBudgetId,
        budget_item_id: item.id,
        type: txType,
        amount: actual,
        description: `Penyesuaian: ${item.name}`,
        date: new Date().toISOString().substring(0, 10),
        payment_method: 'Manual',
        tags: ['manual']
      };
      await putToStore('transactions', tx);
    }
  }

  document.getElementById('modal-item-edit').close();
  document.getElementById('modal-item-edit').remove();
  if (window.TMPT_UI) window.TMPT_UI.toast('Item berhasil diperbarui dan transaksi disesuaikan', 'success');
  await renderTab();
};

window.deleteItem = async function(itemId) {
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat menghapus item pada periode yang ditutup.', 'warning');
    return;
  }
  const confirmed = await showConfirmModal('Hapus item ini dari budget beserta seluruh transaksi terkait?');
  if (!confirmed) return;
  const txs = await getAllFromStore('transactions');
  const itemTxs = txs.filter(t => t.budget_item_id === itemId);
  for (const t of itemTxs) {
    await deleteFromStore('transactions', t.id);
  }
  await deleteFromStore('items', itemId);
  if (window.TMPT_UI) window.TMPT_UI.toast('Item dan transaksi terkait berhasil dihapus', 'info');
  await renderTab();
};

// ============================================================
// TRANSAKSI
// ============================================================

async function renderTransactions(container) {
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  const isClosed = budgetRecord && budgetRecord.status === 'closed';

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <h3>Riwayat Transaksi — ${getBulanName(activeMonth)} ${activeYear}</h3>
      <button class="btn-navy" onclick="${isClosed ? '' : 'openAddTransactionModal()'}" ${isClosed ? 'disabled style="opacity:0.5; cursor:default;"' : ''}>+ Tambah Transaksi</button>
    </div>
    <div id="tx-table-container">Memuat transaksi...</div>
  `;

  const txs = await getAllFromStore('transactions');
  const filteredTxs = txs.filter(t => t.budget_id === currentBudgetId);
  const txContainer = document.getElementById('tx-table-container');

  if (filteredTxs.length === 0) {
    txContainer.innerHTML = `<p class="secondary">Belum ada transaksi untuk periode ini.</p>`;
    return;
  }

  txContainer.innerHTML = `
    <figure>
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Deskripsi</th>
            <th>Tipe</th>
            <th>Nominal</th>
            <th>Metode</th>
            <th>Tindakan</th>
          </tr>
        </thead>
        <tbody>
          ${filteredTxs.map(t => `
            <tr>
              <td>${t.date}</td>
              <td>${t.description}</td>
              <td><span class="badge-${t.type}">${t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span></td>
              <td>Rp ${parseFloat(t.amount).toLocaleString('id-ID')}</td>
              <td>${t.payment_method || '-'}</td>
              <td>
                <button class="outline" style="padding: 0.1rem 0.4rem; font-size: 0.75rem; border-color: #ef4444; color: #ef4444; margin: 0; width: auto; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `deleteTransaction('${t.id}')`}" ${isClosed ? 'disabled' : ''}>Hapus</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </figure>
  `;
}

window.deleteTransaction = async function(txId) {
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat menghapus transaksi pada periode yang ditutup.', 'warning');
    return;
  }
  const confirmed = await showConfirmModal('Hapus transaksi ini?');
  if (!confirmed) return;
  await deleteFromStore('transactions', txId);
  if (window.TMPT_UI) window.TMPT_UI.toast('Transaksi berhasil dihapus', 'info');
  await renderTab();
};

window.openAddTransactionModal = async function() {
  const allItems = await getAllFromStore('items');
  const cats = await getAllByIndexFromStore('categories', 'by_budget', currentBudgetId);
  const catIds = new Set(cats.map(c => c.id));
  const activeItems = allItems.filter(i => catIds.has(i.category_id));

  window._activeItemsForTx = activeItems;
  window._catsForTx = cats;

  const overlay = document.createElement('dialog');
  overlay.id = 'modal-tx-add';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 500px; width: 95%;">
      <div class="modal-header">
        <h3>Tambah Transaksi</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-tx-add').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <form id="form-tx-add" onsubmit="saveTransaction(event)">
        <div style="margin-bottom: 1rem;">
          <label>Tipe Transaksi</label>
          <select id="tx-type" onchange="toggleItemSelect(this.value)">
            <option value="expense">Pengeluaran</option>
            <option value="income">Pemasukan</option>
          </select>
        </div>
        <div style="margin-bottom: 1rem;" id="tx-item-container">
          <label>Item Anggaran</label>
          <select id="tx-item-id" required onchange="window.updateTxDesc()">
            <!-- Diisi dinamis -->
          </select>
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Nominal (Rp)</label>
          <input type="number" id="tx-amount" required placeholder="Contoh: 50000">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Keterangan</label>
          <input type="text" id="tx-desc" required placeholder="Auto-keterangan">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Tanggal</label>
          <input type="date" id="tx-date" required value="${new Date().toISOString().substring(0, 10)}">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Metode Pembayaran</label>
          <input type="text" id="tx-method" placeholder="Contoh: BCA, OVO, Cash">
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn-gray" onclick="document.getElementById('modal-tx-add').close(); this.closest('dialog').remove();">Batal</button>
          <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
        </div>
      </form>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
  toggleItemSelect('expense');
};

window.toggleItemSelect = function(type) {
  const selectEl = document.getElementById('tx-item-id');
  if (!selectEl) return;
  const items = window._activeItemsForTx || [];
  const cats = window._catsForTx || [];

  const filtered = items.filter(item => {
    const cat = cats.find(c => c.id === item.category_id);
    if (!cat) return false;
    if (type === 'income') {
      return cat.category_type === 'income';
    } else {
      return cat.category_type === 'expense' || cat.category_type === 'transfer';
    }
  });

  if (filtered.length === 0) {
    selectEl.innerHTML = `<option value="">-- Buat item kategori ${type === 'income' ? 'Pemasukan' : 'Pengeluaran'} terlebih dahulu --</option>`;
  } else {
    selectEl.innerHTML = filtered.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
  }
  
  window.updateTxDesc();
};

window.updateTxDesc = function() {
  const typeEl = document.getElementById('tx-type');
  const itemEl = document.getElementById('tx-item-id');
  const descEl = document.getElementById('tx-desc');
  if (typeEl && itemEl && descEl) {
    const typeText = typeEl.value === 'income' ? 'Pemasukan' : 'Pengeluaran';
    const selectedOption = itemEl.options[itemEl.selectedIndex];
    const itemName = selectedOption ? selectedOption.text : '';
    if (itemName && !itemName.startsWith('--')) {
      descEl.value = `${typeText} ${itemName}`;
    } else {
      descEl.value = '';
    }
  }
};

window.saveTransaction = async function(e) {
  e.preventDefault();
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat menambah transaksi pada periode yang ditutup.', 'warning');
    return;
  }
  const txId = `tx_${Date.now()}`;
  const itemId = document.getElementById('tx-item-id').value;
  const txType = document.getElementById('tx-type').value;

  if (!itemId) {
    if (window.TMPT_UI) window.TMPT_UI.toast('Silakan pilih Item Anggaran terlebih dahulu!', 'warning');
    return;
  }

  const tx = {
    id: txId,
    budget_id: currentBudgetId,
    budget_item_id: itemId,
    type: txType,
    amount: parseFloat(document.getElementById('tx-amount').value),
    description: document.getElementById('tx-desc').value,
    date: document.getElementById('tx-date').value,
    payment_method: document.getElementById('tx-method').value,
    tags: []
  };

  await putToStore('transactions', tx);
  document.getElementById('modal-tx-add').close();
  document.getElementById('modal-tx-add').remove();
  if (window.TMPT_UI) window.TMPT_UI.toast('Transaksi berhasil dicatat', 'success');
  await renderTab();
};

// ============================================================
// LAPORAN, GOALS, ADVISOR, IMPORT
// ============================================================

async function renderReports(container, summary) {
  const categories = await getAllByIndexFromStore('categories', 'by_budget', currentBudgetId);
  const allItems = await getAllFromStore('items');
  
  const categoryReports = [];
  for (const cat of categories) {
    const catItems = allItems.filter(item => item.category_id === cat.id);
    const planned = catItems.reduce((sum, item) => sum + parseFloat(item.planned_amount || 0), 0);
    const actual = catItems.reduce((sum, item) => sum + parseFloat(item.actual_amount || 0), 0);
    categoryReports.push({
      ...cat,
      planned,
      actual,
      diff: planned - actual
    });
  }

  categoryReports.sort((a, b) => {
    if (a.category_type === 'income' && b.category_type !== 'income') return -1;
    if (a.category_type !== 'income' && b.category_type === 'income') return 1;
    return 0;
  });

  const actualInc = summary.actualIncome || 0;
  const actualExp = summary.actualExpense || 0;
  const actualSav = summary.actualSavings || 0;

  const savingsRate = actualInc > 0 ? (actualSav / actualInc) * 100 : 0;
  const spendingRate = actualInc > 0 ? (actualExp / actualInc) * 100 : 0;

  let savingsStatusClass = 'badge-expense';
  let savingsStatusText = 'Rendah (< 10%)';
  if (savingsRate >= 20) {
    savingsStatusClass = 'badge-income';
    savingsStatusText = 'Sangat Sehat (≥ 20%)';
  } else if (savingsRate >= 10) {
    savingsStatusClass = 'badge-income';
    savingsStatusText = 'Cukup Sehat (10%-19%)';
  }

  let spendingStatusClass = 'badge-income';
  let spendingStatusText = 'Ideal (< 70%)';
  if (spendingRate >= 90) {
    spendingStatusClass = 'badge-expense';
    spendingStatusText = 'Kritis (≥ 90%)';
  } else if (spendingRate >= 70) {
    spendingStatusClass = 'badge-expense';
    spendingStatusText = 'Waspada (70%-89%)';
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <h3>Laporan & Analisis Keuangan — ${getBulanName(activeMonth)} ${activeYear}</h3>
    </div>

    <div class="budget-grid-summary" style="margin-bottom: 2rem;">
      <div class="budget-card-stat">
        <h4>Rasio Tabungan (Savings Rate)</h4>
        <div class="value">${savingsRate.toFixed(1)}%</div>
        <div style="margin-top: 0.5rem;"><span class="${savingsStatusClass}">${savingsStatusText}</span></div>
      </div>
      <div class="budget-card-stat">
        <h4>Rasio Pengeluaran</h4>
        <div class="value">${spendingRate.toFixed(1)}%</div>
        <div style="margin-top: 0.5rem;"><span class="${spendingStatusClass}">${spendingStatusText}</span></div>
      </div>
      <div class="budget-card-stat">
        <h4>Sisa Saldo Aktual</h4>
        <div class="value" style="color: ${actualSav >= 0 ? '#10b981' : '#ef4444'};">${formatRupiah(actualSav)}</div>
        <div style="margin-top: 0.5rem;"><span class="secondary" style="font-size: 0.75rem;">Pendapatan dikurangi pengeluaran</span></div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
      <div class="budget-category-box">
        <h5 style="margin-bottom: 1rem;">📊 Perbandingan Kas Aktual</h5>
        <svg viewBox="0 0 400 220" style="background: var(--pico-form-element-background-color); border-radius: 12px; padding: 1rem; width: 100%; height: auto;">
          <line x1="50" y1="20" x2="350" y2="20" stroke="var(--budget-card-border)" stroke-dasharray="4" />
          <line x1="50" y1="100" x2="350" y2="100" stroke="var(--budget-card-border)" stroke-dasharray="4" />
          <line x1="50" y1="180" x2="350" y2="180" stroke="var(--budget-card-border)" stroke-dasharray="4" />

          <rect x="70" y="40" width="45" height="140" fill="#3b82f6" opacity="0.3" rx="4" />
          <rect x="70" y="${180 - Math.min(140, (summary.actualIncome / (Math.max(summary.actualIncome, summary.actualExpense) || 1)) * 140)}" width="45" height="${Math.min(140, (summary.actualIncome / (Math.max(summary.actualIncome, summary.actualExpense) || 1)) * 140)}" fill="#3b82f6" rx="4" />
          <text x="92.5" y="198" fill="var(--pico-color)" font-size="10" font-weight="bold" text-anchor="middle">Income</text>

          <rect x="160" y="40" width="45" height="140" fill="#ef4444" opacity="0.3" rx="4" />
          <rect x="160" y="${180 - Math.min(140, (summary.plannedExpense / (Math.max(summary.plannedExpense, summary.actualExpense) || 1)) * 140)}" width="45" height="${Math.min(140, (summary.plannedExpense / (Math.max(summary.plannedExpense, summary.actualExpense) || 1)) * 140)}" fill="#ef4444" rx="4" />
          <text x="182.5" y="198" fill="var(--pico-color)" font-size="10" font-weight="bold" text-anchor="middle">Plan Exp</text>

          <rect x="250" y="40" width="45" height="140" fill="#10b981" opacity="0.3" rx="4" />
          <rect x="250" y="${180 - Math.min(140, (summary.actualExpense / (Math.max(summary.plannedExpense, summary.actualExpense) || 1)) * 140)}" width="45" height="${Math.min(140, (summary.actualExpense / (Math.max(summary.plannedExpense, summary.actualExpense) || 1)) * 140)}" fill="#10b981" rx="4" />
          <text x="272.5" y="198" fill="var(--pico-color)" font-size="10" font-weight="bold" text-anchor="middle">Act Exp</text>
        </svg>
      </div>

      <div class="budget-category-box" style="display: flex; flex-direction: column; justify-content: center;">
        <h5 style="margin-bottom: 0.75rem;">💡 Ringkasan Analitis</h5>
        <p style="font-size: 0.9rem; line-height: 1.6; margin-bottom: 0.5rem;">
          Total Pemasukan Aktual Anda sebesar <strong>${formatRupiah(actualInc)}</strong>, sedangkan alokasi Pengeluaran/Transfer Aktual mencapai <strong>${formatRupiah(actualExp)}</strong>.
        </p>
        <p style="font-size: 0.9rem; line-height: 1.6; margin-bottom: 0.5rem;">
          ${actualSav >= 0 
            ? `Anda memiliki surplus anggaran sebesar <strong style="color:#10b981;">${formatRupiah(actualSav)}</strong> periode ini. Angka ini bisa dialokasikan lebih lanjut ke tabungan atau instrumen investasi.`
            : `Anda mengalami defisit anggaran sebesar <strong style="color:#ef4444;">${formatRupiah(Math.abs(actualSav))}</strong>. Tinjau kembali pengeluaran non-rutin Anda.`}
        </p>
      </div>
    </div>

    <div class="budget-category-box">
      <h5 style="margin-bottom: 1rem;">📋 Rincian Realisasi per Kategori Anggaran</h5>
      <figure>
        <table style="width: 100%; font-size: 0.9rem;">
          <thead>
            <tr>
              <th>Kategori</th>
              <th style="text-align: right;">Rencana</th>
              <th style="text-align: right;">Aktual</th>
              <th style="text-align: right;">Selisih (Hemat/Boros)</th>
              <th style="text-align: center; width: 120px;">Penyerapan</th>
            </tr>
          </thead>
          <tbody>
            ${categoryReports.map(c => {
              const absorption = c.planned > 0 ? Math.min(100, (c.actual / c.planned) * 100) : 0;
              const isIncome = c.category_type === 'income';
              let diffText = '';
              let diffColor = 'inherit';

              if (isIncome) {
                const extraIncome = c.actual - c.planned;
                diffText = extraIncome >= 0 ? `+${formatRupiah(extraIncome)}` : `-${formatRupiah(Math.abs(extraIncome))}`;
                diffColor = extraIncome >= 0 ? '#10b981' : '#ef4444';
              } else {
                const savings = c.planned - c.actual;
                diffText = savings >= 0 ? `+${formatRupiah(savings)} (Hemat)` : `-${formatRupiah(Math.abs(savings))} (Boros)`;
                diffColor = savings >= 0 ? '#10b981' : '#ef4444';
              }

              return `
                <tr>
                  <td><strong>${c.icon} ${c.name}</strong></td>
                  <td style="text-align: right;">${formatRupiah(c.planned)}</td>
                  <td style="text-align: right; font-weight: bold;">${formatRupiah(c.actual)}</td>
                  <td style="text-align: right; color: ${diffColor}; font-weight: 600;">${diffText}</td>
                  <td style="text-align: center; vertical-align: middle;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <progress value="${absorption}" max="100" style="margin: 0; height: 8px;"></progress>
                      <span style="font-size: 0.75rem; font-weight: bold;">${absorption.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </figure>
    </div>
  `;
}

async function renderGoals(container) {
  const goals = await getAllFromStore('goals');
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <h3>Financial Goals</h3>
      <button class="btn-navy" onclick="openAddGoalModal()">+ Tambah Goal</button>
    </div>
    <div id="goals-list-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
      Memuat target...
    </div>
  `;

  const listContainer = document.getElementById('goals-list-container');
  if (goals.length === 0) {
    listContainer.innerHTML = `<p class="secondary" style="grid-column: 1/-1;">Belum ada target keuangan jangka panjang.</p>`;
    return;
  }

  listContainer.innerHTML = goals.map(g => {
    const current = (g.savings || []).reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    const pct = g.target_amount > 0 ? Math.min(100, (current / g.target_amount) * 100) : 0;
    return `
      <div class="budget-category-box" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
            <strong style="font-size: 1.05rem;">🎯 ${g.name}</strong>
            <span class="badge-${g.type === 'saving' ? 'income' : 'expense'}" style="font-size: 0.7rem; text-transform: uppercase;">${g.type === 'saving' ? 'Tabungan' : 'Investasi'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size: 0.9rem; margin-bottom: 0.5rem;">
            <span class="secondary">Terkumpul:</span>
            <strong>${formatRupiah(current)} / ${formatRupiah(g.target_amount)}</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
            <progress value="${pct}" max="100" style="margin: 0; height: 8px;"></progress>
            <span style="font-size: 0.8rem; font-weight: bold; min-width: 35px; text-align: right;">${pct.toFixed(0)}%</span>
          </div>
          <div style="font-size:0.8rem; margin-bottom: 1rem;" class="secondary">
            Rencana Bulanan: <strong>${formatRupiah(g.monthly_contribution)}/bulan</strong>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; margin-top: auto;">
          <button class="outline" style="flex: 1; padding: 0.3rem 0.5rem; font-size: 0.8rem; margin: 0;" onclick="openGoalDetailModal('${g.id}')">📂 Setoran & Detail</button>
          <button class="outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; color: #ef4444; border-color: #ef4444; margin: 0;" onclick="deleteGoal('${g.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

window.openAddGoalModal = function() {
  const overlay = document.createElement('dialog');
  overlay.id = 'modal-goal-add';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 500px; width: 95%;">
      <div class="modal-header">
        <h3>Tambah Financial Goal</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-goal-add').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <form id="form-goal-add" onsubmit="saveGoal(event)">
        <div style="margin-bottom: 1rem;">
          <label>Nama Goal</label>
          <input type="text" id="goal-name" required placeholder="Contoh: Dana Darurat">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Kategori</label>
          <select id="goal-type">
            <option value="saving">Tabungan</option>
            <option value="investment">Investasi</option>
          </select>
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Target Nominal (Rp)</label>
          <input type="number" id="goal-target" min="0" required placeholder="Contoh: 10000000">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Kontribusi Bulanan (Rp)</label>
          <input type="number" id="goal-contrib" min="0" required placeholder="Contoh: 500000">
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn-gray" onclick="document.getElementById('modal-goal-add').close(); this.closest('dialog').remove();">Batal</button>
          <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
        </div>
      </form>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.saveGoal = async function(e) {
  e.preventDefault();
  const goal = {
    id: `goal_${Date.now()}`,
    name: document.getElementById('goal-name').value.trim(),
    type: document.getElementById('goal-type').value,
    target_amount: parseFloat(document.getElementById('goal-target').value) || 0,
    current_amount: 0,
    monthly_contribution: parseFloat(document.getElementById('goal-contrib').value) || 0,
    savings: [],
    is_active: true
  };
  await putToStore('goals', goal);

  // --- Buat item anggaran otomatis di dasbor periode berjalan agar langsung sinkron ---
  const cats = await getAllByIndexFromStore('categories', 'by_budget', currentBudgetId);
  const catIds = cats.map(c => c.id);
  const allItems = await getAllFromStore('items');
  const activeItems = allItems.filter(i => catIds.includes(i.category_id));

  let matchedItem = activeItems.find(i => i.name.toLowerCase() === goal.name.toLowerCase());
  if (!matchedItem) {
    // Tentukan parameter kategori target berdasarkan tipe goal
    let targetCatName = 'CICILAN';
    let targetCatIcon = '💳';
    let targetCatColor = '#ef4444';
    let targetCatType = 'expense';

    if (goal.type === 'saving') {
      targetCatName = 'TABUNGAN';
      targetCatIcon = '💰';
      targetCatColor = '#10b981';
      targetCatType = 'transfer';
    } else if (goal.type === 'investment') {
      targetCatName = 'INVEST';
      targetCatIcon = '📈';
      targetCatColor = '#8b5cf6';
      targetCatType = 'transfer';
    }

    // Cari kategori di periode berjalan
    let targetCat = cats.find(c => c.name.toUpperCase() === targetCatName);
    if (!targetCat) {
      const catId = `cat_${currentBudgetId}_${targetCatName.toLowerCase()}_${Date.now()}`;
      targetCat = {
        id: catId,
        budget_id: currentBudgetId,
        name: targetCatName,
        icon: targetCatIcon,
        color: targetCatColor,
        target_pct: 10,
        category_type: targetCatType,
        order: 90
      };
      await putToStore('categories', targetCat);
    }

    // Buat item baru di bawah kategori target
    const itemId = `item_${targetCat.id}_goal_${Date.now()}`;
    const newItem = {
      id: itemId,
      category_id: targetCat.id,
      name: goal.name,
      description: `Rencana alokasi otomatis untuk Goal: ${goal.name}`,
      planned_amount: goal.monthly_contribution || 0,
      actual_amount: 0,
      is_fixed: false,
      due_date: null,
      order: 99
    };
    await putToStore('items', newItem);
  }

  document.getElementById('modal-goal-add').close();
  document.getElementById('modal-goal-add').remove();
  if (window.TMPT_UI) window.TMPT_UI.toast('Financial Goal berhasil disimpan dan disinkronkan ke Dasbor!', 'success');
  await renderTab();
};

window.deleteGoal = async function(goalId) {
  const confirmed = await showConfirmModal('Hapus target finansial ini beserta seluruh riwayat setorannya?');
  if (!confirmed) return;
  await deleteFromStore('goals', goalId);
  if (window.TMPT_UI) window.TMPT_UI.toast('Goal berhasil dihapus', 'info');
  await renderTab();
};

window.openGoalDetailModal = async function(goalId) {
  const g = await getFromStore('goals', goalId);
  if (!g) return;

  const current = (g.savings || []).reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
  const pct = g.target_amount > 0 ? Math.min(100, (current / g.target_amount) * 100) : 0;

  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  const isClosed = budgetRecord && budgetRecord.status === 'closed';

  const overlay = document.createElement('dialog');
  overlay.id = 'modal-goal-detail';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 600px; width: 95%;">
      <div class="modal-header">
        <h3>Detail Goal: ${g.name}</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-goal-detail').close(); this.closest('dialog').remove();">✕</button>
      </div>
      
      <div style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--budget-card-border); padding-bottom: 1rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem;">
          <span class="secondary">Status Progres (${pct.toFixed(0)}%):</span>
          <strong>${formatRupiah(current)} / ${formatRupiah(g.target_amount)}</strong>
        </div>
        <progress value="${pct}" max="100"></progress>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h5>Riwayat Setoran Tabungan</h5>
        <button class="btn-navy" style="font-size:0.8rem; padding: 0.3rem 0.75rem; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `openAddSavingModal('${g.id}')`}" ${isClosed ? 'disabled' : ''}>+ Tambah Setoran</button>
      </div>

      <div style="max-height: 250px; overflow-y: auto; margin-bottom: 1.5rem; border: 1px solid var(--budget-card-border); border-radius: 8px; padding: 0.5rem;">
        ${(!g.savings || g.savings.length === 0) ? `
          <p class="secondary" style="text-align:center; padding: 1rem 0; margin:0;">Belum ada setoran dicatat.</p>
        ` : `
          <figure style="margin:0;">
            <table style="width:100%; font-size:0.85rem; margin:0;">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nominal</th>
                  <th>Catatan</th>
                  <th style="text-align:right;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${g.savings.map(s => `
                  <tr>
                    <td>${s.date}</td>
                    <td><strong>${formatRupiah(s.amount)}</strong></td>
                    <td class="secondary">${s.note || '-'}</td>
                    <td style="text-align:right;">
                      <button class="outline" style="padding: 0.1rem 0.3rem; font-size:0.7rem; margin:0; border-color:#ef4444; color:#ef4444; width:auto; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `deleteSaving('${g.id}', '${s.id}')`}" ${isClosed ? 'disabled' : ''}>Hapus</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </figure>
        `}
      </div>

      <div class="modal-footer" style="display: flex; justify-content: space-between; gap: 0.75rem;">
        <button class="outline" style="padding: 0.4rem 1rem; font-size:0.85rem; margin:0; color:var(--pico-muted-color);" onclick="openEditGoalModal('${g.id}')">✏️ Edit Sasaran Goal</button>
        <button class="btn-gray" onclick="document.getElementById('modal-goal-detail').close(); this.closest('dialog').remove();">Tutup</button>
      </div>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.openAddSavingModal = async function(goalId) {
  const g = await getFromStore('goals', goalId);
  if (!g) return;

  // Helper to convert integer to Roman numerals
  const toRoman = (num) => {
    const romanMap = [
      { v: 1000, r: 'M' }, { v: 900, r: 'CM' }, { v: 500, r: 'D' }, { v: 400, r: 'CD' },
      { v: 100, r: 'C' }, { v: 90, r: 'XC' }, { v: 50, r: 'L' }, { v: 40, r: 'XL' },
      { v: 10, r: 'X' }, { v: 9, r: 'IX' }, { v: 5, r: 'V' }, { v: 4, r: 'IV' }, { v: 1, r: 'I' }
    ];
    let result = '';
    let val = num;
    for (const pair of romanMap) {
      while (val >= pair.v) {
        result += pair.r;
        val -= pair.v;
      }
    }
    return result || 'I';
  };

  const nextIndex = (g.savings || []).length + 1;
  const romanIndex = toRoman(nextIndex);
  const defaultNote = `${g.name} ke ${romanIndex}`;

  const overlay = document.createElement('dialog');
  overlay.id = 'modal-saving-add';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 440px; width: 95%;">
      <div class="modal-header">
        <h3>Tambah Setoran Tabungan</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-saving-add').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <form id="form-saving-add" onsubmit="saveSavingTransaction(event, '${goalId}')">
        <div style="margin-bottom: 1rem;">
          <label>Nominal Setoran (Rp)</label>
          <input type="number" id="saving-amount" min="1" required value="${g.monthly_contribution || 0}" placeholder="Contoh: 500000">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Tanggal</label>
          <input type="date" id="saving-date" required value="${new Date().toISOString().substring(0, 10)}">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Catatan / Keterangan</label>
          <input type="text" id="saving-note" required value="${defaultNote}" placeholder="Contoh: Tabungan bulanan">
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn-gray" onclick="document.getElementById('modal-saving-add').close(); this.closest('dialog').remove();">Batal</button>
          <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
        </div>
      </form>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.saveSavingTransaction = async function(e, goalId) {
  e.preventDefault();
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat menambah setoran goal karena periode aktif berjalan saat ini sedang ditutup.', 'warning');
    return;
  }
  const g = await getFromStore('goals', goalId);
  if (!g) return;

  if (!g.savings) g.savings = [];

  const amount = parseFloat(document.getElementById('saving-amount').value) || 0;
  const date = document.getElementById('saving-date').value;
  const note = document.getElementById('saving-note').value.trim();

  g.savings.push({
    id: `save_${Date.now()}`,
    amount,
    date,
    note
  });

  await putToStore('goals', g);

  // --- Sinkronisasi ke Anggaran Periode Berjalan ---
  const cats = await getAllByIndexFromStore('categories', 'by_budget', currentBudgetId);
  const catIds = cats.map(c => c.id);
  const allItems = await getAllFromStore('items');
  const activeItems = allItems.filter(i => catIds.includes(i.category_id));

  // 1. Cari item anggaran aktif yang namanya persis sama dengan nama Goal (case-insensitive)
  let matchedItem = activeItems.find(i => i.name.toLowerCase() === g.name.toLowerCase());
  let targetCat = null;

  if (matchedItem) {
    targetCat = cats.find(c => c.id === matchedItem.category_id);
  } else {
    // 2. Jika tidak ada, cari atau buat kategori CICILAN
    targetCat = cats.find(c => c.name.toUpperCase() === 'CICILAN');
    if (!targetCat) {
      const catId = `cat_${currentBudgetId}_cicilan_${Date.now()}`;
      targetCat = {
        id: catId,
        budget_id: currentBudgetId,
        name: 'CICILAN',
        icon: '💳',
        color: '#ef4444',
        target_pct: 10,
        category_type: 'expense',
        order: 90
      };
      await putToStore('categories', targetCat);
    }

    // Buat item baru di bawah kategori CICILAN
    const itemId = `item_${targetCat.id}_goal_${Date.now()}`;
    matchedItem = {
      id: itemId,
      category_id: targetCat.id,
      name: g.name,
      description: `Setoran otomatis dari Goal: ${g.name}`,
      planned_amount: g.monthly_contribution || 0,
      actual_amount: 0,
      is_fixed: false,
      due_date: null,
      order: 99
    };
    await putToStore('items', matchedItem);
  }

  const txType = targetCat ? targetCat.category_type : 'expense';

  const tx = {
    id: `tx_goal_${goalId}_${Date.now()}`,
    budget_id: currentBudgetId,
    budget_item_id: matchedItem.id,
    type: txType,
    amount: amount,
    description: `Setoran Goal: ${g.name} (${note || 'Menabung'})`,
    date: date,
    payment_method: 'Transfer Tabungan',
    tags: ['goal-savings']
  };
  await putToStore('transactions', tx);

  document.getElementById('modal-saving-add').close();
  document.getElementById('modal-saving-add').remove();
  
  const detailModal = document.getElementById('modal-goal-detail');
  if (detailModal) {
    detailModal.close();
    detailModal.remove();
  }

  if (window.TMPT_UI) window.TMPT_UI.toast(`Setoran goal berhasil disinkronkan ke item "${matchedItem.name}"!`, 'success');
  await renderTab();
  openGoalDetailModal(goalId);
};

window.deleteSaving = async function(goalId, savingId) {
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat menghapus setoran goal karena periode aktif berjalan saat ini sedang ditutup.', 'warning');
    return;
  }
  const confirmed = await showConfirmModal('Hapus transaksi setoran ini?');
  if (!confirmed) return;

  const g = await getFromStore('goals', goalId);
  if (!g) return;

  g.savings = (g.savings || []).filter(s => s.id !== savingId);
  await putToStore('goals', g);

  const detailModal = document.getElementById('modal-goal-detail');
  if (detailModal) {
    detailModal.close();
    detailModal.remove();
  }

  if (window.TMPT_UI) window.TMPT_UI.toast('Setoran berhasil dihapus', 'info');
  await renderTab();
  openGoalDetailModal(goalId);
};

window.openEditGoalModal = async function(goalId) {
  const g = await getFromStore('goals', goalId);
  if (!g) return;

  const overlay = document.createElement('dialog');
  overlay.id = 'modal-goal-edit';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 460px; width: 95%;">
      <div class="modal-header">
        <h3>Edit Sasaran Goal</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-goal-edit').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <form id="form-goal-edit" onsubmit="saveGoalEdit(event, '${g.id}')">
        <div style="margin-bottom: 1rem;">
          <label>Nama Goal</label>
          <input type="text" id="goal-edit-name" required value="${g.name}">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Target Nominal (Rp)</label>
          <input type="number" id="goal-edit-target" required value="${g.target_amount}">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Kontribusi Bulanan (Rp)</label>
          <input type="number" id="goal-edit-contrib" required value="${g.monthly_contribution}">
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn-gray" onclick="document.getElementById('modal-goal-edit').close(); this.closest('dialog').remove();">Batal</button>
          <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
        </div>
      </form>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.saveGoalEdit = async function(e, goalId) {
  e.preventDefault();
  const g = await getFromStore('goals', goalId);
  if (!g) return;

  g.name = document.getElementById('goal-edit-name').value.trim();
  g.target_amount = parseFloat(document.getElementById('goal-edit-target').value) || 0;
  g.monthly_contribution = parseFloat(document.getElementById('goal-edit-contrib').value) || 0;

  await putToStore('goals', g);
  document.getElementById('modal-goal-edit').close();
  document.getElementById('modal-goal-edit').remove();

  const detailModal = document.getElementById('modal-goal-detail');
  if (detailModal) {
    detailModal.close();
    detailModal.remove();
  }

  if (window.TMPT_UI) window.TMPT_UI.toast('Sasaran Goal berhasil diperbarui!', 'success');
  await renderTab();
  openGoalDetailModal(goalId);
};

// ============================================================
// MANAJEMEN HUTANG / DEBTS TAB
// ============================================================

async function renderDebts(container) {
  const debts = await getAllFromStore('debts');
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
      <h3>Manajemen &amp; Kalkulator Hutang</h3>
      <button class="btn-navy" onclick="openAddDebtModal()">+ Tambah Hutang</button>
    </div>
    <div id="debts-list-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.5rem;">
      Memuat data hutang...
    </div>
  `;

  const listContainer = document.getElementById('debts-list-container');
  if (debts.length === 0) {
    listContainer.innerHTML = `<p class="secondary" style="grid-column: 1/-1;">Belum ada catatan hutang / cicilan aktif.</p>`;
    return;
  }

  listContainer.innerHTML = debts.map(d => {
    const totalPayments = (d.payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalDebtAmount = parseFloat(d.principal) + parseFloat(d.interest_amount || 0);
    const pct = totalDebtAmount > 0 ? Math.min(100, (totalPayments / totalDebtAmount) * 100) : 0;
    const remaining = Math.max(0, totalDebtAmount - totalPayments);
    const monthlyInstallment = parseFloat(d.monthly_installment) || 0;

    return `
      <div class="budget-category-box" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between; border-left: 4px solid #ef4444;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
            <strong style="font-size: 1.05rem;">💳 ${d.name}</strong>
            <span class="badge-expense" style="font-size: 0.7rem; text-transform: uppercase;">Tenor: ${d.tenor_months} bln</span>
          </div>
          <p class="secondary" style="font-size:0.8rem; margin-bottom:0.75rem;">Keperluan: <strong>${d.purpose || '-'}</strong></p>
          <div style="display:flex; justify-content:space-between; font-size: 0.88rem; margin-bottom: 0.25rem;">
            <span class="secondary">Pokok &amp; Bunga:</span>
            <strong>${formatRupiah(d.principal)} (+ ${formatRupiah(d.interest_amount)})</strong>
          </div>
          <div style="display:flex; justify-content:space-between; font-size: 0.88rem; margin-bottom: 0.5rem;">
            <span class="secondary">Sisa Hutang:</span>
            <strong style="color:#ef4444;">${formatRupiah(remaining)} / ${formatRupiah(totalDebtAmount)}</strong>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
            <progress value="${pct}" max="100" style="margin: 0; height: 8px; --pico-progress-color: #ef4444;"></progress>
            <span style="font-size: 0.8rem; font-weight: bold; min-width: 35px; text-align: right;">${pct.toFixed(0)}%</span>
          </div>
          <div style="font-size:0.82rem; margin-bottom: 1rem;">
            Cicilan Bulanan: <strong style="color:#ef4444;">${formatRupiah(monthlyInstallment)}/bulan</strong>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; margin-top: auto;">
          <button class="outline" style="flex: 1; padding: 0.3rem 0.5rem; font-size: 0.8rem; margin: 0;" onclick="openDebtDetailModal('${d.id}')">📂 Bayar &amp; Detail</button>
          <button class="outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; color: #ef4444; border-color: #ef4444; margin: 0;" onclick="deleteDebt('${d.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

window.openAddDebtModal = function() {
  const overlay = document.createElement('dialog');
  overlay.id = 'modal-debt-add';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 520px; width: 95%;">
      <div class="modal-header">
        <h3>Catat Hutang / Cicilan Baru</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-debt-add').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <form id="form-debt-add" onsubmit="saveDebt(event)">
        <div style="margin-bottom: 1rem;">
          <label>Nama Kreditur / Cicilan</label>
          <input type="text" id="debt-name" required placeholder="Contoh: Cicilan Motor Honda, KPR">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Keperluan / Kebutuhan</label>
          <input type="text" id="debt-purpose" required placeholder="Contoh: Transportasi Harian, Tempat Tinggal">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Metode Perhitungan Bunga</label>
          <select id="debt-interest-type" onchange="toggleInterestInput(this.value)">
            <option value="manual">Nominal Rupiah (Manual)</option>
            <option value="flat">Suku Bunga Flat (% per Tahun)</option>
            <option value="annuity">Suku Bunga Anuitas (% per Tahun)</option>
          </select>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <label>Jumlah Pokok (Rp)</label>
            <input type="number" id="debt-principal" min="0" required placeholder="Contoh: 15000000" oninput="calculateDebtInstallment()">
          </div>
          <div id="container-interest-manual">
            <label>Total Bunga (Rp)</label>
            <input type="number" id="debt-interest" min="0" required value="0" placeholder="Contoh: 1500000" oninput="calculateDebtInstallment()">
          </div>
          <div id="container-interest-rate" style="display:none;">
            <label>Persentase Bunga (% per Tahun)</label>
            <input type="number" id="debt-interest-rate" min="0" step="0.01" value="0" placeholder="Contoh: 6.5" oninput="calculateDebtInstallment()">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <label>Tenor Waktu (Bulan)</label>
            <input type="number" id="debt-tenor" min="1" required value="12" placeholder="Contoh: 12" oninput="calculateDebtInstallment()">
          </div>
          <div>
            <label>Cicilan Bulanan (Rp)</label>
            <input type="number" id="debt-installment" min="0" readonly style="background:var(--pico-form-element-disabled-background-color);">
          </div>
        </div>
        <div style="margin-bottom: 1rem; display:none;" id="container-interest-result">
          <label>Estimasi Total Bunga dihitung (Rp)</label>
          <input type="text" id="debt-interest-result-val" readonly style="background:var(--pico-form-element-disabled-background-color);">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Tanggal Mulai Cicilan</label>
          <input type="date" id="debt-start-date" required value="${new Date().toISOString().substring(0, 10)}">
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn-gray" onclick="document.getElementById('modal-debt-add').close(); this.closest('dialog').remove();">Batal</button>
          <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
        </div>
      </form>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
  calculateDebtInstallment();
};

window.toggleInterestInput = function(type) {
  const manualEl = document.getElementById('container-interest-manual');
  const rateEl = document.getElementById('container-interest-rate');
  const resultEl = document.getElementById('container-interest-result');

  if (type === 'manual') {
    manualEl.style.display = 'block';
    rateEl.style.display = 'none';
    resultEl.style.display = 'none';
  } else {
    manualEl.style.display = 'none';
    rateEl.style.display = 'block';
    resultEl.style.display = 'block';
  }
  calculateDebtInstallment();
};

window.calculateDebtInstallment = function() {
  const principal = parseFloat(document.getElementById('debt-principal').value) || 0;
  const tenor = parseFloat(document.getElementById('debt-tenor').value) || 1;
  const type = document.getElementById('debt-interest-type').value;

  let interest = 0;
  let installment = 0;

  if (type === 'manual') {
    interest = parseFloat(document.getElementById('debt-interest').value) || 0;
    installment = Math.ceil((principal + interest) / tenor);
  } else if (type === 'flat') {
    const rate = parseFloat(document.getElementById('debt-interest-rate').value) || 0;
    // Bunga flat = pokok * persen bunga per tahun * (tenor bulan / 12)
    interest = Math.round((principal * (rate / 100)) * (tenor / 12));
    installment = Math.ceil((principal + interest) / tenor);
    const resEl = document.getElementById('debt-interest-result-val');
    if (resEl) resEl.value = formatRupiah(interest);
  } else if (type === 'annuity') {
    const rate = parseFloat(document.getElementById('debt-interest-rate').value) || 0;
    const r = (rate / 100) / 12; // Bunga bulanan
    if (r > 0) {
      installment = Math.ceil(principal * (r * Math.pow(1 + r, tenor)) / (Math.pow(1 + r, tenor) - 1));
      interest = Math.max(0, (installment * tenor) - principal);
    } else {
      installment = Math.ceil(principal / tenor);
      interest = 0;
    }
    const resEl = document.getElementById('debt-interest-result-val');
    if (resEl) resEl.value = formatRupiah(interest);
  }

  const instEl = document.getElementById('debt-installment');
  if (instEl) instEl.value = installment;
};

window.saveDebt = async function(e) {
  e.preventDefault();
  const principal = parseFloat(document.getElementById('debt-principal').value) || 0;
  const tenor = parseFloat(document.getElementById('debt-tenor').value) || 12;
  const type = document.getElementById('debt-interest-type').value;

  let interest = 0;
  let installment = 0;

  if (type === 'manual') {
    interest = parseFloat(document.getElementById('debt-interest').value) || 0;
    installment = Math.ceil((principal + interest) / tenor);
  } else if (type === 'flat') {
    const rate = parseFloat(document.getElementById('debt-interest-rate').value) || 0;
    interest = Math.round((principal * (rate / 100)) * (tenor / 12));
    installment = Math.ceil((principal + interest) / tenor);
  } else if (type === 'annuity') {
    const rate = parseFloat(document.getElementById('debt-interest-rate').value) || 0;
    const r = (rate / 100) / 12;
    if (r > 0) {
      installment = Math.ceil(principal * (r * Math.pow(1 + r, tenor)) / (Math.pow(1 + r, tenor) - 1));
      interest = Math.max(0, (installment * tenor) - principal);
    } else {
      installment = Math.ceil(principal / tenor);
      interest = 0;
    }
  }

  const debt = {
    id: `debt_${Date.now()}`,
    name: document.getElementById('debt-name').value.trim(),
    purpose: document.getElementById('debt-purpose').value.trim(),
    interest_type: type,
    interest_rate: type !== 'manual' ? parseFloat(document.getElementById('debt-interest-rate').value) || 0 : 0,
    principal,
    interest_amount: interest,
    tenor_months: tenor,
    monthly_installment: installment,
    start_date: document.getElementById('debt-start-date').value,
    payments: [],
    created_at: new Date().toISOString()
  };

  await putToStore('debts', debt);
  document.getElementById('modal-debt-add').close();
  document.getElementById('modal-debt-add').remove();
  if (window.TMPT_UI) window.TMPT_UI.toast('Catatan Hutang baru berhasil disimpan', 'success');
  await renderTab();
};

window.deleteDebt = async function(debtId) {
  const confirmed = await showConfirmModal('Hapus catatan hutang ini beserta seluruh riwayat pembayaran cicilannya?');
  if (!confirmed) return;
  await deleteFromStore('debts', debtId);
  if (window.TMPT_UI) window.TMPT_UI.toast('Catatan Hutang berhasil dihapus', 'info');
  await renderTab();
};

window.openDebtDetailModal = async function(debtId) {
  const d = await getFromStore('debts', debtId);
  if (!d) return;

  const totalPayments = (d.payments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  const totalDebtAmount = parseFloat(d.principal) + parseFloat(d.interest_amount || 0);
  const pct = totalDebtAmount > 0 ? Math.min(100, (totalPayments / totalDebtAmount) * 100) : 0;
  const remaining = Math.max(0, totalDebtAmount - totalPayments);

  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  const isClosed = budgetRecord && budgetRecord.status === 'closed';

  const overlay = document.createElement('dialog');
  overlay.id = 'modal-debt-detail';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 600px; width: 95%;">
      <div class="modal-header">
        <h3>Detail Hutang: ${d.name}</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-debt-detail').close(); this.closest('dialog').remove();">✕</button>
      </div>
      
      <div style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--budget-card-border); padding-bottom: 1rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom: 0.5rem;">
          <span class="secondary">Progres Pelunasan (${pct.toFixed(0)}%):</span>
          <strong>${formatRupiah(totalPayments)} / ${formatRupiah(totalDebtAmount)}</strong>
        </div>
        <progress value="${pct}" max="100" style="--pico-progress-color:#ef4444;"></progress>
        <div style="display:flex; justify-content:space-between; margin-top:0.5rem; font-size:0.85rem;">
          <span class="secondary">Sisa Kewajiban: <strong style="color:#ef4444;">${formatRupiah(remaining)}</strong></span>
          <span class="secondary">Rencana Cicilan: <strong>${formatRupiah(d.monthly_installment)}/bln</strong></span>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
        <h5>Riwayat Pembayaran Cicilan</h5>
        <button class="btn-navy" style="font-size:0.8rem; padding: 0.3rem 0.75rem; background:#ef4444; border-color:#ef4444; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `openAddPaymentModal('${d.id}')`}" ${isClosed ? 'disabled' : ''}>+ Bayar Cicilan</button>
      </div>

      <div style="max-height: 250px; overflow-y: auto; margin-bottom: 1.5rem; border: 1px solid var(--budget-card-border); border-radius: 8px; padding: 0.5rem;">
        ${(!d.payments || d.payments.length === 0) ? `
          <p class="secondary" style="text-align:center; padding: 1rem 0; margin:0;">Belum ada pembayaran dicatat.</p>
        ` : `
          <figure style="margin:0;">
            <table style="width:100%; font-size:0.85rem; margin:0;">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nominal</th>
                  <th>Keterangan</th>
                  <th style="text-align:right;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                ${d.payments.map(p => `
                  <tr>
                    <td>${p.date}</td>
                    <td><strong>${formatRupiah(p.amount)}</strong></td>
                    <td class="secondary">${p.note || '-'}</td>
                    <td style="text-align:right;">
                      <button class="outline" style="padding: 0.1rem 0.3rem; font-size:0.7rem; margin:0; border-color:#ef4444; color:#ef4444; width:auto; ${isClosed ? 'opacity:0.5; cursor:default;' : ''}" onclick="${isClosed ? '' : `deleteDebtPayment('${d.id}', '${p.id}')`}" ${isClosed ? 'disabled' : ''}>Hapus</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </figure>
        `}
      </div>

      <div class="modal-footer" style="display: flex; justify-content: space-between; gap: 0.75rem;">
        <button class="outline" style="padding: 0.4rem 1rem; font-size:0.85rem; margin:0; color:var(--pico-muted-color);" onclick="openEditDebtModal('${d.id}')">✏️ Edit Sasaran Hutang</button>
        <button class="btn-gray" onclick="document.getElementById('modal-debt-detail').close(); this.closest('dialog').remove();">Tutup</button>
      </div>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.openAddPaymentModal = async function(debtId) {
  const d = await getFromStore('debts', debtId);
  if (!d) return;

  const toRoman = (num) => {
    const romanMap = [
      { v: 1000, r: 'M' }, { v: 900, r: 'CM' }, { v: 500, r: 'D' }, { v: 400, r: 'CD' },
      { v: 100, r: 'C' }, { v: 90, r: 'XC' }, { v: 50, r: 'L' }, { v: 40, r: 'XL' },
      { v: 10, r: 'X' }, { v: 9, r: 'IX' }, { v: 5, r: 'V' }, { v: 4, r: 'IV' }, { v: 1, r: 'I' }
    ];
    let result = '';
    let val = num;
    for (const pair of romanMap) {
      while (val >= pair.v) {
        result += pair.r;
        val -= pair.v;
      }
    }
    return result || 'I';
  };

  const nextIndex = (d.payments || []).length + 1;
  const romanIndex = toRoman(nextIndex);
  const defaultNote = `${d.name} ke ${romanIndex}`;

  const overlay = document.createElement('dialog');
  overlay.id = 'modal-payment-add';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 440px; width: 95%;">
      <div class="modal-header">
        <h3>Bayar Cicilan Hutang</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-payment-add').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <form id="form-payment-add" onsubmit="saveDebtPaymentTransaction(event, '${debtId}')">
        <div style="margin-bottom: 1rem;">
          <label>Nominal Pembayaran (Rp)</label>
          <input type="number" id="payment-amount" min="1" required value="${d.monthly_installment || 0}" placeholder="Contoh: 1000000">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Tanggal</label>
          <input type="date" id="payment-date" required value="${new Date().toISOString().substring(0, 10)}">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Catatan / Keterangan</label>
          <input type="text" id="payment-note" required value="${defaultNote}" placeholder="Contoh: Cicilan ke-3">
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn-gray" onclick="document.getElementById('modal-payment-add').close(); this.closest('dialog').remove();">Batal</button>
          <button type="submit" class="btn-navy" style="margin: 0; background:#ef4444; border-color:#ef4444;">Simpan</button>
        </div>
      </form>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.saveDebtPaymentTransaction = async function(e, debtId) {
  e.preventDefault();
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat membayar cicilan karena periode aktif berjalan saat ini sedang ditutup.', 'warning');
    return;
  }
  const d = await getFromStore('debts', debtId);
  if (!d) return;

  if (!d.payments) d.payments = [];

  const amount = parseFloat(document.getElementById('payment-amount').value) || 0;
  const date = document.getElementById('payment-date').value;
  const note = document.getElementById('payment-note').value.trim();

  d.payments.push({
    id: `pay_${Date.now()}`,
    amount,
    date,
    note
  });

  await putToStore('debts', d);

  // --- Sinkronisasi ke Anggaran Periode Berjalan (Kategori CICILAN / LAIN-LAIN) ---
  const cats = await getAllByIndexFromStore('categories', 'by_budget', currentBudgetId);
  // Cari kategori CICILAN atau LAIN-LAIN jika tidak ada
  let targetCat = cats.find(c => (c.name === 'CICILAN' || c.name === 'LAIN-LAIN') && c.category_type === 'expense');
  if (!targetCat) {
    const catId = `cat_${currentBudgetId}_debt_${Date.now()}`;
    targetCat = {
      id: catId,
      budget_id: currentBudgetId,
      name: 'CICILAN',
      icon: '💳',
      color: '#ef4444',
      target_pct: 10,
      category_type: 'expense',
      order: 90
    };
    await putToStore('categories', targetCat);
  }

  const allItems = await getAllFromStore('items');
  const itemName = `Cicilan: ${d.name}`;
  let matchedItem = allItems.find(item => item.category_id === targetCat.id && item.name === itemName);
  if (!matchedItem) {
    const itemId = `item_${targetCat.id}_debt_${Date.now()}`;
    matchedItem = {
      id: itemId,
      category_id: targetCat.id,
      name: itemName,
      description: `Cicilan otomatis dari Hutang: ${d.name}`,
      planned_amount: d.monthly_installment || 0,
      actual_amount: 0,
      is_fixed: true,
      due_date: null,
      order: 90
    };
    await putToStore('items', matchedItem);
  }

  const tx = {
    id: `tx_debt_${debtId}_${Date.now()}`,
    budget_id: currentBudgetId,
    budget_item_id: matchedItem.id,
    type: 'expense',
    amount: amount,
    description: `Pembayaran Cicilan: ${d.name} (${note})`,
    date: date,
    payment_method: 'Transfer Bank',
    tags: ['debt-payment']
  };
  await putToStore('transactions', tx);

  document.getElementById('modal-payment-add').close();
  document.getElementById('modal-payment-add').remove();
  
  const detailModal = document.getElementById('modal-debt-detail');
  if (detailModal) {
    detailModal.close();
    detailModal.remove();
  }

  if (window.TMPT_UI) window.TMPT_UI.toast('Pembayaran cicilan berhasil dicatat dan disinkronkan ke Anggaran!', 'success');
  await renderTab();
  openDebtDetailModal(debtId);
};

window.deleteDebtPayment = async function(debtId, paymentId) {
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat menghapus pembayaran cicilan karena periode aktif berjalan saat ini sedang ditutup.', 'warning');
    return;
  }
  const confirmed = await showConfirmModal('Hapus transaksi pembayaran cicilan ini?');
  if (!confirmed) return;

  const d = await getFromStore('debts', debtId);
  if (!d) return;

  d.payments = (d.payments || []).filter(p => p.id !== paymentId);
  await putToStore('debts', d);

  const detailModal = document.getElementById('modal-debt-detail');
  if (detailModal) {
    detailModal.close();
    detailModal.remove();
  }

  if (window.TMPT_UI) window.TMPT_UI.toast('Pembayaran cicilan berhasil dihapus', 'info');
  await renderTab();
  openDebtDetailModal(debtId);
};

window.openEditDebtModal = async function(debtId) {
  const d = await getFromStore('debts', debtId);
  if (!d) return;

  const overlay = document.createElement('dialog');
  overlay.id = 'modal-debt-edit';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 480px; width: 95%;">
      <div class="modal-header">
        <h3>Edit Sasaran Hutang</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-debt-edit').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <form id="form-debt-edit" onsubmit="saveDebtEdit(event, '${d.id}')">
        <div style="margin-bottom: 1rem;">
          <label>Nama Kreditur / Cicilan</label>
          <input type="text" id="debt-edit-name" required value="${d.name}">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Keperluan</label>
          <input type="text" id="debt-edit-purpose" required value="${d.purpose}">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Jumlah Pokok (Rp)</label>
          <input type="number" id="debt-edit-principal" required value="${d.principal}">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Total Bunga (Rp)</label>
          <input type="number" id="debt-edit-interest" required value="${d.interest_amount || 0}">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Tenor (Bulan)</label>
          <input type="number" id="debt-edit-tenor" required value="${d.tenor_months}">
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn-gray" onclick="document.getElementById('modal-debt-edit').close(); this.closest('dialog').remove();">Batal</button>
          <button type="submit" class="btn-navy" style="margin: 0;">Simpan</button>
        </div>
      </form>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.saveDebtEdit = async function(e, debtId) {
  e.preventDefault();
  const d = await getFromStore('debts', debtId);
  if (!d) return;

  d.name = document.getElementById('debt-edit-name').value.trim();
  d.purpose = document.getElementById('debt-edit-purpose').value.trim();
  d.principal = parseFloat(document.getElementById('debt-edit-principal').value) || 0;
  d.interest_amount = parseFloat(document.getElementById('debt-edit-interest').value) || 0;
  d.tenor_months = parseInt(document.getElementById('debt-edit-tenor').value) || 12;
  d.monthly_installment = Math.ceil((d.principal + d.interest_amount) / d.tenor_months);

  await putToStore('debts', d);
  document.getElementById('modal-debt-edit').close();
  document.getElementById('modal-debt-edit').remove();

  const detailModal = document.getElementById('modal-debt-detail');
  if (detailModal) {
    detailModal.close();
    detailModal.remove();
  }

  if (window.TMPT_UI) window.TMPT_UI.toast('Sasaran Hutang berhasil diperbarui!', 'success');
  await renderTab();
  openDebtDetailModal(debtId);
};

async function renderAdvisor(container, summary) {
  const categories = await getAllByIndexFromStore('categories', 'by_budget', currentBudgetId);
  const allItems = await getAllFromStore('items');

  let cicilanActual = 0;
  let needsActual = 0;

  for (const cat of categories) {
    const catItems = allItems.filter(item => item.category_id === cat.id);
    const catActual = catItems.reduce((sum, item) => sum + parseFloat(item.actual_amount || 0), 0);
    const catNameLower = cat.name.toLowerCase();
    
    if (catNameLower.includes('cicilan') || catNameLower.includes('hutang') || catNameLower.includes('kredit')) {
      cicilanActual += catActual;
    }
    if (catNameLower.includes('kebutuhan') || catNameLower.includes('rutin') || catNameLower.includes('tagihan')) {
      needsActual += catActual;
    }
  }

  const advice = analyzeFinances(summary, cicilanActual, needsActual, summary.actualSavings);
  
  container.innerHTML = `
    <h3>Saran Keuangan Cerdas</h3>
    <div style="display:flex; flex-direction:column; gap:1rem; margin-top:1rem;">
      ${advice.map(a => {
        let borderClr = 'var(--budget-primary)';
        if (a.type === 'warning') borderClr = '#ef4444';
        if (a.type === 'tip') borderClr = '#f59e0b';
        if (a.type === 'edu') borderClr = '#8b5cf6';
        
        return `
          <div class="budget-category-box" style="border-left: 4px solid ${borderClr};">
            <h5>${a.icon} ${a.title}</h5>
            <p class="secondary" style="font-size:0.9rem; line-height:1.5; margin-bottom:0.75rem;">${a.message}</p>
            <strong style="font-size:0.85rem; display:block; margin-bottom:0.25rem;">Rekomendasi Aksi:</strong>
            <ul style="margin-bottom:0; font-size:0.85rem;">
              ${a.actions.map(act => `<li>${act}</li>`).join('')}
            </ul>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function renderImport(container) {
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  const isClosed = budgetRecord && budgetRecord.status === 'closed';

  container.innerHTML = `
    <h3>Impor Transaksi CSV</h3>
    <p class="secondary">Unggah file CSV Anda (GoPay, BCA, atau Generic) secara 100% lokal. Sistem akan mendeteksi format secara otomatis.</p>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
      <div class="budget-category-box" style="margin-bottom: 0;">
        <h5 style="margin-bottom: 1rem;">📤 Unggah CSV Transaksi</h5>
        <div style="margin-bottom:1.5rem;">
          <input type="file" id="import-file-picker" accept=".csv" ${isClosed ? 'disabled' : ''}>
        </div>
        <button class="btn-navy" style="width: 100%;" onclick="${isClosed ? '' : 'processCSVImport()'}" ${isClosed ? 'disabled style="opacity:0.5; cursor:default;"' : ''}>Proses Impor CSV</button>
      </div>

      <div class="budget-category-box" style="margin-bottom: 0;">
        <h5 style="margin-bottom: 1rem;">📥 Unduh Template Contoh CSV</h5>
        <p class="secondary" style="font-size: 0.85rem; line-height: 1.5; margin-bottom: 1rem;">
          Gunakan template di bawah ini untuk merapikan file e-statement Anda sebelum diimpor agar terbaca sempurna:
        </p>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button class="outline" style="padding: 0.4rem; font-size: 0.8rem; margin: 0; text-align: left;" onclick="downloadCSVTemplate('gopay')">📄 Unduh Contoh GoPay CSV</button>
          <button class="outline" style="padding: 0.4rem; font-size: 0.8rem; margin: 0; text-align: left;" onclick="downloadCSVTemplate('bca')">📄 Unduh Contoh BCA CSV</button>
          <button class="outline" style="padding: 0.4rem; font-size: 0.8rem; margin: 0; text-align: left;" onclick="downloadCSVTemplate('generic')">📄 Unduh Contoh Generic CSV</button>
        </div>
      </div>
    </div>

    <div class="budget-category-box" style="margin-top: 1.5rem; border-left: 4px solid var(--pico-primary);">
      <h5>💡 Mekanisme Impor Transaksi</h5>
      <p class="secondary" style="font-size: 0.88rem; line-height: 1.6; margin-bottom: 0;">
        Transaksi akan diimpor langsung ke periode aktif berjalan. Sistem akan otomatis mendeteksi tipe transaksi (Pemasukan atau Pengeluaran) dan format file (GoPay, BCA, atau Generic).
        <br>
        <strong>Mekanisme Deteksi:</strong>
        <br>
        - <strong>GoPay:</strong> Mendeteksi kolom "Tanggal Transaksi".
        <br>
        - <strong>BCA:</strong> Mendeteksi kolom "TANGGAL" &amp; "DEBET" / "KREDIT".
        <br>
        - <strong>Generic:</strong> Mendeteksi kolom "Tanggal", "Deskripsi", "Jumlah", dan "Tipe". Tipe data berupa "pendapatan"/"income" atau "pengeluaran"/"expense".
      </p>
    </div>
  `;
}

window.downloadCSVTemplate = function(type) {
  let headers = '';
  let sampleData = '';
  let filename = '';

  if (type === 'gopay') {
    headers = 'Tanggal Transaksi,Keterangan,Jumlah,Tipe';
    sampleData = '2026-06-14,Makan Siang Nasi Padang,35000,Pengeluaran\n2026-06-14,Transfer Masuk dari Rekan,500000,Pemasukan';
    filename = 'template_gopay.csv';
  } else if (type === 'bca') {
    headers = 'TANGGAL,KETERANGAN,DEBET,KREDIT';
    sampleData = '14/06,TRANSFER ANTAR REK,150000,0\n14/06,BUNGA TABUNGAN,0,2500';
    filename = 'template_bca.csv';
  } else {
    headers = 'Tanggal,Deskripsi,Jumlah,Tipe';
    sampleData = '2026-06-14,Pendapatan Gaji Bulanan,7500000,pendapatan\n2026-06-14,Belanja Bulanan Supermarket,1200000,pengeluaran';
    filename = 'template_generic.csv';
  }

  const csvContent = headers + '\n' + sampleData;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.processCSVImport = async function() {
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat mengimpor transaksi ke periode yang ditutup.', 'warning');
    return;
  }
  const fileInput = document.getElementById('import-file-picker');
  if (!fileInput.files.length) {
    if (window.TMPT_UI) window.TMPT_UI.toast('Silakan pilih file CSV terlebih dahulu.', 'warning');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    const text = e.target.result;
    const rows = parseCSVText(text);

    if (rows.length < 2) {
      if (window.TMPT_UI) window.TMPT_UI.toast('File CSV tidak memiliki data.', 'warning');
      return;
    }

    const headers = rows[0].map(h => h.trim());
    let bankType = 'generic';

    if (headers.includes('Tanggal Transaksi') || headers.some(h => h.toLowerCase().includes('tanggal transaksi'))) {
      bankType = 'gopay';
    } else if (headers.includes('DEBET') || headers.includes('KREDIT') || headers.includes('TANGGAL')) {
      bankType = 'bca';
    }

    const allItems = await getAllFromStore('items');
    const cats = await getAllByIndexFromStore('categories', 'by_budget', currentBudgetId);

    let sourceName = 'Generic';
    if (bankType === 'gopay') sourceName = 'Gopay';
    else if (bankType === 'bca') sourceName = 'BCA';

    let count = 0;
    
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length < 2 || !row[0]) continue;

      let date = new Date().toISOString().substring(0, 10);
      let desc = 'Imported Transaction';
      let amount = 0;
      let type = 'expense';

      if (bankType === 'gopay') {
        date = row[0] || date;
        desc = row[1] || desc;
        amount = parseFloat(row[2]) || 0;
        type = (row[3] || '').trim().toLowerCase() === 'pemasukan' ? 'income' : 'expense';
      } else if (bankType === 'bca') {
        date = row[0] || date;
        desc = row[1] || desc;
        const debet = parseFloat(row[2]) || 0;
        const kredit = parseFloat(row[3]) || 0;
        if (kredit > 0) {
          amount = kredit;
          type = 'income';
        } else {
          amount = debet;
          type = 'expense';
        }
      } else {
        date = row[0] || date;
        desc = row[1] || desc;
        amount = parseFloat(row[2]) || 0;
        const rawType = (row[3] || '').trim().toLowerCase();
        type = (rawType === 'income' || rawType === 'pendapatan' || rawType === 'pemasukan') ? 'income' : 'expense';
      }

      if (amount <= 0) continue;

      let matchedItemId = null;

      if (type === 'income') {
        // Pemetaan Pemasukan -> Kategori PEMASUKAN -> Item Gopay/BCA/Generic
        let incomeCat = cats.find(c => c.category_type === 'income');
        if (!incomeCat) {
          const catId = `cat_${currentBudgetId}_income_${Date.now()}`;
          incomeCat = {
            id: catId,
            budget_id: currentBudgetId,
            name: 'PEMASUKAN',
            icon: '💵',
            color: '#10b981',
            target_pct: 100,
            category_type: 'income',
            order: 0
          };
          await putToStore('categories', incomeCat);
          cats.push(incomeCat);
        }

        let item = allItems.find(i => i.category_id === incomeCat.id && i.name.toLowerCase() === sourceName.toLowerCase());
        if (!item) {
          const itemId = `item_${incomeCat.id}_import_${Date.now()}_${r}`;
          item = {
            id: itemId,
            category_id: incomeCat.id,
            name: sourceName,
            description: `Pemasukan otomatis via ${sourceName} Import`,
            planned_amount: 0,
            actual_amount: 0,
            is_fixed: false,
            due_date: null,
            order: 99
          };
          await putToStore('items', item);
          allItems.push(item);
        }
        matchedItemId = item.id;
      } else {
        // Pemetaan Pengeluaran -> Kategori LAIN-LAIN (alokasi 5%) -> Item Gopay/BCA/Generic
        let targetCat = cats.find(c => c.name === 'LAIN-LAIN' && c.category_type === 'expense');
        if (!targetCat) {
          const catId = `cat_${currentBudgetId}_lain_${Date.now()}`;
          targetCat = {
            id: catId,
            budget_id: currentBudgetId,
            name: 'LAIN-LAIN',
            icon: '📂',
            color: '#6b7280',
            target_pct: 5,
            category_type: 'expense',
            order: 99
          };
          await putToStore('categories', targetCat);
          cats.push(targetCat);
        }

        let item = allItems.find(i => i.category_id === targetCat.id && i.name.toLowerCase() === sourceName.toLowerCase());
        if (!item) {
          const itemId = `item_${targetCat.id}_import_${Date.now()}_${r}`;
          item = {
            id: itemId,
            category_id: targetCat.id,
            name: sourceName,
            description: `Pengeluaran otomatis via ${sourceName} Import`,
            planned_amount: 0,
            actual_amount: 0,
            is_fixed: false,
            due_date: null,
            order: 99
          };
          await putToStore('items', item);
          allItems.push(item);
        }
        matchedItemId = item.id;
      }

      const tx = {
        id: `tx_imported_${Date.now()}_${r}`,
        budget_id: currentBudgetId,
        budget_item_id: matchedItemId,
        type: type,
        amount: amount,
        description: desc,
        date: date,
        payment_method: 'CSV Import',
        tags: ['imported']
      };
      await putToStore('transactions', tx);
      count++;
    }

    // Rekalkulasi planned_amount = actual_amount untuk semua item yang terpengaruh impor
    // Ambil data transaksi terbaru dan hitung ulang rencana = aktual
    const updatedTxs = await getAllFromStore('transactions');
    const updatedItems = await getAllFromStore('items');
    for (let item of updatedItems) {
      if (item.name.toLowerCase() === 'gopay' || item.name.toLowerCase() === 'bca' || item.name.toLowerCase() === 'generic') {
        const itemTx = updatedTxs.filter(t => t.budget_item_id === item.id && t.budget_id === currentBudgetId);
        const sumActual = itemTx.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        item.actual_amount = sumActual;
        item.planned_amount = sumActual; // Rencana disamakan dengan Aktual
        await putToStore('items', item);
      }
    }

    if (window.TMPT_UI) window.TMPT_UI.toast(`${count} transaksi (${bankType.toUpperCase()}) berhasil diimpor!`, 'success');
    switchTab('transactions');
  };
  reader.readAsText(file);
};
// ============================================================
// TEMPLATE PICKER
// ============================================================
window.openTemplatePicker = async function() {
  const customTemplates = await getAllFromStore('templates');

  const defaultTemplatesHtml = DEFAULT_TEMPLATES.map(t => `
    <div style="padding: 1rem; border: 1px solid var(--budget-card-border); border-radius: 12px; background: rgba(59, 130, 246, 0.05); display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
      <div>
        <strong style="font-size: 1.05rem; color: var(--pico-primary);">${t.name}</strong>
        <div class="secondary" style="font-size: 0.82rem; margin-top: 0.25rem;">
          ${t.description}
        </div>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button class="btn-navy" style="margin: 0; padding: 0.35rem 0.75rem; font-size: 0.8rem;" onclick="selectAndApplyTemplate('${t.id}')">Pilih 🎯</button>
        <button class="outline" style="margin: 0; padding: 0.35rem 0.6rem; font-size: 0.8rem;" onclick="exportTemplate('${t.id}')" title="Unduh & Bagikan">Unduh 📤</button>
      </div>
    </div>
  `).join('');

  const customTemplatesHtml = customTemplates.length === 0 
    ? `<p class="secondary" style="font-size:0.85rem; text-align:center; padding: 1rem 0;">Belum ada template kustom yang disimpan.</p>`
    : customTemplates.map(t => `
    <div style="padding: 1rem; border: 1px solid var(--budget-card-border); border-radius: 12px; background: rgba(16, 185, 129, 0.05); display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
      <div>
        <strong style="font-size: 1.05rem; color: #10b981;">${t.name}</strong>
        <div class="secondary" style="font-size: 0.82rem; margin-top: 0.25rem;">
          ${t.description}
        </div>
      </div>
      <div style="display:flex; gap:0.4rem; align-items:center;">
        <button class="btn-navy" style="margin: 0; padding: 0.35rem 0.75rem; font-size: 0.8rem; background: #10b981; border-color: #10b981;" onclick="selectAndApplyTemplate('${t.id}')">Pilih 🎯</button>
        <button class="outline" style="margin: 0; padding: 0.35rem 0.6rem; font-size: 0.8rem; color: #10b981; border-color: #10b981;" onclick="exportTemplate('${t.id}')" title="Unduh & Bagikan">Unduh 📤</button>
        <button class="outline" style="margin: 0; padding: 0.35rem 0.6rem; font-size: 0.8rem; color: #ef4444; border-color: #ef4444;" onclick="deleteCustomTemplate('${t.id}')" title="Hapus">🗑️</button>
      </div>
    </div>
  `).join('');

  const overlay = document.createElement('dialog');
  overlay.id = 'modal-template-picker';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 650px; width: 95%;">
      <div class="modal-header">
        <h3>Pilih &amp; Kelola Template Anggaran</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-template-picker').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <div style="margin-bottom: 1.5rem; max-height: 400px; overflow-y: auto; padding-right: 0.5rem;">
        <p class="secondary" style="font-size:0.85rem; margin-bottom: 1.5rem;">Pilih struktur anggaran bulanan. Tindakan ini akan menyetel ulang kategori dan item periode berjalan.</p>
        
        <h6 style="margin-top: 0; margin-bottom: 0.75rem; font-weight:700; font-size:0.9rem;">Template Bawaan:</h6>
        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
          ${defaultTemplatesHtml}
        </div>

        <h6 style="margin-top: 1rem; margin-bottom: 0.75rem; font-weight:700; font-size:0.9rem;">Template Kustom Anda:</h6>
        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
          ${customTemplatesHtml}
        </div>

        <div style="margin-top: 1.25rem; border-top: 1px solid var(--budget-card-border); padding-top: 1rem;">
          <label style="font-size: 0.85rem; font-weight: bold; margin-bottom: 0.5rem; display:block;">📥 Impor / Unggah File Template (.json)</label>
          <input type="file" id="upload-template-file" accept=".json" style="font-size: 0.85rem;" onchange="importTemplateJSON(event)">
        </div>
      </div>
      <div class="modal-footer" style="display: flex; justify-content: flex-end;">
        <button class="btn-gray" onclick="document.getElementById('modal-template-picker').close(); this.closest('dialog').remove();">Batal</button>
      </div>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.exportTemplate = async function(templateId) {
  let template = DEFAULT_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    template = await getFromStore('templates', templateId);
  }
  if (!template) return;
  
  const json = JSON.stringify(template, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${template.name.toLowerCase().replace(/\s+/g, '_')}_template.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

window.importTemplateJSON = async function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (evt) => {
    try {
      const template = JSON.parse(evt.target.result);
      if (!template.name || !template.categories) {
        throw new Error('Format template tidak valid');
      }
      template.id = `tmpl_custom_${Date.now()}`;
      await putToStore('templates', template);
      if (window.TMPT_UI) window.TMPT_UI.toast(`Template "${template.name}" berhasil diimpor!`, 'success');
      
      document.getElementById('modal-template-picker').close();
      document.getElementById('modal-template-picker').remove();
      openTemplatePicker();
    } catch (err) {
      if (window.TMPT_UI) window.TMPT_UI.toast('Gagal mengimpor template. Format file tidak sesuai.', 'error');
    }
  };
  reader.readAsText(file);
};

window.deleteCustomTemplate = async function(templateId) {
  const confirmed = await showConfirmModal('Hapus template kustom ini?');
  if (!confirmed) return;
  await deleteFromStore('templates', templateId);
  if (window.TMPT_UI) window.TMPT_UI.toast('Template kustom berhasil dihapus', 'info');
  
  document.getElementById('modal-template-picker').close();
  document.getElementById('modal-template-picker').remove();
  openTemplatePicker();
};

window.openSaveTemplateModal = function() {
  const overlay = document.createElement('dialog');
  overlay.id = 'modal-save-custom-template';
  overlay.innerHTML = `
    <article class="modal-premium" style="max-width: 480px; width: 95%;">
      <div class="modal-header">
        <h3>Simpan Anggaran Sebagai Template</h3>
        <button type="button" class="btn-close" onclick="document.getElementById('modal-save-custom-template').close(); this.closest('dialog').remove();">✕</button>
      </div>
      <form id="form-save-template" onsubmit="saveActiveAsTemplate(event)">
        <div style="margin-bottom: 1rem;">
          <label>Nama Template Kustom</label>
          <input type="text" id="custom-template-name" required placeholder="Contoh: Anggaran Pribadi Minimalis">
        </div>
        <div style="margin-bottom: 1rem;">
          <label>Deskripsi Singkat</label>
          <input type="text" id="custom-template-desc" placeholder="Contoh: Struktur bulanan dengan alokasi ketat">
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" class="btn-gray" onclick="document.getElementById('modal-save-custom-template').close(); this.closest('dialog').remove();">Batal</button>
          <button type="submit" class="btn-navy" style="margin: 0;">💾 Simpan Template</button>
        </div>
      </form>
    </article>
  `;
  document.body.appendChild(overlay);
  overlay.showModal();
};

window.saveActiveAsTemplate = async function(e) {
  e.preventDefault();
  const name = document.getElementById('custom-template-name').value.trim();
  const desc = document.getElementById('custom-template-desc').value.trim() || 'Template anggaran kustom';

  const cats = await getAllByIndexFromStore('categories', 'by_budget', currentBudgetId);
  const templateCategories = [];
  
  for (const cat of cats) {
    const items = await getAllByIndexFromStore('items', 'by_category', cat.id);
    templateCategories.push({
      id: cat.id.replace(`cat_${currentBudgetId}_`, ''),
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
      target_pct: cat.target_pct,
      type: cat.category_type,
      items: items.map(i => ({
        name: i.name,
        planned_amount: i.planned_amount || 0,
        order: i.order || 0
      }))
    });
  }

  const newTemplate = {
    id: `tmpl_custom_${Date.now()}`,
    name,
    description: desc,
    categories: templateCategories
  };

  await putToStore('templates', newTemplate);
  document.getElementById('modal-save-custom-template').close();
  document.getElementById('modal-save-custom-template').remove();
  
  if (window.TMPT_UI) window.TMPT_UI.toast(`Template "${name}" berhasil disimpan!`, 'success');
};

// ============================================================
// KONFIRMASI MODAL & DIALOG
// ============================================================

async function showConfirmModal(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-message');
    if (!modal || !msgEl) {
      resolve(confirm(message));
      return;
    }
    msgEl.textContent = message;
    modal._resolve = resolve;
    modal.showModal();
  });
}

window.selectAndApplyTemplate = async function(templateId) {
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat mengganti template pada periode yang ditutup.', 'warning');
    return;
  }
  const confirmed = await showConfirmModal('Ganti template akan menyetel ulang kategori budget periode ini. Lanjutkan?');
  if (!confirmed) return;

  await createBudgetFromTemplate(templateId, activeYear, activeMonth, 0);
  document.getElementById('modal-template-picker').close();
  document.getElementById('modal-template-picker').remove();

  if (window.TMPT_UI) window.TMPT_UI.toast('Template berhasil diganti!', 'success');
  await renderTab();
};

// ============================================================
// TUTUP BUKU PERIODE
// ============================================================

window.openClosePeriodWizard = async function() {
  const confirmed = await showConfirmModal(
    `Tutup Buku periode ${getBulanName(activeMonth)} ${activeYear}? ` +
    `Semua kategori & item akan disalin ke periode berikutnya dengan nilai Aktual direset ke 0. ` +
    `Saldo sisa carry-forward akan dimasukkan ke pembuka periode baru.`
  );
  if (!confirmed) return;

  // Hitung next period
  let nextMonth = activeMonth + 1;
  let nextYear = activeYear;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }

  const summary = await calculateBudgetSummary(currentBudgetId);
  const carryForward = summary.actualSavings;

  // Tandai budget periode ini sebagai closed
  let budget = await getFromStore('budgets', currentBudgetId);
  if (budget) {
    budget.status = 'closed';
    budget.closed_at = new Date().toISOString();
    budget.closing_balance = carryForward;
    await putToStore('budgets', budget);
  }

  // Cek apakah periode berikutnya sudah ada datanya
  const nextBudgetId = `budget_${nextYear}_${nextMonth}`;
  const existingNext = await getFromStore('budgets', nextBudgetId);
  const existingNextCats = await getAllByIndexFromStore('categories', 'by_budget', nextBudgetId);

  if (!existingNext || existingNextCats.length === 0) {
    // Salin struktur kategori & item dari periode sekarang, reset aktual = 0
    await copyBudgetToNextPeriod(currentBudgetId, nextYear, nextMonth, carryForward);
    if (window.TMPT_UI) window.TMPT_UI.toast(
      `Buku ${getBulanName(activeMonth)} ${activeYear} ditutup. Periode ${getBulanName(nextMonth)} ${nextYear} dibuat dari salinan dengan Aktual = 0.`,
      'success'
    );
  } else {
    if (window.TMPT_UI) window.TMPT_UI.toast(
      `Buku ${getBulanName(activeMonth)} ${activeYear} ditutup. Periode ${getBulanName(nextMonth)} ${nextYear} sudah ada, tidak disalin ulang.`,
      'info'
    );
  }

  // Pindah ke periode berikutnya
  activeMonth = nextMonth;
  activeYear = nextYear;
  currentBudgetId = nextBudgetId;

  await renderTab();
};

window.reopenPeriod = async function() {
  const confirmed = await showConfirmModal(
    `Buka kembali periode ${getBulanName(activeMonth)} ${activeYear}? ` +
    `Anda akan dapat mengedit anggaran dan menambahkan transaksi kembali.`
  );
  if (!confirmed) return;

  let budget = await getFromStore('budgets', currentBudgetId);
  if (budget) {
    budget.status = 'active';
    delete budget.closed_at;
    delete budget.closing_balance;
    await putToStore('budgets', budget);
  }

  if (window.TMPT_UI) window.TMPT_UI.toast(`Periode ${getBulanName(activeMonth)} ${activeYear} berhasil dibuka kembali.`, 'success');
  await renderTab();
};

window.deleteActivePeriod = async function() {
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat menghapus periode yang sudah ditutup. Silakan buka terlebih dahulu.', 'warning');
    return;
  }
  const periodName = `${getBulanName(activeMonth)} ${activeYear}`;
  const confirmed = await showConfirmModal(
    `Apakah Anda yakin ingin menghapus seluruh data anggaran, kategori, item, dan transaksi untuk periode ${periodName}? Tindakan ini tidak dapat dibatalkan.`
  );
  if (!confirmed) return;

  // Hapus semua item & kategori
  const cats = await getAllByIndexFromStore('categories', 'by_budget', currentBudgetId);
  for (const cat of cats) {
    const items = await getAllByIndexFromStore('items', 'by_category', cat.id);
    for (const item of items) {
      await deleteFromStore('items', item.id);
    }
    await deleteFromStore('categories', cat.id);
  }

  // Hapus semua transaksi
  const txs = await getAllFromStore('transactions');
  const periodTxs = txs.filter(t => t.budget_id === currentBudgetId);
  for (const tx of periodTxs) {
    await deleteFromStore('transactions', tx.id);
  }

  // Hapus budget
  await deleteFromStore('budgets', currentBudgetId);

  if (window.TMPT_UI) window.TMPT_UI.toast(`Data periode ${periodName} berhasil dihapus.`, 'info');

  // Reset ke bulan/tahun sekarang
  activeYear = new Date().getFullYear();
  activeMonth = new Date().getMonth() + 1;
  currentBudgetId = `budget_${activeYear}_${activeMonth}`;

  // Pastikan periode default terbentuk jika belum ada
  let budget = await getFromStore('budgets', currentBudgetId);
  if (!budget) {
    await createBudgetFromTemplate('tmpl_50_30_20', activeYear, activeMonth, 0);
  }

  await renderTab();
};

// ============================================================
// NATIVE DRAG-AND-DROP UTILITIES FOR CATEGORIES & ITEMS
// ============================================================

let draggedItemId = null;
let draggedCategoryId = null;

window.itemDragStart = function(e, itemId) {
  e.dataTransfer.setData('text/plain', itemId);
  draggedItemId = itemId;
  e.currentTarget.style.opacity = '0.4';
};

window.itemDragEnd = function(e) {
  e.currentTarget.style.opacity = '1';
  draggedItemId = null;
};

window.categoryDragStart = function(e, catId) {
  e.dataTransfer.setData('text/plain', catId);
  draggedCategoryId = catId;
  e.currentTarget.style.opacity = '0.4';
};

window.categoryDragEnd = function(e) {
  e.currentTarget.style.opacity = '1';
  draggedCategoryId = null;
};

window.allowDrop = function(e) {
  e.preventDefault();
};

window.itemDrop = async function(e, targetItemId) {
  e.preventDefault();
  const sourceId = draggedItemId || e.dataTransfer.getData('text/plain');
  if (!sourceId || sourceId === targetItemId) return;

  const sourceItem = await getFromStore('items', sourceId);
  const targetItem = await getFromStore('items', targetItemId);

  if (sourceItem && targetItem && sourceItem.category_id === targetItem.category_id) {
    const tempOrder = sourceItem.order;
    sourceItem.order = targetItem.order;
    targetItem.order = tempOrder;

    await putToStore('items', sourceItem);
    await putToStore('items', targetItem);
    await renderTab();
  }
};

window.categoryDrop = async function(e, targetCatId) {
  e.preventDefault();
  const sourceId = draggedCategoryId || e.dataTransfer.getData('text/plain');
  if (!sourceId || sourceId === targetCatId) return;

  const sourceCat = await getFromStore('categories', sourceId);
  const targetCat = await getFromStore('categories', targetCatId);

  if (sourceCat && targetCat && sourceCat.budget_id === targetCat.budget_id && sourceCat.category_type === targetCat.category_type) {
    const tempOrder = sourceCat.order;
    sourceCat.order = targetCat.order;
    targetCat.order = tempOrder;

    await putToStore('categories', sourceCat);
    await putToStore('categories', targetCat);
    await renderTab();
  }
};

window.toggleItemRealization = async function(checkboxEl, itemId, categoryType, plannedAmount) {
  const budgetRecord = await getFromStore('budgets', currentBudgetId);
  if (budgetRecord && budgetRecord.status === 'closed') {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak dapat mengubah realisasi pada periode yang ditutup.', 'warning');
    checkboxEl.checked = !checkboxEl.checked;
    return;
  }

  const item = await getFromStore('items', itemId);
  if (!item) return;

  const txId = `tx_auto_${item.id}`;

  if (checkboxEl.checked) {
    // Buat transaksi otomatis senilai rencana
    const tx = {
      id: txId,
      budget_id: currentBudgetId,
      budget_item_id: item.id,
      type: categoryType,
      amount: plannedAmount,
      description: `Realisasi Otomatis: ${item.name}`,
      date: new Date().toISOString().substring(0, 10),
      payment_method: 'Manual Check',
      tags: ['auto-checked']
    };
    await putToStore('transactions', tx);
    if (window.TMPT_UI) window.TMPT_UI.toast(`Realisasi otomatis senilai rencana untuk "${item.name}" berhasil dibuat!`, 'success');
  } else {
    // Hapus transaksi otomatis
    await deleteFromStore('transactions', txId);
    if (window.TMPT_UI) window.TMPT_UI.toast(`Transaksi realisasi otomatis untuk "${item.name}" dihapus.`, 'info');
  }

  await renderTab();
};

