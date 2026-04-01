// Boat Activity Calendar
// Drop this file into static/js/ and add <script src="static/js/boatCalendar.js"></script>
// after dashboard.js in index.html.
//
// Also add this HTML block to index.html wherever you want the calendar to appear:
//
// <div class="columns mt-4">
//   <div class="column is-12">
//     <h2 class="title is-4">
//       <i class="fas fa-calendar-alt mr-2"></i>Boat Activity Calendar
//     </h2>
//     <div class="box" id="boatCalendarRoot"></div>
//   </div>
// </div>

(function () {

  const COLOR_SCALE = ['#E6F1FB','#B5D4F4','#85B7EB','#378ADD','#185FA5','#042C53'];
  const DOW_LABELS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  let tooltip = null;

  // ------------------------------------------------------------------
  // Entry point — called once reports JSON is loaded
  // ------------------------------------------------------------------
  function initBoatCalendar(reports) {
    const root = document.getElementById('boatCalendarRoot');
    if (!root) return;

    const byDate = buildByDate(reports);
    const allCounts = Object.values(byDate).map(b => b.length);
    const maxBoats = Math.max(...allCounts, 1);

    root.innerHTML = `
      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;">
        <div>
          <div id="bcDowRow" style="display:flex;gap:3px;margin-bottom:3px;"></div>
          <div style="overflow-x:auto;padding-bottom:8px;">
            <div id="bcGrid"></div>
          </div>
          <div id="bcLegend" style="display:flex;align-items:center;gap:6px;margin-top:10px;"></div>
        </div>
        <div style="flex:1;min-width:220px;">
          <div id="bcPanel" style="
            background:var(--color-background-secondary);
            border-radius:var(--border-radius-lg);
            border:0.5px solid var(--color-border-tertiary);
            padding:14px 16px;
            min-height:120px;
          ">
            <div style="font-size:12px;color:var(--color-text-tertiary);">
              Click any day to pin its boats here. Hover to preview.
            </div>
          </div>
        </div>
      </div>
    `;

    renderDowRow();
    renderLegend();
    renderGrid(byDate, maxBoats);
    attachTooltipListener();
  }

  // ------------------------------------------------------------------
  // Build a { "YYYY-MM-DD": [boatObj, ...] } map from flat reports
  // ------------------------------------------------------------------
  function buildByDate(reports) {
    const map = {};
    reports.forEach(r => {
      if (!r.date || !r.boat) return;
      if (!map[r.date]) map[r.date] = {};

      const key = r.boat;
      if (!map[r.date][key]) {
        const sourceUrl = r.source_url ||
          `https://www.sandiegofishreports.com/dock_totals/boats.php?date=${r.date}`;
        map[r.date][key] = {
          name:      r.boat,
          landing:   r.landing || r.location || 'Unknown',
          trip:      r.trip    || 'Unknown',
          anglers:   r.anglers || '—',
          catches:   [],
          sourceUrl
        };
      }
      if (r.species && r.count) {
        map[r.date][key].catches.push(`${r.count} ${r.species}`);
      }
    });

    // Convert inner objects → arrays
    const result = {};
    Object.entries(map).forEach(([date, boatsObj]) => {
      result[date] = Object.values(boatsObj);
    });
    return result;
  }

  // ------------------------------------------------------------------
  // Day-of-week header
  // ------------------------------------------------------------------
  function renderDowRow() {
    document.getElementById('bcDowRow').innerHTML = DOW_LABELS.map(d =>
      `<div style="width:28px;text-align:center;font-size:10px;color:var(--color-text-tertiary);">${d}</div>`
    ).join('');
  }

  // ------------------------------------------------------------------
  // Color legend
  // ------------------------------------------------------------------
  function renderLegend() {
    document.getElementById('bcLegend').innerHTML =
      `<span style="font-size:11px;color:var(--color-text-tertiary);">fewer</span>` +
      COLOR_SCALE.map(c =>
        `<div style="width:14px;height:14px;border-radius:3px;background:${c};border:0.5px solid rgba(0,0,0,0.08);"></div>`
      ).join('') +
      `<span style="font-size:11px;color:var(--color-text-tertiary);">more boats</span>`;
  }

  // ------------------------------------------------------------------
  // Calendar grid — one block per month in the data's date range
  // ------------------------------------------------------------------
  function renderGrid(byDate, maxBoats) {
    const grid = document.getElementById('bcGrid');
    grid.innerHTML = '';

    const dates = Object.keys(byDate).sort();
    if (!dates.length) {
      grid.innerHTML = '<p style="color:var(--color-text-tertiary);font-size:13px;">No data available.</p>';
      return;
    }

    const start = new Date(dates[0] + 'T12:00:00');
    const end   = new Date(dates[dates.length - 1] + 'T12:00:00');

    // Enumerate months in range
    const months = [];
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= endMonth) {
      months.push({ y: cur.getFullYear(), m: cur.getMonth() });
      cur.setMonth(cur.getMonth() + 1);
    }

    months.forEach(({ y, m }) => {
      const monthLabel = document.createElement('div');
      monthLabel.style.cssText = 'font-size:11px;font-weight:500;color:var(--color-text-secondary);margin-bottom:4px;';
      monthLabel.textContent = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      grid.appendChild(monthLabel);

      const monthGrid = document.createElement('div');
      monthGrid.style.cssText = 'display:inline-grid;grid-template-columns:repeat(7,28px);gap:3px;margin-bottom:10px;';

      const firstDow = new Date(y, m, 1).getDay();
      for (let e = 0; e < firstDow; e++) {
        monthGrid.appendChild(emptyCell());
      }

      const daysInMonth = new Date(y, m + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const boats   = byDate[dateStr] || [];
        monthGrid.appendChild(dayCell(dateStr, day, boats, maxBoats));
      }

      grid.appendChild(monthGrid);
    });
  }

  function emptyCell() {
    const el = document.createElement('div');
    el.style.cssText = 'width:28px;height:28px;';
    return el;
  }

  function dayCell(dateStr, day, boats, maxBoats) {
    const el = document.createElement('div');
    el.style.cssText = `
      width:28px;height:28px;border-radius:4px;
      display:flex;align-items:center;justify-content:center;
      font-size:10px;position:relative;cursor:${boats.length ? 'pointer' : 'default'};
      border:0.5px solid var(--color-border-tertiary);
      transition:border-color 0.1s;
    `;
    el.textContent = day;

    if (boats.length > 0) {
      const bg = boatColor(boats.length, maxBoats);
      const darkBg = boats.length >= Math.ceil(maxBoats * 0.6);
      el.style.background   = bg;
      el.style.borderColor  = 'transparent';
      el.style.color        = darkBg ? '#fff' : 'var(--color-text-secondary)';

      el.addEventListener('mouseenter', e => showTooltip(e, dateStr, boats));
      el.addEventListener('mouseleave', hideTooltip);
      el.addEventListener('click', () => showPanel(dateStr, boats));
    } else {
      el.style.color = 'var(--color-text-tertiary)';
    }

    return el;
  }

  function boatColor(count, max) {
    const idx = Math.min(
      Math.floor((count / max) * (COLOR_SCALE.length - 1)),
      COLOR_SCALE.length - 1
    );
    return COLOR_SCALE[idx];
  }

  // ------------------------------------------------------------------
  // Hover tooltip
  // ------------------------------------------------------------------
  function showTooltip(e, dateStr, boats) {
    hideTooltip();
    const dt      = new Date(dateStr + 'T12:00:00');
    const fmtDate = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const preview = boats.slice(0, 4);
    const more    = boats.length - 4;

    tooltip = document.createElement('div');
    tooltip.style.cssText = `
      position:absolute;z-index:9999;pointer-events:none;
      background:var(--color-background-primary);
      border:0.5px solid var(--color-border-secondary);
      border-radius:var(--border-radius-lg);
      padding:12px 14px;min-width:220px;max-width:300px;
    `;
    tooltip.innerHTML = `
      <div style="font-size:12px;font-weight:500;color:var(--color-text-primary);margin-bottom:6px;">${fmtDate}</div>
      <div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:8px;">
        ${boats.length} boat${boats.length !== 1 ? 's' : ''} active
      </div>
      <hr style="border:none;border-top:0.5px solid var(--color-border-tertiary);margin:0 0 8px;">
      ${preview.map(b => `
        <div style="padding:5px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
          <div style="font-size:12px;font-weight:500;color:var(--color-text-primary);">${b.name}</div>
          <div style="font-size:11px;color:var(--color-text-secondary);margin-top:2px;">
            ${b.trip} &middot; ${b.anglers} anglers &middot; ${b.landing}
          </div>
          ${b.catches.length ? `<div style="font-size:11px;color:var(--color-text-secondary);margin-top:2px;">${b.catches.slice(0,3).join(', ')}${b.catches.length > 3 ? '…' : ''}</div>` : ''}
        </div>`).join('')}
      ${more > 0 ? `<div style="font-size:11px;color:var(--color-text-tertiary);margin-top:6px;">+${more} more. Click to see all.</div>` : ''}
    `;
    document.body.appendChild(tooltip);
    positionTooltip(e);
  }

  function positionTooltip(e) {
    if (!tooltip) return;
    const margin = 12;
    const tw = tooltip.offsetWidth  || 260;
    const th = tooltip.offsetHeight || 180;
    let x = e.clientX + margin + window.scrollX;
    let y = e.clientY + margin + window.scrollY;
    if (x + tw > window.innerWidth  + window.scrollX - margin) x = e.clientX - tw - margin + window.scrollX;
    if (y + th > window.innerHeight + window.scrollY - margin) y = e.clientY - th - margin + window.scrollY;
    tooltip.style.left = x + 'px';
    tooltip.style.top  = y + 'px';
  }

  function hideTooltip() {
    if (tooltip) { tooltip.remove(); tooltip = null; }
  }

  function attachTooltipListener() {
    document.addEventListener('mousemove', e => { if (tooltip) positionTooltip(e); });
  }

  // ------------------------------------------------------------------
  // Click → pin panel
  // ------------------------------------------------------------------
  function showPanel(dateStr, boats) {
    const panel = document.getElementById('bcPanel');
    if (!panel) return;
    const dt      = new Date(dateStr + 'T12:00:00');
    const fmtDate = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const sourceUrl = boats[0]?.sourceUrl ||
      `https://www.sandiegofishreports.com/dock_totals/boats.php?date=${dateStr}`;

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;">
        <div style="font-size:13px;font-weight:500;color:var(--color-text-primary);">
          ${fmtDate} &mdash; ${boats.length} boat${boats.length !== 1 ? 's' : ''}
        </div>
        <a href="${sourceUrl}" target="_blank" rel="noopener"
           style="font-size:11px;color:var(--color-text-info);white-space:nowrap;margin-left:12px;">
          View source &rarr;
        </a>
      </div>
      <div style="max-height:360px;overflow-y:auto;">
        ${boats.map(b => `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:6px 0;border-bottom:0.5px solid var(--color-border-tertiary);">
            <div>
              <div style="font-size:12px;font-weight:500;color:var(--color-text-primary);">${b.name}</div>
              <div style="font-size:11px;color:var(--color-text-secondary);margin-top:2px;">${b.landing} &middot; ${b.anglers} anglers</div>
              ${b.catches.length ? `<div style="font-size:11px;color:var(--color-text-secondary);margin-top:2px;">${b.catches.join(', ')}</div>` : ''}
            </div>
            <span style="font-size:11px;padding:2px 8px;border-radius:99px;background:var(--color-background-info);color:var(--color-text-info);white-space:nowrap;margin-left:8px;">
              ${b.trip}
            </span>
          </div>`).join('')}
      </div>
    `;
  }

  // ------------------------------------------------------------------
  // Hook into the existing dashboard data load
  // ------------------------------------------------------------------
  // The existing dashboard.js calls fetchFishingData() and stores reports.
  // We patch in after DOMContentLoaded by waiting for window.fishingReports
  // to be set, OR you can call window.initBoatCalendar(reports) directly
  // from dashboard.js after you load the data.

  window.initBoatCalendar = initBoatCalendar;

})();