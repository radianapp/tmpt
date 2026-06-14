// app/kerja/budget/js/budget-core.js
import { putToStore, getFromStore, getAllFromStore, getAllByIndexFromStore, deleteFromStore } from './budget-db.js';

export const DEFAULT_TEMPLATES = [
  {
    id: 'tmpl_50_30_20',
    name: '50/30/20 Standard',
    description: 'Aturan klasik: 50% Kebutuhan (Rutin/Tagihan), 30% Keinginan, 20% Tabungan/Investasi.',
    categories: [
      { id: 'c_50_income', name: 'PEMASUKAN', icon: '💵', color: '#10b981', target_pct: 100, type: 'income', items: ['Gaji Pokok', 'Freelance/Bonus'] },
      { id: 'c_50_need', name: 'KEBUTUHAN', icon: '🏠', color: '#3b82f6', target_pct: 50, type: 'expense', items: ['Sewa/KPR', 'Listrik', 'Air', 'Internet', 'Makan', 'Transportasi'] },
      { id: 'c_30_want', name: 'KEINGINAN', icon: '🎯', color: '#f59e0b', target_pct: 30, type: 'expense', items: ['Hiburan', 'Makan Luar', 'Belanja', 'Langganan Film'] },
      { id: 'c_20_save', name: 'TABUNGAN & INVESTASI', icon: '💰', color: '#10b981', target_pct: 20, type: 'transfer', items: ['Dana Darurat', 'Emas', 'Reksa Dana'] }
    ]
  },
  {
    id: 'tmpl_karyawan_lajang',
    name: 'Karyawan Lajang (Format Lampiran)',
    description: 'Struktur anggaran bulanan profesional lajang dengan cicilan dan tagihan rutin.',
    categories: [
      { id: 'c_l_income', name: 'PEMASUKAN', icon: '💵', color: '#10b981', target_pct: 100, type: 'income', items: ['Gaji Pokok', 'Freelance/Bonus'] },
      { id: 'c_l_invest', name: 'INVEST', icon: '📈', color: '#8b5cf6', target_pct: 5, type: 'transfer', items: ['Emas Pegadaian', 'Reksa Dana'] },
      { id: 'c_l_cicilan', name: 'CICILAN', icon: '💳', color: '#ef4444', target_pct: 38, type: 'expense', items: ['Cicilan HP', 'Cicilan Motor'] },
      { id: 'c_l_rutin', name: 'RUTIN', icon: '🔄', color: '#3b82f6', target_pct: 50, type: 'expense', items: ['BKPSM', 'Akomodasi/Kost', 'Makan Harian'] },
      { id: 'c_l_tagihan', name: 'TAGIHAN', icon: '📋', color: '#ec4899', target_pct: 7, type: 'expense', items: ['CBN Internet', 'Listrik', 'PDAM', 'Pulsa'] }
    ]
  }
];

/**
 * Membuat data budget bulanan baru dari template tertentu.
 */
export async function createBudgetFromTemplate(templateId, year, month, openingBalance = 0) {
  let template = DEFAULT_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    template = await getFromStore('templates', templateId);
  }
  if (!template) {
    template = DEFAULT_TEMPLATES[0];
  }
  const budgetId = `budget_${year}_${month}`;

  // Reset kategori dan item lama jika budget sudah ada
  const oldCategories = await getAllByIndexFromStore('categories', 'by_budget', budgetId);
  for (let oldCat of oldCategories) {
    const oldItems = await getAllByIndexFromStore('items', 'by_category', oldCat.id);
    for (let oldItem of oldItems) {
      await deleteFromStore('items', oldItem.id);
    }
    await deleteFromStore('categories', oldCat.id);
  }

  const budget = {
    id: budgetId,
    year: parseInt(year),
    month: parseInt(month),
    title: `Budget ${getBulanName(month)} ${year}`,
    status: 'active',
    opening_balance: openingBalance,
    notes: '',
    created_at: new Date().toISOString()
  };

  await putToStore('budgets', budget);

  // Buat Categories & Items
  for (let c of template.categories) {
    const catId = `cat_${budgetId}_${c.id}`;
    const category = {
      id: catId,
      budget_id: budgetId,
      name: c.name,
      icon: c.icon,
      color: c.color,
      target_pct: c.target_pct,
      category_type: c.type,
      order: template.categories.indexOf(c)
    };
    await putToStore('categories', category);

    for (let itemData of c.items) {
      const itemId = `item_${catId}_${Math.random().toString(36).substr(2, 9)}`;
      let itemName = '';
      let plannedAmount = 0;
      let orderIndex = c.items.indexOf(itemData);

      if (typeof itemData === 'object' && itemData !== null) {
        itemName = itemData.name || '';
        plannedAmount = parseFloat(itemData.planned_amount) || 0;
        if (typeof itemData.order === 'number') {
          orderIndex = itemData.order;
        }
      } else {
        itemName = itemData;
      }

      const item = {
        id: itemId,
        category_id: catId,
        name: itemName,
        description: '',
        planned_amount: plannedAmount,
        actual_amount: 0,
        is_fixed: false,
        due_date: null,
        order: orderIndex
      };
      await putToStore('items', item);
    }
  }

  // Broadcast data changed ke Berkas
  try {
    const channel = new BroadcastChannel('tmpt_office');
    channel.postMessage({ type: 'FILE_CREATED', payload: { id: budgetId, type: 'budget' }, source_app: 'budget' });
    channel.close();
  } catch (e) {}

  return budget;
}

export function getBulanName(monthNum) {
  const daftar = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return daftar[parseInt(monthNum) - 1] || '';
}

/**
 * Melakukan kalkulasi total rencana, realisasi, dan sisa saldo.
 */
export async function calculateBudgetSummary(budgetId) {
  const categories = await getAllByIndexFromStore('categories', 'by_budget', budgetId);
  const items = [];
  for (let cat of categories) {
    const catItems = await getAllByIndexFromStore('items', 'by_category', cat.id);
    items.push(...catItems);
  }

  const transactions = await getAllByIndexFromStore('transactions', 'by_budget', budgetId);

  // Kalkulasi actual per item berdasarkan transaksi
  for (let item of items) {
    const itemTx = transactions.filter(t => t.budget_item_id === item.id);
    item.actual_amount = itemTx.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
    await putToStore('items', item);
  }

  const plannedIncome = items.filter(i => {
    const cat = categories.find(c => c.id === i.category_id);
    return cat && cat.category_type === 'income';
  }).reduce((sum, i) => sum + parseFloat(i.planned_amount || 0), 0);

  const plannedExpense = items.filter(i => {
    const cat = categories.find(c => c.id === i.category_id);
    return cat && (cat.category_type === 'expense' || cat.category_type === 'transfer');
  }).reduce((sum, i) => sum + parseFloat(i.planned_amount || 0), 0);

  const actualIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  const actualExpense = transactions.filter(t => t.type === 'expense' || t.type === 'transfer').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  return {
    plannedIncome,
    plannedExpense,
    actualIncome,
    actualExpense,
    plannedSavings: plannedIncome - plannedExpense,
    actualSavings: actualIncome - actualExpense
  };
}

/**
 * Menyalin struktur kategori & item dari periode sumber ke periode tujuan baru.
 * Nilai actual_amount di-reset ke 0 (diasumsikan belum ada transaksi di periode baru).
 *
 * @param {string} sourceBudgetId - ID budget periode yang ditutup
 * @param {number} nextYear - Tahun periode berikutnya
 * @param {number} nextMonth - Bulan periode berikutnya
 * @param {number} openingBalance - Saldo carry-forward dari periode sebelumnya
 */
export async function copyBudgetToNextPeriod(sourceBudgetId, nextYear, nextMonth, openingBalance = 0) {
  const nextBudgetId = `budget_${nextYear}_${nextMonth}`;

  // Buat record budget baru
  const newBudget = {
    id: nextBudgetId,
    year: parseInt(nextYear),
    month: parseInt(nextMonth),
    title: `Budget ${getBulanName(nextMonth)} ${nextYear}`,
    status: 'active',
    opening_balance: openingBalance,
    notes: '',
    created_at: new Date().toISOString()
  };
  await putToStore('budgets', newBudget);

  // Ambil kategori dari periode sumber
  const sourceCategories = await getAllByIndexFromStore('categories', 'by_budget', sourceBudgetId);

  for (let srcCat of sourceCategories) {
    // Buat kategori baru di periode tujuan dengan ID berbeda
    const newCatId = `cat_${nextBudgetId}_${srcCat.id.replace(`cat_${sourceBudgetId}_`, '')}`;
    const newCategory = {
      id: newCatId,
      budget_id: nextBudgetId,
      name: srcCat.name,
      icon: srcCat.icon,
      color: srcCat.color,
      target_pct: srcCat.target_pct,
      category_type: srcCat.category_type,
      order: srcCat.order
    };
    await putToStore('categories', newCategory);

    // Ambil item dari kategori sumber dan salin ke kategori baru
    const srcItems = await getAllByIndexFromStore('items', 'by_category', srcCat.id);
    for (let srcItem of srcItems) {
      const newItemId = `item_${newCatId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const newItem = {
        id: newItemId,
        category_id: newCatId,
        name: srcItem.name,
        description: srcItem.description || '',
        planned_amount: srcItem.planned_amount || 0, // Salin nilai rencana
        actual_amount: 0,                            // Reset aktual ke 0
        is_fixed: srcItem.is_fixed || false,
        due_date: null,
        order: srcItem.order
      };
      await putToStore('items', newItem);
    }
  }

  // Broadcast ke ekosistem TMPT
  try {
    const channel = new BroadcastChannel('tmpt_office');
    channel.postMessage({ type: 'FILE_CREATED', payload: { id: nextBudgetId, type: 'budget' }, source_app: 'budget' });
    channel.close();
  } catch (e) {}

  return newBudget;
}
