// app/tools/pomodoro/js/stats.js

import { getAllSessions, getSessionsByDate } from './sessions.js';
import { getCurrentStreak } from './goals.js';

export async function calculateStatsSummary(period = 'weekly') {
  const sessions = await getAllSessions();
  const completedWork = sessions.filter(s => s.type === 'work' && s.status === 'completed');
  
  // Calculate total completed pomodoros
  const totalCompleted = completedWork.length;
  
  // Calculate total focus minutes
  const totalFocusMin = completedWork.reduce((sum, s) => sum + s.actual_min, 0);

  // Group by date to check how many sessions are abandoned
  const abandonedWork = sessions.filter(s => s.type === 'work' && s.status === 'abandoned');
  
  // Calculate total interruptions
  const totalInterruptions = completedWork.reduce((sum, s) => sum + s.interruptions, 0);

  // Focus Score heuristic:
  // start at 100, subtract 5 per interruption, subtract 10 per abandoned session
  let focusScoreSum = 0;
  completedWork.forEach(s => {
    let score = 100 - (s.interruptions * 5);
    // Find abandoned sessions on the same day
    const dayAbandoned = abandonedWork.filter(ab => ab.date === s.date).length;
    score -= (dayAbandoned * 10);
    focusScoreSum += Math.max(0, Math.min(100, score));
  });

  const avgFocusScore = totalCompleted > 0 ? Math.round(focusScoreSum / totalCompleted) : 100;

  return {
    total_completed: totalCompleted,
    total_focus_min: totalFocusMin,
    total_interruptions: totalInterruptions,
    avg_focus_score: avgFocusScore
  };
}

export function renderWeeklyChart(weeklyData) {
  if (!weeklyData || weeklyData.length === 0) {
    return `<div style="text-align: center; padding: 2rem; color: var(--pico-muted-color);">Belum ada data untuk ditampilkan.</div>`;
  }

  const maxVal = Math.max(...weeklyData.map(d => d.value), 4); // Min ceiling of 4 for better visual scale
  const chartHeight = 140;
  const paddingBottom = 30;
  const paddingTop = 10;
  const totalHeight = chartHeight + paddingBottom + paddingTop;
  
  const barWidth = 32;
  const gap = 16;
  const svgWidth = weeklyData.length * (barWidth + gap) + gap;

  const elements = [];

  // Draw grid lines
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = paddingTop + (chartHeight / gridLines) * i;
    elements.push(`
      <line x1="0" y1="${y}" x2="${svgWidth}" y2="${y}" class="grid-line" stroke="var(--pico-muted-border-color)" stroke-width="0.5" stroke-dasharray="3 3" />
    `);
  }

  weeklyData.forEach((day, idx) => {
    const x = gap + idx * (barWidth + gap);
    const pct = day.value / maxVal;
    const barHeight = chartHeight * pct;
    const y = paddingTop + (chartHeight - barHeight);
    
    const isToday = day.dateStr === new Date().toISOString().slice(0, 10);
    const fill = isToday ? 'var(--accent)' : 'var(--bar-color)';

    elements.push(`
      <g>
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${fill}" rx="4" class="bar" />
        <text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="var(--pico-color)" font-weight="600">${day.value > 0 ? day.value : ''}</text>
        <text x="${x + barWidth / 2}" y="${totalHeight - 8}" text-anchor="middle" class="day-label" font-size="10" font-weight="500">${day.label}</text>
      </g>
    `);
  });

  return `
    <svg viewBox="0 0 ${svgWidth} ${totalHeight}" width="100%" height="100%">
      ${elements.join('')}
    </svg>
  `;
}

export async function getWeeklyStatsData() {
  const today = new Date();
  const data = [];
  const daysName = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    
    // Read from DB
    const sessions = await getSessionsByDate(dateStr);
    const completedCount = sessions.filter(s => s.type === 'work' && s.status === 'completed').length;
    
    data.push({
      dateStr,
      label: daysName[d.getDay()],
      value: completedCount
    });
  }

  return data;
}

export async function getMonthlyStatsData() {
  // Let's build last 30 days
  const today = new Date();
  const data = [];
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    
    const sessions = await getSessionsByDate(dateStr);
    const completedCount = sessions.filter(s => s.type === 'work' && s.status === 'completed').length;
    
    data.push({
      dateStr,
      label: d.getDate(),
      value: completedCount
    });
  }

  return data;
}
