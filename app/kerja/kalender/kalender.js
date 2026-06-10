// app/kerja/kalender/kalender.js
import { openTmptDB, dbGet, dbGetAll, dbPut, dbDelete, DB_VERSIONS } from '/shared/db.js';
import { listenTMPT, broadcastTMPT, TMPT_EVENTS } from '/shared/broadcast.js';

const DB_NAME = 'tmpt_kalender';
const DB_VERSION = 2;

let db = null;
let activeCalendars = new Set();
let calendarsMetadata = {};
let currentDate = new Date();
let currentView = 'month'; // 'month', 'week', 'day', 'agenda'
let allEventsCache = [];
let linkedFilesToEditor = [];

// Init DB
async function initDB() {
  db = await openTmptDB(DB_NAME, DB_VERSION, (database) => {
    if (!database.objectStoreNames.contains('calendars')) {
      database.createObjectStore('calendars', { keyPath: 'id' });
    }
    if (!database.objectStoreNames.contains('events')) {
      const eventStore = database.createObjectStore('events', { keyPath: 'id' });
      eventStore.createIndex('by_calendar', 'calendar_id', { unique: false });
      eventStore.createIndex('by_start', 'start', { unique: false });
      eventStore.createIndex('by_source', ['source_app', 'source_id'], { unique: false });
    }
    if (!database.objectStoreNames.contains('reminders_queue')) {
      const rqStore = database.createObjectStore('reminders_queue', { keyPath: 'id' });
      rqStore.createIndex('by_fire_at', 'fire_at', { unique: false });
      rqStore.createIndex('by_shown', 'shown', { unique: false });
    }
  });

  // Check default calendars
  const calendars = await dbGetAll(db, 'calendars');
  if (calendars.length === 0) {
    const defaults = [
      { id: 'pribadi', name: 'Pribadi', color: '#2563eb', type: 'personal', visible: true, is_default: true },
      { id: 'kerja', name: 'Kerja', color: '#16a34a', type: 'work', visible: true, is_default: false },
      { id: 'deadline', name: 'Deadline', color: '#dc2626', type: 'tmpt_auto', visible: true, is_default: false },
      { id: 'impor', name: 'Impor', color: '#d97706', type: 'imported', visible: true, is_default: false }
    ];
    for (const cal of defaults) {
      await dbPut(db, 'calendars', cal);
    }
  }
}

// Load metadata and visible calendars
async function loadCalendars() {
  const calendars = await dbGetAll(db, 'calendars');
  activeCalendars.clear();
  calendarsMetadata = {};

  const listContainer = document.getElementById('calendar-list-container');
  if (listContainer) listContainer.innerHTML = '';

  calendars.forEach(cal => {
    calendarsMetadata[cal.id] = cal;
    if (cal.visible) {
      activeCalendars.add(cal.id);
    }

    if (listContainer) {
      const li = document.createElement('li');
      li.className = 'calendar-item';
      li.innerHTML = `
        <input type="checkbox" id="chk-cal-${cal.id}" ${cal.visible ? 'checked' : ''} style="margin-right: 0.5rem;">
        <span class="calendar-color-dot" style="background-color: ${cal.color};"></span>
        <span style="font-weight: 500;">${cal.name}</span>
      `;
      li.querySelector('input').addEventListener('change', async (e) => {
        cal.visible = e.target.checked;
        await dbPut(db, 'calendars', cal);
        if (cal.visible) {
          activeCalendars.add(cal.id);
        } else {
          activeCalendars.delete(cal.id);
        }
        await loadEventsAndRender();
      });
      listContainer.appendChild(li);
    }
  });

  // Populate Editor calendar select
  const select = document.getElementById('event-calendar');
  if (select) {
    select.innerHTML = '';
    calendars.forEach(cal => {
      // Don't manually add events to the auto deadline calendar normally
      const opt = document.createElement('option');
      opt.value = cal.id;
      opt.textContent = cal.name;
      select.appendChild(opt);
    });
  }
}

// Load events from DB and filter active
async function loadEventsAndRender() {
  allEventsCache = await dbGetAll(db, 'events');
  renderCalendar();
}

// Recurrence expander
function expandEvents(events, startRange, endRange) {
  const expanded = [];
  const startMs = new Date(startRange).getTime();
  const endMs = new Date(endRange).getTime();

  events.forEach(event => {
    // Skip if calendar is not checked/active
    if (!activeCalendars.has(event.calendar_id)) return;

    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    const durationMs = eventEnd.getTime() - eventStart.getTime();

    if (!event.rrule || event.rrule === 'none') {
      if (eventStart.getTime() <= endMs && eventEnd.getTime() >= startMs) {
        expanded.push({ ...event, originalEvent: event });
      }
      return;
    }

    // Expanding recurring event
    let currentStart = new Date(eventStart);
    let count = 0;
    const maxLimit = 366; // limit to maximum 1 year of occurrences

    while (currentStart.getTime() <= endMs && count < maxLimit) {
      const currentEnd = new Date(currentStart.getTime() + durationMs);

      if (currentEnd.getTime() >= startMs && currentStart.getTime() <= endMs) {
        expanded.push({
          ...event,
          id: `${event.id}_occ_${count}`,
          is_occurrence: true,
          parent_id: event.id,
          start: currentStart.toISOString(),
          end: currentEnd.toISOString(),
          originalEvent: event
        });
      }

      // Add step
      if (event.rrule === 'daily') {
        currentStart.setDate(currentStart.getDate() + 1);
      } else if (event.rrule === 'weekly') {
        currentStart.setDate(currentStart.getDate() + 7);
      } else if (event.rrule === 'monthly') {
        currentStart.setMonth(currentStart.getMonth() + 1);
      } else if (event.rrule === 'yearly') {
        currentStart.setFullYear(currentStart.getFullYear() + 1);
      } else {
        break;
      }
      count++;
    }
  });

  return expanded;
}

// Main render dispatcher
function renderCalendar() {
  const container = document.getElementById('calendar-view-container');
  if (!container) return;

  // Render view depending on active layout
  if (currentView === 'month') {
    renderMonthView(container);
  } else if (currentView === 'week') {
    renderWeekView(container);
  } else if (currentView === 'day') {
    renderDayView(container);
  } else if (currentView === 'agenda') {
    renderAgendaView(container);
  }
}

// 1. Month View Renderer
function renderMonthView(container) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Update title
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  document.getElementById('calendar-current-range').textContent = `${monthNames[month]} ${year}`;

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  // Create grid
  let html = `<div class="month-view-grid">`;
  const daysOfWeek = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  daysOfWeek.forEach(d => {
    html += `<div class="month-day-header">${d}</div>`;
  });

  // View start date and end date for expansion
  const viewStart = new Date(year, month, 1 - startDayOfWeek);
  const viewEnd = new Date(year, month + 1, 42 - startDayOfWeek - lastDayOfMonth);

  const activeEvents = expandEvents(allEventsCache, viewStart, viewEnd);

  // Helper to filter events on specific date (regardless of time zone offset)
  const getEventsForDate = (date) => {
    const dStr = date.toDateString();
    return activeEvents.filter(e => {
      const s = new Date(e.start);
      const ed = new Date(e.end);
      // Event runs on this day if:
      const checkDate = new Date(date);
      checkDate.setHours(0,0,0,0);
      const startCheck = new Date(s);
      startCheck.setHours(0,0,0,0);
      const endCheck = new Date(ed);
      endCheck.setHours(0,0,0,0);
      return checkDate >= startCheck && checkDate <= endCheck;
    }).sort((a,b) => new Date(a.start) - new Date(b.start));
  };

  // Add cells (total 42 cells)
  let cellCount = 0;
  
  // Previous month dates
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const dateObj = new Date(year, month - 1, day);
    const dayEvents = getEventsForDate(dateObj);
    html += renderDayCell(day, true, false, dateObj, dayEvents);
    cellCount++;
  }

  // Current month dates
  const today = new Date();
  for (let day = 1; day <= lastDayOfMonth; day++) {
    const dateObj = new Date(year, month, day);
    const isToday = dateObj.toDateString() === today.toDateString();
    const dayEvents = getEventsForDate(dateObj);
    html += renderDayCell(day, false, isToday, dateObj, dayEvents);
    cellCount++;
  }

  // Next month dates
  let nextMonthDay = 1;
  while (cellCount < 42) {
    const dateObj = new Date(year, month + 1, nextMonthDay);
    const dayEvents = getEventsForDate(dateObj);
    html += renderDayCell(nextMonthDay, true, false, dateObj, dayEvents);
    nextMonthDay++;
    cellCount++;
  }

  html += `</div>`;
  container.innerHTML = html;

  attachCellEvents();
}

function renderDayCell(dayNum, isOtherMonth, isToday, dateObj, dayEvents) {
  const dateStr = dateObj.toISOString().split('T')[0];
  let cellClass = 'month-day-cell';
  if (isOtherMonth) cellClass += ' other-month';
  if (isToday) cellClass += ' today';

  let eventChipsHtml = '';
  dayEvents.slice(0, 4).forEach(e => {
    const calMeta = calendarsMetadata[e.calendar_id] || { color: '#bbb' };
    const color = e.color || calMeta.color;
    
    // Choose chip class
    let chipType = 'chip-personal';
    if (e.calendar_id === 'kerja') chipType = 'chip-work';
    else if (e.calendar_id === 'deadline') chipType = 'chip-deadline';
    else if (e.calendar_id === 'impor') chipType = 'chip-import';

    // Time representation
    let timeStr = '';
    if (!e.all_day) {
      const dateStart = new Date(e.start);
      timeStr = `${String(dateStart.getHours()).padStart(2, '0')}:${String(dateStart.getMinutes()).padStart(2, '0')} `;
    }

    eventChipsHtml += `
      <div class="event-chip ${chipType}" data-event-id="${e.id}" style="--cal-color-personal: ${color}; --cal-color-personal-bg: ${color}20;">
        ${escapeHtml(timeStr + e.title)}
      </div>
    `;
  });

  if (dayEvents.length > 4) {
    eventChipsHtml += `<div style="font-size:0.7rem; font-weight:700; color:var(--pico-muted-color); text-align:center;">+${dayEvents.length - 4} Acara</div>`;
  }

  return `
    <div class="${cellClass}" data-date="${dateStr}">
      <span class="day-number">${dayNum}</span>
      ${eventChipsHtml}
    </div>
  `;
}

// 2. Week View Renderer
function renderWeekView(container) {
  // Get Sunday of active week
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - day);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);

  // Title range
  const formatDateTitle = (d) => `${d.getDate()} ${d.toLocaleDateString('id', { month: 'short' })} ${d.getFullYear()}`;
  document.getElementById('calendar-current-range').textContent = `${formatDateTitle(startOfWeek)} - ${formatDateTitle(endOfWeek)}`;

  const activeEvents = expandEvents(allEventsCache, startOfWeek, endOfWeek);

  // Headers HTML
  let html = `
    <div class="week-column-header-grid">
      <div class="week-header-day" style="background: var(--pico-card-sectioning-background-color); border-bottom:1px solid var(--pico-muted-border-color);"></div>
      <div class="week-headers" style="grid-template-columns: repeat(7, 1fr);">
  `;

  const weekDates = [];
  const todayStr = new Date().toDateString();
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    weekDates.push(d);
    
    const isToday = d.toDateString() === todayStr;
    const headerClass = isToday ? 'week-header-day today' : 'week-header-day';
    const dayLabel = d.toLocaleDateString('id', { weekday: 'short', day: 'numeric' });
    html += `<div class="${headerClass}" data-date="${d.toISOString().split('T')[0]}">${dayLabel}</div>`;
  }

  html += `
      </div>
    </div>
    <div class="agenda-timeline-view">
      <div class="timeline-hour-col">
  `;

  // Hour labels column (08:00 - 22:00 for optimal screen estate)
  for (let h = 8; h <= 22; h++) {
    html += `<div class="timeline-hour-label">${String(h).padStart(2, '0')}:00</div>`;
  }

  html += `
      </div>
      <div class="timeline-multi-cols" style="grid-template-columns: repeat(7, 1fr);">
  `;

  // Draw day columns with absolute positioned event cards
  weekDates.forEach((colDate, colIdx) => {
    const dateStr = colDate.toISOString().split('T')[0];
    
    // Grid rows mapping Hour slots
    let colHtml = `<div class="timeline-day-col" data-date="${dateStr}" style="height: 100%; border-right: 1px solid var(--pico-muted-border-color); display: flex; flex-direction: column;">`;
    for (let h = 8; h <= 22; h++) {
      colHtml += `<div class="timeline-grid-row" data-hour="${h}" style="border-bottom: 1px solid rgba(0,0,0,0.03); height: 60px;"></div>`;
    }

    // Filter events for this column day
    const dayStart = new Date(colDate); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(colDate); dayEnd.setHours(23,59,59,999);
    
    const dayEvents = activeEvents.filter(e => {
      const s = new Date(e.start);
      const ed = new Date(e.end);
      return s.getTime() <= dayEnd.getTime() && ed.getTime() >= dayStart.getTime();
    });

    dayEvents.forEach(e => {
      const start = new Date(e.start);
      const end = new Date(e.end);
      
      // Calculate top & height percentage (within 08:00 - 23:00 boundary)
      const startHour = start.getHours() + start.getMinutes() / 60;
      const endHour = end.getHours() + end.getMinutes() / 60;
      
      // Bound it between 8 and 23
      const drawStart = Math.max(8, startHour);
      const drawEnd = Math.min(23, endHour);
      
      if (drawEnd <= drawStart) return; // Outside view boundary

      const topOffset = (drawStart - 8) * 60;
      const height = (drawEnd - drawStart) * 60;
      
      const calMeta = calendarsMetadata[e.calendar_id] || { color: '#bbb' };
      const color = e.color || calMeta.color;

      colHtml += `
        <div class="absolute-event-card" data-event-id="${e.id}" style="top: ${topOffset}px; height: ${height}px; background-color: ${color}1e; border-left-color: ${color}; color: ${color};">
          <div class="absolute-event-title">${escapeHtml(e.title)}</div>
          <div class="absolute-event-time">${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')} - ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}</div>
        </div>
      `;
    });

    colHtml += `</div>`;
    html += colHtml;
  });

  html += `
      </div>
    </div>
  `;
  
  container.innerHTML = html;
  attachCellEvents();
}

// 3. Day View Renderer
function renderDayView(container) {
  document.getElementById('calendar-current-range').textContent = currentDate.toLocaleDateString('id', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const startOfDay = new Date(currentDate); startOfDay.setHours(0,0,0,0);
  const endOfDay = new Date(currentDate); endOfDay.setHours(23,59,59,999);

  const activeEvents = expandEvents(allEventsCache, startOfDay, endOfDay);

  const dateStr = currentDate.toISOString().split('T')[0];

  let html = `
    <div class="agenda-timeline-view" style="grid-template-columns: 60px 1fr;">
      <div class="timeline-hour-col">
  `;

  for (let h = 8; h <= 22; h++) {
    html += `<div class="timeline-hour-label">${String(h).padStart(2, '0')}:00</div>`;
  }

  html += `
      </div>
      <div class="timeline-day-col" data-date="${dateStr}" style="position: relative; height: 100%;">
  `;

  for (let h = 8; h <= 22; h++) {
    html += `<div class="timeline-grid-row" data-hour="${h}" style="border-bottom: 1px solid rgba(0,0,0,0.03); height: 60px;"></div>`;
  }

  activeEvents.forEach(e => {
    const start = new Date(e.start);
    const end = new Date(e.end);
    
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    
    const drawStart = Math.max(8, startHour);
    const drawEnd = Math.min(23, endHour);
    
    if (drawEnd <= drawStart) return;

    const topOffset = (drawStart - 8) * 60;
    const height = (drawEnd - drawStart) * 60;
    
    const calMeta = calendarsMetadata[e.calendar_id] || { color: '#bbb' };
    const color = e.color || calMeta.color;

    html += `
      <div class="absolute-event-card" data-event-id="${e.id}" style="top: ${topOffset}px; height: ${height}px; background-color: ${color}1e; border-left-color: ${color}; color: ${color};">
        <div class="absolute-event-title" style="font-size: 0.85rem;">${escapeHtml(e.title)}</div>
        <div class="absolute-event-time" style="font-size: 0.75rem;">${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')} - ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}</div>
        <div style="font-size: 0.75rem; margin-top: 0.25rem; opacity: 0.9;">${escapeHtml(e.description || '')}</div>
      </div>
    `;
  });

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;
  attachCellEvents();
}

// 4. Agenda View Renderer
function renderAgendaView(container) {
  document.getElementById('calendar-current-range').textContent = 'Agenda Mendatang';

  const viewStart = new Date(currentDate); viewStart.setHours(0,0,0,0);
  // View next 3 months of events
  const viewEnd = new Date(currentDate);
  viewEnd.setMonth(viewEnd.getMonth() + 3);

  const activeEvents = expandEvents(allEventsCache, viewStart, viewEnd);

  // Group events by date
  const grouped = {};
  activeEvents.forEach(e => {
    const sDate = new Date(e.start);
    const key = sDate.toDateString();
    if (!grouped[key]) {
      grouped[key] = {
        date: sDate,
        events: []
      };
    }
    grouped[key].events.push(e);
  });

  // Sort groups chronologically
  const sortedGroups = Object.values(grouped).sort((a,b) => a.date - b.date);

  if (sortedGroups.length === 0) {
    container.innerHTML = `
      <div class="tmpt-empty-state">
        <span>📅</span>
        <h3>Tidak ada agenda mendatang</h3>
        <p>Jadwal kosong untuk 3 bulan ke depan. Buat acara baru untuk mulai mengisi waktu.</p>
      </div>
    `;
    return;
  }

  let html = `<div class="agenda-list">`;
  sortedGroups.forEach(group => {
    const dayStr = group.date.toLocaleDateString('id', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    html += `
      <div class="agenda-day-group">
        <div class="agenda-day-title">${dayStr}</div>
    `;

    group.events.sort((a,b) => new Date(a.start) - new Date(b.start)).forEach(e => {
      const start = new Date(e.start);
      const end = new Date(e.end);
      const calMeta = calendarsMetadata[e.calendar_id] || { color: '#bbb' };
      const color = e.color || calMeta.color;

      let timeStr = 'Sepanjang hari';
      if (!e.all_day) {
        timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')} - ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      }

      let fileLinksHtml = '';
      if (e.tmpt_links && e.tmpt_links.length > 0) {
        fileLinksHtml = `
          <div class="agenda-event-links">
            ${e.tmpt_links.map(l => `<span>🔗 ${escapeHtml(l.name)}</span>`).join('')}
          </div>
        `;
      }

      html += `
        <div class="agenda-event-item" data-event-id="${e.id}">
          <div class="agenda-event-time">${timeStr}</div>
          <div style="width: 12px; height: 12px; border-radius:50%; background-color: ${color};"></div>
          <div>
            <div class="agenda-event-title">${escapeHtml(e.title)}</div>
            ${fileLinksHtml}
          </div>
          <div class="secondary" style="font-size: 0.8rem;">${escapeHtml(e.location || '')}</div>
        </div>
      `;
    });

    html += `</div>`;
  });

  html += `</div>`;
  container.innerHTML = html;

  // Add click events to items
  container.querySelectorAll('.agenda-event-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-event-id');
      viewEvent(id);
    });
  });
}

function attachCellEvents() {
  // Cells clicking
  document.querySelectorAll('.month-day-cell, .timeline-day-col').forEach(cell => {
    cell.addEventListener('click', (e) => {
      // If clicked chip inside, let chip handler execute
      if (e.target.closest('.event-chip') || e.target.closest('.absolute-event-card')) return;
      
      const dateStr = cell.getAttribute('data-date');
      const hour = cell.getAttribute('data-hour');
      openEventEditor({ date: dateStr, hour });
    });
  });

  // Event chips / cards clicking
  document.querySelectorAll('.event-chip, .absolute-event-card').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = chip.getAttribute('data-event-id');
      viewEvent(id);
    });
  });
}

// Open Editor Modal
function openEventEditor(prefill = {}) {
  const modal = document.getElementById('event-editor-modal');
  document.getElementById('event-form').reset();
  linkedFilesToEditor = [];
  renderLinkedFilesEditor();

  document.getElementById('event-id').value = '';
  document.getElementById('event-source-app').value = '';
  document.getElementById('event-source-id').value = '';
  document.getElementById('event-modal-title').textContent = 'Buat Acara Baru';

  const todayStr = new Date().toISOString().split('T')[0];
  document.getElementById('event-start-date').value = prefill.date || todayStr;
  document.getElementById('event-end-date').value = prefill.date || todayStr;

  if (prefill.hour) {
    const startHour = String(prefill.hour).padStart(2, '0') + ':00';
    const endHour = String(Number(prefill.hour) + 1).padStart(2, '0') + ':00';
    document.getElementById('event-start-time').value = startHour;
    document.getElementById('event-end-time').value = endHour;
    document.getElementById('event-all-day').checked = false;
  } else {
    document.getElementById('event-start-time').value = '09:00';
    document.getElementById('event-end-time').value = '10:00';
    document.getElementById('event-all-day').checked = false;
  }

  // Load document list from Berkas
  loadFilesForLinking();

  modal.showModal();
}

// Load Document lists from tmpt_berkas
async function loadFilesForLinking() {
  const select = document.getElementById('event-link-doc-select');
  if (!select) return;
  select.innerHTML = '<option value="">Pilih Dokumen TMPT...</option>';

  try {
    const req = indexedDB.open('tmpt_berkas');
    req.onsuccess = (e) => {
      const dbBerkas = e.target.result;
      if (!dbBerkas.objectStoreNames.contains('files')) return;
      const tx = dbBerkas.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const files = getAllReq.result || [];
        files.forEach(file => {
          if (!file.trash) {
            const opt = document.createElement('option');
            opt.value = JSON.stringify(file);
            const icon = file.type === 'document' ? '📄' : (file.type === 'spreadsheet' ? '📊' : (file.type === 'form' ? '📋' : '📁'));
            opt.textContent = `${icon} ${file.name}`;
            select.appendChild(opt);
          }
        });
      };
    };
  } catch (err) {
    console.warn('Berkas database not ready yet.', err);
  }
}

// Rendering files inside Event Form
function renderLinkedFilesEditor() {
  const container = document.getElementById('event-linked-files-editor-container');
  if (!container) return;
  container.innerHTML = '';
  linkedFilesToEditor.forEach((file, idx) => {
    const chip = document.createElement('div');
    chip.style = 'display: inline-flex; align-items: center; gap: 0.5rem; background: var(--pico-card-sectioning-background-color); border: 1px solid var(--pico-muted-border-color); border-radius: 6px; padding: 0.25rem 0.5rem; font-size: 0.8rem;';
    const icon = file.type === 'document' ? '📄' : (file.type === 'spreadsheet' ? '📊' : (file.type === 'form' ? '📋' : '📁'));
    chip.innerHTML = `
      <span>${icon} ${escapeHtml(file.name)}</span>
      <span style="cursor: pointer; font-weight:700; color: var(--pico-danger-color);" data-idx="${idx}">✕</span>
    `;
    chip.querySelector('span[style*="pointer"]').addEventListener('click', () => {
      linkedFilesToEditor.splice(idx, 1);
      renderLinkedFilesEditor();
    });
    container.appendChild(chip);
  });
}

// View Event Details
async function viewEvent(id) {
  // If it is an occurrence, find original
  let eventId = id;
  if (id.includes('_occ_')) {
    eventId = id.split('_occ_')[0];
  }

  const event = await dbGet(db, 'events', eventId);
  if (!event) return;

  const modal = document.getElementById('event-viewer-modal');
  
  const titleEl = document.getElementById('view-event-title');
  titleEl.textContent = event.title;
  
  const calMeta = calendarsMetadata[event.calendar_id] || { color: '#bbb', name: 'Unknown' };
  const color = event.color || calMeta.color;
  titleEl.style.borderLeftColor = color;

  // Format Time
  const start = new Date(event.start);
  const end = new Date(event.end);
  const formatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  
  let timeStr = '';
  if (event.all_day) {
    timeStr = start.toLocaleDateString('id', formatOptions) + ' (Sepanjang hari)';
  } else {
    timeStr = start.toLocaleDateString('id', formatOptions) + ` · ${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')} - ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  }
  document.getElementById('view-event-time-str').textContent = timeStr;

  // Location
  const locContainer = document.getElementById('view-event-location-container');
  if (event.location) {
    locContainer.classList.remove('hidden');
    const locEl = document.getElementById('view-event-location');
    const isUrl = event.location.trim().match(/^(https?:\/\/|www\.)/i);
    if (isUrl) {
      let href = event.location.trim();
      if (href.toLowerCase().startsWith('www.')) {
        href = 'http://' + href;
      }
      locEl.innerHTML = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(event.location)}</a>`;
    } else {
      locEl.textContent = event.location;
    }
  } else {
    locContainer.classList.add('hidden');
  }

  // Calendar Badge
  const badge = document.getElementById('view-event-calendar-badge');
  badge.textContent = calMeta.name;
  badge.style.backgroundColor = color + '22';
  badge.style.color = color;

  // Recurrence
  const recBadge = document.getElementById('view-event-recurrence-badge');
  if (event.rrule && event.rrule !== 'none') {
    recBadge.classList.remove('hidden');
    const labels = { daily: 'Harian', weekly: 'Mingguan', monthly: 'Bulanan', yearly: 'Tahunan' };
    recBadge.textContent = '🔁 ' + (labels[event.rrule] || event.rrule);
  } else {
    recBadge.classList.add('hidden');
  }

  // Description
  const descContainer = document.getElementById('view-event-desc-container');
  if (event.description) {
    descContainer.classList.remove('hidden');
    document.getElementById('view-event-desc').textContent = event.description;
  } else {
    descContainer.classList.add('hidden');
  }

  // Linked Files
  const linksContainer = document.getElementById('view-event-links-container');
  const linksList = document.getElementById('view-event-links-list');
  linksList.innerHTML = '';
  if (event.tmpt_links && event.tmpt_links.length > 0) {
    linksContainer.classList.remove('hidden');
    event.tmpt_links.forEach(file => {
      const chip = document.createElement('a');
      chip.className = 'file-link-chip';
      
      // Determine relative URL according to application type
      let href = `/app/kerja/berkas/?id=${file.id}`;
      if (file.type === 'local_folder' && file.url) {
        href = file.url;
      } else if (file.type === 'document') {
        href = `/app/kerja/tulis/editor.html?id=${file.id}`;
      } else if (file.type === 'spreadsheet') {
        href = `/app/kerja/hitung/?id=${file.id}`;
      } else if (file.type === 'form') {
        href = `/app/kerja/forms/builder.html?id=${file.id}`;
      } else if (file.type === 'markdown') {
        href = `/app/dev/markdown/?id=${file.id}`;
      } else if (file.type === 'catatan') {
        href = `/app/kerja/catatan/?id=${file.id}`;
      } else if (file.url) {
        href = file.url;
      }
      
      chip.href = href;
      const icon = file.type === 'document' ? '📄' : (file.type === 'spreadsheet' ? '📊' : (file.type === 'form' ? '📋' : (file.type === 'markdown' ? '📝' : (file.type === 'local_folder' ? '📂' : '📁'))));
      chip.innerHTML = `<span>${icon} ${escapeHtml(file.name)}</span>`;
      linksList.appendChild(chip);
    });
  } else {
    linksContainer.classList.add('hidden');
  }

  // Setup actions buttons
  document.getElementById('btn-edit-event').onclick = () => {
    modal.close();
    editEvent(event);
  };

  document.getElementById('btn-delete-event').onclick = async () => {
    modal.close();
    await deleteEvent(event.id);
  };

  modal.showModal();
}

// Edit Event Form
function editEvent(event) {
  openEventEditor();
  
  document.getElementById('event-modal-title').textContent = 'Edit Acara';
  document.getElementById('event-id').value = event.id;
  document.getElementById('event-source-app').value = event.source_app || '';
  document.getElementById('event-source-id').value = event.source_id || '';
  document.getElementById('event-title').value = event.title;
  document.getElementById('event-calendar').value = event.calendar_id;
  document.getElementById('event-color').value = event.color || '';
  
  const start = new Date(event.start);
  const end = new Date(event.end);
  document.getElementById('event-start-date').value = start.toISOString().split('T')[0];
  document.getElementById('event-end-date').value = end.toISOString().split('T')[0];
  
  if (event.all_day) {
    document.getElementById('event-all-day').checked = true;
    document.getElementById('event-start-time').value = '09:00';
    document.getElementById('event-end-time').value = '10:00';
  } else {
    document.getElementById('event-all-day').checked = false;
    document.getElementById('event-start-time').value = String(start.getHours()).padStart(2, '0') + ':' + String(start.getMinutes()).padStart(2, '0');
    document.getElementById('event-end-time').value = String(end.getHours()).padStart(2, '0') + ':' + String(end.getMinutes()).padStart(2, '0');
  }

  document.getElementById('event-recurrence').value = event.rrule || 'none';
  
  if (event.reminders && event.reminders.length > 0) {
    document.getElementById('event-reminder').value = String(event.reminders[0]);
  } else {
    document.getElementById('event-reminder').value = 'none';
  }

  document.getElementById('event-location').value = event.location || '';
  document.getElementById('event-description').value = event.description || '';

  linkedFilesToEditor = event.tmpt_links ? [...event.tmpt_links] : [];
  renderLinkedFilesEditor();
}

// Delete Event
async function deleteEvent(id) {
  const confirmed = await showConfirmDialog('Apakah Anda yakin ingin menghapus acara ini?');
  if (!confirmed) return;

  await dbDelete(db, 'events', id);
  // Clear any existing reminders queue
  await clearReminderQueueForEvent(id);

  broadcastTMPT(TMPT_EVENTS.FILE_DELETED, {
    id,
    type: 'event'
  });

  if (window.TMPT_UI) {
    window.TMPT_UI.toast('Acara berhasil dihapus.', 'success');
  }
  await loadEventsAndRender();
}

// Save Event logic
async function saveEvent(form) {
  const id = document.getElementById('event-id').value || crypto.randomUUID();
  const title = document.getElementById('event-title').value;
  const calendar_id = document.getElementById('event-calendar').value;
  const color = document.getElementById('event-color').value || null;
  const all_day = document.getElementById('event-all-day').checked;
  
  const start_date = document.getElementById('event-start-date').value;
  const end_date = document.getElementById('event-end-date').value;
  const start_time = document.getElementById('event-start-time').value;
  const end_time = document.getElementById('event-end-time').value;

  let startIso = '';
  let endIso = '';
  if (all_day) {
    startIso = new Date(start_date + 'T00:00:00').toISOString();
    endIso = new Date(end_date + 'T23:59:59').toISOString();
  } else {
    startIso = new Date(start_date + 'T' + start_time).toISOString();
    endIso = new Date(end_date + 'T' + end_time).toISOString();
  }

  const rrule = document.getElementById('event-recurrence').value;
  const reminderVal = document.getElementById('event-reminder').value;
  const reminders = reminderVal === 'none' ? [] : [Number(reminderVal)];

  const location = document.getElementById('event-location').value;
  const description = document.getElementById('event-description').value;

  const source_app = document.getElementById('event-source-app').value || null;
  const source_id = document.getElementById('event-source-id').value || null;

  const eventObj = {
    id,
    calendar_id,
    title,
    description,
    location,
    start: startIso,
    end: endIso,
    all_day,
    rrule,
    reminders,
    status: 'confirmed',
    color,
    tmpt_links: linkedFilesToEditor,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ical_uid: null,
    source_app,
    source_id
  };

  await dbPut(db, 'events', eventObj);

  // Queue reminders
  await queueReminderForEvent(eventObj);

  broadcastTMPT(TMPT_EVENTS.EVENT_CREATED, {
    event_id: id,
    title: eventObj.title,
    start: eventObj.start
  });

  if (window.TMPT_UI) {
    window.TMPT_UI.toast('Acara berhasil disimpan.', 'success');
  }

  document.getElementById('event-editor-modal').close();
  await loadEventsAndRender();
}

// Queue reminder in IndexedDB
async function queueReminderForEvent(event) {
  // Clear any existing queue
  await clearReminderQueueForEvent(event.id);

  if (event.reminders && event.reminders.length > 0) {
    const minutesBefore = event.reminders[0];
    const eventStart = new Date(event.start);
    const fireTime = new Date(eventStart.getTime() - minutesBefore * 60 * 1000);
    
    // Only queue if fire time is in the future
    if (fireTime.getTime() > Date.now()) {
      const queueObj = {
        id: `${event.id}_rem_${minutesBefore}`,
        event_id: event.id,
        fire_at: fireTime.toISOString(),
        shown: false
      };
      await dbPut(db, 'reminders_queue', queueObj);
    }
  }
}

async function clearReminderQueueForEvent(eventId) {
  const queue = await dbGetAll(db, 'reminders_queue');
  for (const q of queue) {
    if (q.event_id === eventId) {
      await dbDelete(db, 'reminders_queue', q.id);
    }
  }
}

// Reminder Engine scan
async function scanReminderQueue() {
  if (!db) return;
  const now = new Date().toISOString();
  const queue = await dbGetAll(db, 'reminders_queue');

  for (const q of queue) {
    if (q.fire_at <= now && !q.shown) {
      q.shown = true;
      await dbPut(db, 'reminders_queue', q);
      
      // Trigger notification
      const event = await dbGet(db, 'events', q.event_id);
      if (event) {
        showWebNotification(event);
      }
    }
  }
}

function showWebNotification(event) {
  const title = `Pengingat TMPT: ${event.title}`;
  const options = {
    body: event.location ? `Lokasi: ${event.location}` : 'Acara dimulai sebentar lagi.',
    icon: '/favicon-512.png',
    tag: event.id
  };

  // Browser system notification
  if (Notification.permission === 'granted') {
    new Notification(title, options);
  }

  // Fallback / standard toast UI
  if (window.TMPT_UI) {
    window.TMPT_UI.toast(`⏰ Pengingat: ${event.title}`, 'warning');
  }
}

// iCalendar .ics Generation
function exportToICS() {
  // Get active view/calendar events
  const activeEvents = allEventsCache.filter(e => activeCalendars.has(e.calendar_id));
  if (activeEvents.length === 0) {
    if (window.TMPT_UI) window.TMPT_UI.toast('Tidak ada acara untuk diekspor.', 'warning');
    return;
  }

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TMPT//Kalender//ID',
    'CALSCALE:GREGORIAN'
  ];

  activeEvents.forEach(e => {
    const formatICSDate = (dateStr) => {
      const d = new Date(dateStr);
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const startStr = formatICSDate(e.start);
    const endStr = formatICSDate(e.end);
    const stampStr = formatICSDate(e.created_at || new Date().toISOString());
    const uid = e.ical_uid || `${e.id}@tmpt.my.id`;

    ics.push('BEGIN:VEVENT');
    ics.push(`UID:${uid}`);
    ics.push(`DTSTAMP:${stampStr}`);
    ics.push(`DTSTART:${startStr}`);
    ics.push(`DTEND:${endStr}`);
    ics.push(`SUMMARY:${e.title.replace(/[,;]/g, '\\$&')}`);

    if (e.description) {
      ics.push(`DESCRIPTION:${e.description.replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&')}`);
    }
    if (e.location) {
      ics.push(`LOCATION:${e.location.replace(/[,;]/g, '\\$&')}`);
    }
    if (e.rrule && e.rrule !== 'none') {
      let rruleStr = '';
      if (e.rrule === 'daily') rruleStr = 'FREQ=DAILY';
      else if (e.rrule === 'weekly') rruleStr = 'FREQ=WEEKLY';
      else if (e.rrule === 'monthly') rruleStr = 'FREQ=MONTHLY';
      else if (e.rrule === 'yearly') rruleStr = 'FREQ=YEARLY';
      if (rruleStr) ics.push(`RRULE:${rruleStr}`);
    }
    ics.push('END:VEVENT');
  });

  ics.push('END:VCALENDAR');
  const icsContent = ics.join('\r\n');

  // Trigger download
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tmpt_kalender_${new Date().toISOString().split('T')[0]}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// iCalendar .ics Parser
function parseICS(icsText) {
  const events = [];
  const lines = icsText.split(/\r?\n/);
  let currentEvent = null;

  const parseICSDate = (str) => {
    if (!str) return null;
    const clean = str.replace(/[:;]/g, '');
    const m = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
    if (!m) return null;
    const [_, y, mo, d, h, mi, s, utc] = m;
    if (h) {
      if (utc) {
        return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
      }
      return new Date(y, mo - 1, d, h, mi, s);
    }
    return new Date(y, mo - 1, d, 0, 0, 0);
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    while (i + 1 < lines.length && (lines[i+1].startsWith(' ') || lines[i+1].startsWith('\t'))) {
      line += lines[i+1].substring(1);
      i++;
    }

    const parts = line.split(':');
    if (parts.length < 2) continue;
    const keyWithParams = parts[0];
    const val = parts.slice(1).join(':');
    const key = keyWithParams.split(';')[0].toUpperCase();

    if (key === 'BEGIN' && val.toUpperCase() === 'VEVENT') {
      currentEvent = {
        id: crypto.randomUUID(),
        calendar_id: 'impor',
        title: 'Acara Tanpa Judul',
        description: '',
        location: '',
        start: '',
        end: '',
        all_day: false,
        rrule: 'none',
        reminders: [30],
        status: 'confirmed',
        color: null,
        tmpt_links: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ical_uid: null
      };
    } else if (currentEvent) {
      if (key === 'END' && val.toUpperCase() === 'VEVENT') {
        if (currentEvent.start && currentEvent.end) {
          events.push(currentEvent);
        }
        currentEvent = null;
      } else if (key === 'UID') {
        currentEvent.ical_uid = val;
      } else if (key === 'SUMMARY') {
        currentEvent.title = val.replace(/\\(.)/g, '$1');
      } else if (key === 'DESCRIPTION') {
        currentEvent.description = val.replace(/\\n/g, '\n').replace(/\\(.)/g, '$1');
      } else if (key === 'LOCATION') {
        currentEvent.location = val.replace(/\\(.)/g, '$1');
      } else if (key === 'DTSTART') {
        const dt = parseICSDate(val);
        if (dt) {
          currentEvent.start = dt.toISOString();
          if (val.length <= 8) currentEvent.all_day = true;
        }
      } else if (key === 'DTEND') {
        const dt = parseICSDate(val);
        if (dt) currentEvent.end = dt.toISOString();
      } else if (key === 'RRULE') {
        const rules = val.toUpperCase();
        if (rules.includes('FREQ=DAILY')) currentEvent.rrule = 'daily';
        else if (rules.includes('FREQ=WEEKLY')) currentEvent.rrule = 'weekly';
        else if (rules.includes('FREQ=MONTHLY')) currentEvent.rrule = 'monthly';
        else if (rules.includes('FREQ=YEARLY')) currentEvent.rrule = 'yearly';
      }
    }
  }
  return events;
}

// Handle imported files
async function handleICSImport(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = parseICS(e.target.result);
      if (parsed.length === 0) {
        if (window.TMPT_UI) window.TMPT_UI.toast('Gagal mengimpor: Berkas tidak valid.', 'error');
        return;
      }
      for (const event of parsed) {
        await dbPut(db, 'events', event);
        await queueReminderForEvent(event);
      }
      if (window.TMPT_UI) window.TMPT_UI.toast(`Berhasil mengimpor ${parsed.length} acara.`, 'success');
      document.getElementById('ics-import-modal').close();
      await loadEventsAndRender();
    } catch (err) {
      if (window.TMPT_UI) window.TMPT_UI.toast('Terjadi kesalahan saat parsing berkas.', 'error');
    }
  };
  reader.readAsText(file);
}

// Sync Deadlines from other apps (Tulis, hitung, forms etc.)
async function syncDeadlines() {
  if (!db) return;
  
  // Clean old auto deadline events
  const events = await dbGetAll(db, 'events');
  for (const e of events) {
    if (e.calendar_id === 'deadline' && e.source_app) {
      await dbDelete(db, 'events', e.id);
    }
  }

  // 1. Fetch deadlines from TMPT Berkas
  try {
    const req = indexedDB.open('tmpt_berkas');
    req.onsuccess = async (e) => {
      const dbBerkas = e.target.result;
      if (!dbBerkas.objectStoreNames.contains('files')) return;
      
      const tx = dbBerkas.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      const getAllReq = store.getAll();
      getAllReq.onsuccess = async () => {
        const files = getAllReq.result || [];
        for (const file of files) {
          if (!file.trash && file.deadline) {
            const start = new Date(file.deadline);
            const end = new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour event
            
            const eventObj = {
              id: `deadline_file_${file.id}`,
              calendar_id: 'deadline',
              title: `⚠️ Deadline: ${file.name}`,
              description: `Deadline otomatis yang disinkronisasi dari file TMPT Berkas.`,
              location: '',
              start: start.toISOString(),
              end: end.toISOString(),
              all_day: false,
              rrule: 'none',
              reminders: [1440], // 1 day before
              status: 'confirmed',
              color: '#dc2626',
              tmpt_links: [{ id: file.id, name: file.name, type: file.type || 'document' }],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              ical_uid: null,
              source_app: file.type || 'berkas',
              source_id: file.id
            };
            await dbPut(db, 'events', eventObj);
            await queueReminderForEvent(eventObj);
          }
        }
        await loadEventsAndRender();
      };
    };
  } catch (err) {
    console.warn('Gagal memindai berkas-db.', err);
  }
}

// Confirmation Dialog helper
function showConfirmDialog(message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
      resolve(confirm(message));
      return;
    }
    const msgEl = document.getElementById('confirm-message');
    if (msgEl) msgEl.textContent = message;
    
    modal._resolve = resolve;
    modal.showModal();
  });
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  // Check unlock
  if (window.TMPT_Auth) {
    await window.TMPT_Auth.init();
    if (!window.TMPT_Auth.isUnlocked()) {
      window.location.href = '/app/auth/login/?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
      return;
    }
  }

  await initDB();
  await loadCalendars();
  await syncDeadlines();

  // Watch event bus for updates from other tabs
  const broadcastChannel = listenTMPT(async (data) => {
    if (data.type === TMPT_EVENTS.DEADLINE_SET || data.type === TMPT_EVENTS.FILE_CREATED || data.type === TMPT_EVENTS.FILE_DELETED) {
      await syncDeadlines();
    }
  });

  // UI view selector bindings
  const viewButtons = {
    month: document.getElementById('btn-view-month'),
    week: document.getElementById('btn-view-week'),
    day: document.getElementById('btn-view-day'),
    agenda: document.getElementById('btn-view-agenda')
  };

  const setView = (viewName) => {
    currentView = viewName;
    Object.keys(viewButtons).forEach(key => {
      if (key === viewName) {
        viewButtons[key].className = 'primary';
      } else {
        viewButtons[key].className = 'outline secondary';
      }
    });
    renderCalendar();
  };

  Object.entries(viewButtons).forEach(([key, btn]) => {
    if (btn) btn.addEventListener('click', () => setView(key));
  });

  // Navigations bindings
  document.getElementById('btn-prev')?.addEventListener('click', () => {
    if (currentView === 'month') {
      currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (currentView === 'week') {
      currentDate.setDate(currentDate.getDate() - 7);
    } else if (currentView === 'day') {
      currentDate.setDate(currentDate.getDate() - 1);
    }
    renderCalendar();
  });

  document.getElementById('btn-today')?.addEventListener('click', () => {
    currentDate = new Date();
    renderCalendar();
  });

  document.getElementById('btn-next')?.addEventListener('click', () => {
    if (currentView === 'month') {
      currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (currentView === 'week') {
      currentDate.setDate(currentDate.getDate() + 7);
    } else if (currentView === 'day') {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    renderCalendar();
  });

  // New Event Modal Trigger
  document.getElementById('btn-new-event')?.addEventListener('click', () => {
    openEventEditor();
  });

  // Event Form Saving
  document.getElementById('event-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveEvent(e.target);
  });

  // Toggle all-day show/hide hours
  document.getElementById('event-all-day')?.addEventListener('change', (e) => {
    document.querySelectorAll('.time-field').forEach(el => {
      el.style.display = e.target.checked ? 'none' : 'block';
    });
  });

  // Adding document linking
  document.getElementById('btn-add-file-link')?.addEventListener('click', () => {
    const select = document.getElementById('event-link-doc-select');
    if (!select || !select.value) return;
    const file = JSON.parse(select.value);
    
    // Check if already added
    if (linkedFilesToEditor.some(f => f.id === file.id)) return;
    
    linkedFilesToEditor.push(file);
    renderLinkedFilesEditor();
  });

  // Impor/Ekspor triggers
  document.getElementById('btn-trigger-import')?.addEventListener('click', () => {
    document.getElementById('ics-import-modal').showModal();
  });

  document.getElementById('btn-trigger-export')?.addEventListener('click', () => {
    exportToICS();
  });

  // Impor submission
  document.getElementById('ics-import-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('ics-file');
    if (fileInput.files.length > 0) {
      await handleICSImport(fileInput.files[0]);
    }
  });

  // Helper to hide reminder panel if already allowed
  const updateReminderVisibility = () => {
    const section = document.getElementById('reminder-activation-section');
    if (section) {
      if (("Notification" in window) && Notification.permission === 'granted') {
        section.style.display = 'none';
      } else {
        section.style.display = 'block';
      }
    }
  };
  updateReminderVisibility();

  // Request notifications
  document.getElementById('btn-request-notif')?.addEventListener('click', async () => {
    if (!("Notification" in window)) {
      if (window.TMPT_UI) window.TMPT_UI.toast('Browser tidak mendukung notifikasi.', 'error');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      if (window.TMPT_UI) window.TMPT_UI.toast('Notifikasi berhasil diizinkan!', 'success');
      updateReminderVisibility();
    } else {
      if (window.TMPT_UI) window.TMPT_UI.toast('Izin notifikasi ditolak.', 'warning');
    }
  });

  // Start scans for reminders engine every 30 seconds
  setInterval(scanReminderQueue, 30000);
  scanReminderQueue(); // Run immediately

  // URL Deep-linking / opening specific day or event from other context
  const params = new URLSearchParams(window.location.search);
  const context = params.get('context');
  const eventId = params.get('event_id');
  const dayPrefill = params.get('date');

  if (context === 'event' && eventId) {
    setTimeout(() => viewEvent(eventId), 200);
  } else if (dayPrefill) {
    currentDate = new Date(dayPrefill);
    setView('day');
  } else {
    // Initial paint
    setView('month');
  }

  // Setup Sidebar Toggle Hamburger Menu
  const setupHamburgerToggle = () => {
    const hamburgerContainer = document.getElementById('header-hamburger-container');
    if (hamburgerContainer) {
      hamburgerContainer.style.display = 'inline-block';
    }
  };

  // Run setup when header swap is complete
  if (document.getElementById('header-sidebar-toggle')) {
    setupHamburgerToggle();
  } else {
    document.addEventListener('htmx:afterOnLoad', () => {
      setupHamburgerToggle();
    });
  }

  document.addEventListener('tmpt:sidebar-toggle', (e) => {
    e.preventDefault();
    const layout = document.querySelector('.calendar-layout');
    if (layout) {
      layout.classList.toggle('sidebar-collapsed');
    }
  });

  // Hook cleanup on window exit
  window.addEventListener('beforeunload', () => {
    broadcastChannel.close();
  });
});
