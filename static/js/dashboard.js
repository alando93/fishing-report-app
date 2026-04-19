// SoCal Fishing Dashboard

const PALETTE = [
    '#378ADD','#1D9E75','#D85A30','#BA7517','#9F2DCC',
    '#D4537E','#639922','#0F6E56','#A32D2D','#185FA5'
];

const TOP_N_SPECIES = 8;

let stackChart, trendChart;
let activeSpecies = new Set();
let activeDays = 30;
let allReports = [];

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', initializeDashboard);

async function initializeDashboard() {
    try {
        const data = await fetchFishingData();
        allReports = data.reports || [];

        const dateRange = getDateRange(allReports);
        document.getElementById('lastUpdated').textContent =
            `Data from ${dateRange} | Last updated: ${data.last_updated || 'Unknown'}`;

        // Seed the active species with the top 3 by total catch
        const topSp = getTopSpecies(allReports, TOP_N_SPECIES);
        activeSpecies = new Set(topSp.slice(0, 3));

        buildControls();
        initReportsTable(allReports);
        window.initBoatCalendar(allReports);
        update();
    } catch (err) {
        console.error('Dashboard error:', err);
        showErrorMessage('Failed to load dashboard data. Please try again later.');
    }
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchFishingData() {
    const response = await fetch('data/fishing_reports.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

// ---------------------------------------------------------------------------
// Controls (date range buttons + species chips)
// ---------------------------------------------------------------------------

function buildControls() {
    const chartSection = document.getElementById('chartSection');
    if (!chartSection) return;

    chartSection.insertAdjacentHTML('beforebegin', `
        <div class="ctrl-bar" style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:1rem;">
            <span style="font-size:13px;color:#666;">Date range:</span>
            ${[7,30,90,0].map(d => `
                <button class="seg-btn${activeDays === d ? ' active' : ''}"
                        data-days="${d}"
                        style="padding:5px 14px;font-size:12px;border:1px solid #ccc;
                               border-radius:6px;background:${activeDays === d ? '#f0f0f0' : 'transparent'};
                               cursor:pointer;">
                    ${d === 0 ? 'All' : d + 'd'}
                </button>`).join('')}
        </div>
    `);

    document.querySelectorAll('.seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeDays = parseInt(btn.dataset.days);
            document.querySelectorAll('.seg-btn').forEach(b => {
                b.style.background = 'transparent';
                b.classList.remove('active');
            });
            btn.style.background = '#f0f0f0';
            btn.classList.add('active');
            update();
        });
    });
}

// ---------------------------------------------------------------------------
// Main update — called whenever date range or species selection changes
// ---------------------------------------------------------------------------

function update() {
    const reports = filterByDateRange(allReports, activeDays);
    const topSp = getTopSpecies(reports, TOP_N_SPECIES);

    renderStackChart(reports, topSp);
    renderChips(topSp, reports);
    renderTrendChart(reports);
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

function filterByDateRange(reports, days) {
    if (days === 0) return reports;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return reports.filter(r => new Date(r.date) >= cutoff);
}

function getTopSpecies(reports, n) {
    const totals = {};
    reports.forEach(r => {
        totals[r.species] = (totals[r.species] || 0) + (r.count || 0);
    });
    return Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(e => e[0]);
}

// ---------------------------------------------------------------------------
// Stacked bar chart
// ---------------------------------------------------------------------------

function renderStackChart(reports, topSp) {
    const dateMap = buildDateMap(reports);
    const dates = Object.keys(dateMap).sort();
    const labels = dates.map(formatDateLabel);

    const datasets = topSp.map((sp, i) => ({
        label: sp,
        data: dates.map(d => dateMap[d][sp] || 0),
        backgroundColor: PALETTE[i % PALETTE.length] + 'cc',
        borderColor: PALETTE[i % PALETTE.length],
        borderWidth: 0,
        stack: 'a'
    }));

    renderLegend('stackLegend', topSp, PALETTE);

    const ctx = document.getElementById('activityChart').getContext('2d');
    if (stackChart) stackChart.destroy();

    stackChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { display: false },
                title: { display: false },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false },
                    ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 14, font: { size: 11 } }
                },
                y: {
                    stacked: true,
                    title: { display: true, text: 'Fish count', font: { size: 11 } },
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Species chips (for the trend chart)
// ---------------------------------------------------------------------------

function renderChips(topSp, reports) {
    let container = document.getElementById('spChips');
    if (!container) {
        const trendSection = document.createElement('div');
        trendSection.style.cssText = 'margin-top:2rem;';
        trendSection.innerHTML = `
            <h2 class="title is-4" style="margin-bottom:0.5rem;">
                <i class="fas fa-chart-line mr-2"></i>Species Trend
            </h2>
            <p style="font-size:13px;color:#888;margin-bottom:0.75rem;">
                Select species below to compare over time
            </p>
            <div id="spChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1rem;"></div>
            <div id="trendLegend" style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px;"></div>
            <div class="box dashboard-card">
                <div class="chart-container">
                    <canvas id="trendChart"></canvas>
                </div>
            </div>
        `;
        document.querySelector('.container').insertBefore(
            trendSection,
            document.querySelector('footer') || null
        );
        container = document.getElementById('spChips');
    }

    container.innerHTML = topSp.map(sp => `
        <button class="sp-chip${activeSpecies.has(sp) ? ' is-active' : ''}"
                data-sp="${sp}"
                style="padding:4px 12px;font-size:12px;border-radius:99px;cursor:pointer;
                       border:1px solid ${activeSpecies.has(sp) ? '#333' : '#ccc'};
                       background:${activeSpecies.has(sp) ? '#f0f0f0' : 'transparent'};
                       color:${activeSpecies.has(sp) ? '#111' : '#666'};">
            ${sp}
        </button>`).join('');

    container.querySelectorAll('.sp-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const sp = btn.dataset.sp;
            if (activeSpecies.has(sp)) {
                if (activeSpecies.size > 1) activeSpecies.delete(sp);
            } else {
                activeSpecies.add(sp);
            }
            renderChips(topSp, reports);
            renderTrendChart(reports);
        });
    });
}

// ---------------------------------------------------------------------------
// Trend line chart
// ---------------------------------------------------------------------------

function renderTrendChart(reports) {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    const dateMap = buildDateMap(reports);
    const dates = Object.keys(dateMap).sort();
    const labels = dates.map(formatDateLabel);
    const spList = [...activeSpecies];

    const datasets = spList.map((sp, i) => ({
        label: sp,
        data: dates.map(d => dateMap[d][sp] ?? null),
        borderColor: PALETTE[i % PALETTE.length],
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.3,
        spanGaps: false
    }));

    renderLegend('trendLegend', spList, PALETTE);

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 14, font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Fish count', font: { size: 11 } },
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Shared chart helpers
// ---------------------------------------------------------------------------

function buildDateMap(reports) {
    const map = {};
    reports.forEach(r => {
        if (!map[r.date]) map[r.date] = {};
        map[r.date][r.species] = (map[r.date][r.species] || 0) + (r.count || 0);
    });
    return map;
}

function formatDateLabel(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderLegend(containerId, species, palette) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = species.map((sp, i) => `
        <span style="display:flex;align-items:center;gap:5px;font-size:12px;color:#555;">
            <span style="width:10px;height:10px;border-radius:2px;background:${palette[i % palette.length]};flex-shrink:0;"></span>
            ${sp}
        </span>`).join('');
}

// ---------------------------------------------------------------------------
// Reports Table
// Renders a date-navigable, landing-grouped, species-filterable catch table.
// ---------------------------------------------------------------------------

// Module-level state for the reports table
let _rt = {
    allReports: [],
    currentDate: '',
    minDate: '',
    maxDate: '',
    selectedSpecies: new Set()
};

/**
 * Entry point. Called once from initializeDashboard with the full reports array.
 * Builds the table shell, wires up controls, and renders the latest date.
 */
function initReportsTable(reports) {
    _rt.allReports = reports;

    // Derive date bounds from the data
    const dates = [...new Set(reports.map(r => r.date))].filter(Boolean).sort();
    if (!dates.length) {
        document.getElementById('reportsSection').innerHTML =
            '<p class="has-text-grey">No report data available.</p>';
        return;
    }
    _rt.minDate = dates[0];
    _rt.maxDate = dates[dates.length - 1];
    _rt.currentDate = _rt.maxDate;

    // Inject the persistent shell (controls + card container)
    document.getElementById('reportsSection').innerHTML = `
        <div style="font-size:13px;">

            <!-- Top bar: title / source link on left, controls on right -->
            <div style="display:flex;align-items:flex-start;justify-content:space-between;
                        margin-bottom:14px;gap:12px;flex-wrap:wrap;">
                <div>
                    <div id="rt-title"
                         style="font-size:15px;font-weight:600;color:#363636;"></div>
                    <div id="rt-sub"
                         style="font-size:12px;color:#aaa;margin-top:2px;"></div>
                    <a id="rt-src" href="#" target="_blank" rel="noopener"
                       style="font-size:12px;color:#3273dc;text-decoration:none;
                              margin-top:4px;display:inline-block;">
                        sandiegofishreports.com &rarr;
                    </a>
                </div>

                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex-shrink:0;">

                    <!-- Prev / date-picker / Next -->
                    <div style="display:flex;align-items:center;border:1px solid #dbdbdb;
                                border-radius:6px;overflow:hidden;">
                        <button id="rt-prev"
                                style="padding:5px 9px;background:#fff;border:none;
                                       cursor:pointer;font-size:16px;line-height:1;color:#666;">
                            &#8249;
                        </button>
                        <input type="date" id="rt-date"
                               min="${_rt.minDate}" max="${_rt.maxDate}"
                               style="padding:5px 10px;font-size:12px;font-weight:500;
                                      color:#363636;background:#fff;border:none;
                                      border-left:1px solid #dbdbdb;
                                      border-right:1px solid #dbdbdb;
                                      cursor:pointer;outline:none;">
                        <button id="rt-next"
                                style="padding:5px 9px;background:#fff;border:none;
                                       cursor:pointer;font-size:16px;line-height:1;color:#666;">
                            &#8250;
                        </button>
                    </div>

                    <!-- Jump-to-latest button -->
                    <button id="rt-latest"
                            style="padding:5px 10px;border-radius:6px;border:1px solid #dbdbdb;
                                   background:#fff;cursor:pointer;font-size:12px;color:#666;">
                        Latest
                    </button>

                    <!-- Species filter dropdown -->
                    <div style="position:relative;">
                        <button id="rt-filter-btn"
                                style="display:flex;align-items:center;gap:6px;padding:5px 10px;
                                       border-radius:6px;border:1px solid #dbdbdb;background:#fff;
                                       cursor:pointer;font-size:12px;color:#666;white-space:nowrap;">
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                <path d="M1 3h11M3 6.5h7M5 10h3"
                                      stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                            </svg>
                            Filter species
                            <span id="rt-filter-badge"
                                  style="display:none;font-size:10px;font-weight:500;
                                         background:#ebf3fb;color:#3273dc;
                                         border-radius:99px;padding:1px 6px;"></span>
                        </button>

                        <div id="rt-dropdown"
                             style="display:none;position:absolute;right:0;top:calc(100% + 4px);
                                    z-index:200;background:#fff;border:1px solid #dbdbdb;
                                    border-radius:8px;min-width:210px;max-height:280px;
                                    overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,0.1);">
                            <div style="display:flex;justify-content:space-between;align-items:center;
                                        padding:8px 12px;border-bottom:1px solid #f0f0f0;
                                        font-size:11px;color:#aaa;position:sticky;top:0;background:#fff;">
                                <span>Species</span>
                                <span id="rt-clear"
                                      style="cursor:pointer;color:#3273dc;font-size:11px;">
                                    Clear all
                                </span>
                            </div>
                            <div id="rt-dd-list"></div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Card that holds the landing sections + tables -->
            <div id="rt-card"
                 style="border:1px solid #dbdbdb;border-radius:8px;
                        overflow:hidden;background:#fff;">
            </div>

        </div>
    `;

    // Wire up navigation
    document.getElementById('rt-prev').addEventListener('click', () => _rtShiftDay(-1));
    document.getElementById('rt-next').addEventListener('click', () => _rtShiftDay(1));
    document.getElementById('rt-latest').addEventListener('click', () => _rtChangeDate(_rt.maxDate));
    document.getElementById('rt-date').addEventListener('change', e => _rtChangeDate(e.target.value));

    // Wire up species filter
    document.getElementById('rt-filter-btn').addEventListener('click', e => {
        e.stopPropagation();
        const dd = document.getElementById('rt-dropdown');
        dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    });
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        const dd = document.getElementById('rt-dropdown');
        if (dd) dd.style.display = 'none';
    });
    document.getElementById('rt-dropdown').addEventListener('click', e => e.stopPropagation());
    document.getElementById('rt-clear').addEventListener('click', () => {
        _rt.selectedSpecies.clear();
        _rtUpdateFilter();
    });

    // Initial render
    _rtChangeDate(_rt.currentDate);
}

/**
 * Groups flat report rows for a given date into
 * { landing, boat, trip, anglers, catch[], sourceUrl } objects,
 * with catch sorted alphabetically by species name.
 */
function _rtGetTripsForDate(date) {
    const byKey = {};
    const keyOrder = []; // preserve insertion order for landing / boat / trip sequence

    _rt.allReports
        .filter(r => r.date === date)
        .forEach(r => {
            const key = `${r.landing || 'Unknown'}|||${r.boat || 'Unknown'}|||${r.trip || ''}`;
            if (!byKey[key]) {
                keyOrder.push(key);
                byKey[key] = {
                    landing:   r.landing   || 'Unknown',
                    boat:      r.boat      || 'Unknown',
                    trip:      r.trip      || '',
                    anglers:   parseInt(r.anglers) || 0,
                    catch:     {},
                    sourceUrl: r.source_url ||
                               `https://www.sandiegofishreports.com/dock_totals/boats.php?date=${date}`
                };
            }
            if (r.species && r.count) {
                byKey[key].catch[r.species] =
                    (byKey[key].catch[r.species] || 0) + r.count;
            }
        });

    return keyOrder.map(key => {
        const row = byKey[key];
        return {
            ...row,
            // Sort species alphabetically
            catch: Object.entries(row.catch)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([sp, cnt]) => ({ sp, cnt }))
        };
    });
}

/** Shift the selected date by n days (clamped to min/max). */
function _rtShiftDay(n) {
    const dt = new Date(_rt.currentDate + 'T12:00:00');
    dt.setDate(dt.getDate() + n);
    const next = dt.toISOString().slice(0, 10);
    if (next >= _rt.minDate && next <= _rt.maxDate) _rtChangeDate(next);
}

/**
 * Switch to a new date: resets species filter, updates all UI elements,
 * rebuilds the dropdown and table.
 */
function _rtChangeDate(date) {
    _rt.currentDate = date;
    _rt.selectedSpecies.clear();

    // Date input + navigation buttons
    const dateInput = document.getElementById('rt-date');
    const prevBtn   = document.getElementById('rt-prev');
    const nextBtn   = document.getElementById('rt-next');
    const latestBtn = document.getElementById('rt-latest');

    dateInput.value    = date;
    prevBtn.disabled   = date <= _rt.minDate;
    nextBtn.disabled   = date >= _rt.maxDate;

    // Highlight "Latest" button when on the most recent date
    const isLatest = date === _rt.maxDate;
    latestBtn.style.cssText = isLatest
        ? 'padding:5px 10px;border-radius:6px;border:1px solid #3273dc;background:#ebf3fb;cursor:pointer;font-size:12px;color:#3273dc;'
        : 'padding:5px 10px;border-radius:6px;border:1px solid #dbdbdb;background:#fff;cursor:pointer;font-size:12px;color:#666;';

    // Header text
    const trips = _rtGetTripsForDate(date);
    const totalFish  = trips.reduce((s, r) => s + r.catch.reduce((a, c) => a + c.cnt, 0), 0);
    const totalTrips = trips.length;
    const dt = new Date(date + 'T12:00:00');
    const fmtDate = dt.toLocaleDateString('en-US',
        { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    document.getElementById('rt-title').textContent =
        isLatest ? 'Counts for today' : `Counts for ${fmtDate}`;
    document.getElementById('rt-sub').textContent = trips.length
        ? `${fmtDate} \u2014 ${totalTrips} trip${totalTrips !== 1 ? 's' : ''} \u00B7 ${totalFish.toLocaleString()} fish`
        : `${fmtDate} \u2014 no data scraped for this date`;
    document.getElementById('rt-src').href =
        `https://www.sandiegofishreports.com/dock_totals/boats.php?date=${date}`;

    _rtBuildDropdown(trips);
    _rtBuildTable(trips);
    _rtUpdateFilter();
}

/** Rebuild the species dropdown for the current date's trips. */
function _rtBuildDropdown(trips) {
    const species = [...new Set(trips.flatMap(r => r.catch.map(c => c.sp)))].sort();
    const list = document.getElementById('rt-dd-list');
    list.innerHTML = species.map(sp => {
        const total = trips.reduce(
            (s, r) => s + (r.catch.find(c => c.sp === sp)?.cnt || 0), 0);
        const safeId = 'rtchk-' + sp.replace(/[^a-z0-9]/gi, '_');
        return `
            <div class="rt-dd-item" data-sp="${sp}"
                 style="display:flex;align-items:center;gap:8px;padding:7px 12px;
                        cursor:pointer;font-size:13px;color:#363636;
                        border-bottom:1px solid #f5f5f5;">
                <div class="rt-check" id="${safeId}"
                     style="width:14px;height:14px;border-radius:3px;flex-shrink:0;
                            border:1px solid #dbdbdb;background:#fff;
                            display:flex;align-items:center;justify-content:center;"></div>
                <span>${sp}</span>
                <span style="font-size:11px;color:#aaa;margin-left:auto;">${total.toLocaleString()}</span>
            </div>`;
    }).join('');

    list.querySelectorAll('.rt-dd-item').forEach(el => {
        el.addEventListener('click', () => {
            const sp = el.dataset.sp;
            _rt.selectedSpecies.has(sp)
                ? _rt.selectedSpecies.delete(sp)
                : _rt.selectedSpecies.add(sp);
            _rtUpdateFilter();
        });
    });
}

/** Rebuild the landing-grouped table for the given trips. */
function _rtBuildTable(trips) {
    const card = document.getElementById('rt-card');

    if (!trips.length) {
        card.innerHTML = `
            <div style="padding:48px 20px;text-align:center;color:#aaa;font-size:13px;">
                No catch data available for this date.<br>
                The scraper may not have run yet, or there were no reported trips.
            </div>`;
        return;
    }

    // Group trips by landing, preserving order of first appearance
    const landingOrder = [];
    const byLanding = {};
    trips.forEach(r => {
        if (!byLanding[r.landing]) {
            landingOrder.push(r.landing);
            byLanding[r.landing] = [];
        }
        byLanding[r.landing].push(r);
    });

    card.innerHTML = landingOrder.map((landing, li) => {
        const lrows = byLanding[landing];
        const uniqueBoatCount = new Set(lrows.map(r => r.boat)).size;
        let prevBoat = null;

        const tableRows = lrows.map(r => {
            // A boat with multiple trips in a day gets a left-border accent
            const isMultiTrip = lrows.filter(x => x.boat === r.boat).length > 1;
            prevBoat = r.boat;

            const pills = r.catch.map(c => {
                const avgStr = r.anglers > 0
                    ? (c.cnt / r.anglers).toFixed(1) + '/ang'
                    : '\u2014';
                return `
                    <span class="rt-pill" data-sp="${c.sp}"
                          style="display:inline-flex;align-items:baseline;gap:4px;
                                 padding:2px 8px 2px 6px;border-radius:99px;font-size:11px;
                                 border:1px solid #e8e8e8;background:#f5f5f5;margin:2px;">
                        <span style="font-weight:600;color:#363636;font-size:12px;">${c.cnt}</span>
                        <span style="color:#666;">${c.sp}</span>
                        <span style="color:#aaa;font-size:10px;margin-left:2px;">${avgStr}</span>
                    </span>`;
            }).join('');

            const firstCellExtra = isMultiTrip
                ? 'border-left:2px solid #dbdbdb;padding-left:10px;'
                : '';

            return `
                <tr class="rt-trip-row">
                    <td style="padding:8px 12px;border-bottom:1px solid #f5f5f5;
                               vertical-align:top;width:22%;${firstCellExtra}">
                        <div style="font-weight:600;font-size:13px;color:#363636;">${r.boat}</div>
                        <div style="font-size:11px;color:#888;margin-top:2px;">${r.trip}</div>
                    </td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f5f5f5;
                               vertical-align:top;width:8%;font-size:13px;color:#888;">
                        ${r.anglers || '\u2014'}
                    </td>
                    <td style="padding:8px 12px;border-bottom:1px solid #f5f5f5;vertical-align:top;">
                        <div style="display:flex;flex-wrap:wrap;">${pills}</div>
                    </td>
                </tr>`;
        }).join('');

        const topBorder = li > 0 ? 'border-top:1px solid #e8e8e8;' : '';

        return `
            <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;
                        background:#fafafa;border-bottom:1px solid #efefef;${topBorder}">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                     style="opacity:0.35;flex-shrink:0;">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/>
                    <path d="M3 8 Q6 4 9 8" stroke="currentColor" stroke-width="1.2" fill="none"/>
                </svg>
                <span style="font-size:12px;font-weight:600;color:#363636;">${landing}</span>
                <span style="font-size:11px;color:#aaa;">
                    ${uniqueBoatCount} boat${uniqueBoatCount !== 1 ? 's' : ''}
                </span>
            </div>
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                <colgroup>
                    <col style="width:22%;">
                    <col style="width:8%;">
                    <col>
                </colgroup>
                <thead>
                    <tr>
                        <th style="font-size:11px;font-weight:500;color:#aaa;text-transform:uppercase;
                                   letter-spacing:0.04em;padding:6px 12px;text-align:left;
                                   border-bottom:1px solid #f5f5f5;background:#fff;">
                            Boat / Trip
                        </th>
                        <th style="font-size:11px;font-weight:500;color:#aaa;text-transform:uppercase;
                                   letter-spacing:0.04em;padding:6px 12px;text-align:left;
                                   border-bottom:1px solid #f5f5f5;background:#fff;">
                            Anglers
                        </th>
                        <th style="font-size:11px;font-weight:500;color:#aaa;text-transform:uppercase;
                                   letter-spacing:0.04em;padding:6px 12px;text-align:left;
                                   border-bottom:1px solid #f5f5f5;background:#fff;">
                            Catch &nbsp;<span style="font-weight:400;text-transform:none;
                                               letter-spacing:0;font-size:10px;">
                                count &middot; avg per angler
                            </span>
                        </th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>`;
    }).join('');
}

/**
 * Apply / remove the species filter without rebuilding the DOM.
 * Updates checkbox states, pill visibility, and hides rows with no visible catch.
 */
function _rtUpdateFilter() {
    const active = _rt.selectedSpecies;

    // Badge
    const badge = document.getElementById('rt-filter-badge');
    if (badge) {
        badge.textContent = active.size;
        badge.style.display = active.size ? 'inline' : 'none';
    }

    // Checkboxes
    document.querySelectorAll('.rt-dd-item').forEach(item => {
        const sp  = item.dataset.sp;
        const chk = item.querySelector('.rt-check');
        if (!chk) return;
        const on = active.has(sp);
        chk.style.cssText = on
            ? 'width:14px;height:14px;border-radius:3px;flex-shrink:0;border:1px solid #3273dc;background:#ebf3fb;display:flex;align-items:center;justify-content:center;'
            : 'width:14px;height:14px;border-radius:3px;flex-shrink:0;border:1px solid #dbdbdb;background:#fff;display:flex;align-items:center;justify-content:center;';
        chk.innerHTML = on
            ? '<svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3L3 5L7 1" stroke="#3273dc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : '';
    });

    // Pills: hide those not in the active set
    document.querySelectorAll('.rt-pill').forEach(pill => {
        const show = active.size === 0 || active.has(pill.dataset.sp);
        pill.style.display = show ? 'inline-flex' : 'none';
    });

    // Rows: hide rows whose every pill is hidden
    document.querySelectorAll('.rt-trip-row').forEach(row => {
        const hasVisible = [...row.querySelectorAll('.rt-pill')]
            .some(p => p.style.display !== 'none');
        row.style.display = (active.size > 0 && !hasVisible) ? 'none' : '';
    });
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function getDateRange(reports) {
    if (!reports || reports.length === 0) return 'No data';
    const dates = reports.map(r => new Date(r.date)).filter(d => !isNaN(d));
    if (!dates.length) return 'No valid dates';
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt(min)} to ${fmt(max)}`;
}

function showErrorMessage(message) {
    const container = document.querySelector('.container');
    const div = document.createElement('div');
    div.className = 'notification is-danger';
    div.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i>${message}`;
    container.insertBefore(div, container.firstChild);
    setTimeout(() => div.remove(), 10000);
}
