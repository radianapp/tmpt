// app/kerja/budget/js/budget-db.js
import { openTmptDB, dbGet, dbPut, dbDelete, dbGetAll, dbGetAllByIndex } from '/shared/db.js';

const DB_NAME = 'tmpt_budget';
const DB_VERSION = 2;

let db = null;

/**
 * Menginisialisasi IndexedDB tmpt_budget dengan skema tabel budgets, categories, items, transactions, goals, debts, dan templates.
 */
export async function initBudgetDB() {
  if (db) return db;
  db = await openTmptDB(DB_NAME, DB_VERSION, (database) => {
    // 1. budgets
    if (!database.objectStoreNames.contains('budgets')) {
      const budgetStore = database.createObjectStore('budgets', { keyPath: 'id' });
      budgetStore.createIndex('by_year_month', ['year', 'month'], { unique: true });
    }
    // 2. categories
    if (!database.objectStoreNames.contains('categories')) {
      const catStore = database.createObjectStore('categories', { keyPath: 'id' });
      catStore.createIndex('by_budget', 'budget_id', { unique: false });
    }
    // 3. items
    if (!database.objectStoreNames.contains('items')) {
      const itemStore = database.createObjectStore('items', { keyPath: 'id' });
      itemStore.createIndex('by_category', 'category_id', { unique: false });
    }
    // 4. transactions
    if (!database.objectStoreNames.contains('transactions')) {
      const txStore = database.createObjectStore('transactions', { keyPath: 'id' });
      txStore.createIndex('by_budget', 'budget_id', { unique: false });
      txStore.createIndex('by_item', 'budget_item_id', { unique: false });
      txStore.createIndex('by_ref', 'import_ref', { unique: false });
    }
    // 5. goals
    if (!database.objectStoreNames.contains('goals')) {
      database.createObjectStore('goals', { keyPath: 'id' });
    }
    // 6. debts
    if (!database.objectStoreNames.contains('debts')) {
      database.createObjectStore('debts', { keyPath: 'id' });
    }
    // 7. templates
    if (!database.objectStoreNames.contains('templates')) {
      database.createObjectStore('templates', { keyPath: 'id' });
    }
  });
  return db;
}

// Helper CRUD generic
export async function getFromStore(storeName, key) {
  const database = await initBudgetDB();
  return dbGet(database, storeName, key);
}

export async function putToStore(storeName, value) {
  const database = await initBudgetDB();
  return dbPut(database, storeName, value);
}

export async function deleteFromStore(storeName, key) {
  const database = await initBudgetDB();
  return dbDelete(database, storeName, key);
}

export async function getAllFromStore(storeName) {
  const database = await initBudgetDB();
  return dbGetAll(database, storeName);
}

export async function getAllByIndexFromStore(storeName, indexName, value) {
  const database = await initBudgetDB();
  return dbGetAllByIndex(database, storeName, indexName, value);
}
