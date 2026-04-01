// SoCal Fishing Dashboard — improved charts

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
        renderReportsTable(allReports);
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
    // Inject control markup above the charts if it doesn't exist yet
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
        // Create the chip container + trend chart section on first run
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
// Shared helpers
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
// Reports table (unchanged logic, kept for completeness)
// ---------------------------------------------------------------------------

function renderReportsTable(reports) {
    const tableBody = document.getElementById('reportsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = '';

    const sorted = [...reports].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50);

    if (sorted.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="has-text-centered">No reports available</td></tr>';
        return;
    }

    sorted.forEach(report => {
        const row = document.createElement('tr');
        const date = new Date(report.date + 'T12:00:00');
        row.innerHTML = `
            <td>${date.toLocaleDateString()}</td>
            <td>${report.location || 'Unknown'}</td>
            <td>${report.boat || 'Unknown'}</td>
            <td>${report.species || 'Unknown'}</td>
            <td>${report.count || 0}</td>
            <td>${report.source || 'Unknown'}</td>
        `;
        tableBody.appendChild(row);
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