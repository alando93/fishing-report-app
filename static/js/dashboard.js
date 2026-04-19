// SoCal Fishing Dashboard — Daily Reports view.

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

        initReportsTable(allReports);
        if (typeof initTrendsSection === 'function') {
            initTrendsSection(allReports);
        }
    } catch (err) {
        console.error('Dashboard error:', err);
        showErrorMessage('Failed to load dashboard data. Please try again later.');
    }
}

async function fetchFishingData() {
    const response = await fetch('data/fishing_reports.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

// ---------------------------------------------------------------------------
// Reports Table — date-navigable, landing-grouped, species-filterable.
// ---------------------------------------------------------------------------

let _rt = {
    allReports: [],
    currentDate: '',
    minDate: '',
    maxDate: '',
    speciesFilter: null // UI.makeMultiSelect handle
};

function initReportsTable(reports) {
    _rt.allReports = reports;

    const dates = [...new Set(reports.map(r => r.date))].filter(Boolean).sort();
    if (!dates.length) {
        document.getElementById('reportsSection').innerHTML =
            '<p class="has-text-grey">No report data available.</p>';
        return;
    }
    _rt.minDate = dates[0];
    _rt.maxDate = dates[dates.length - 1];
    _rt.currentDate = _rt.maxDate;

    document.getElementById('reportsSection').innerHTML = `
        <div class="app-section">
            <div class="section-toolbar">
                <div>
                    <div id="rt-title"    class="toolbar-title"></div>
                    <div id="rt-sub"      class="toolbar-sub"></div>
                    <a   id="rt-src" href="#" target="_blank" rel="noopener"
                         class="toolbar-link">sandiegofishreports.com &rarr;</a>
                </div>

                <div class="toolbar-controls">
                    <div class="date-group">
                        <button id="rt-prev" aria-label="Previous day">&#8249;</button>
                        <input type="date" id="rt-date"
                               min="${_rt.minDate}" max="${_rt.maxDate}">
                        <button id="rt-next" aria-label="Next day">&#8250;</button>
                    </div>
                    <button id="rt-latest" class="btn">Latest</button>
                    <div id="rt-species-filter"></div>
                </div>
            </div>

            <div id="rt-card" class="rt-card"></div>
        </div>
    `;

    // Navigation
    document.getElementById('rt-prev').addEventListener('click', () => _rtShiftDay(-1));
    document.getElementById('rt-next').addEventListener('click', () => _rtShiftDay(1));
    document.getElementById('rt-latest').addEventListener('click', () => _rtChangeDate(_rt.maxDate));
    document.getElementById('rt-date').addEventListener('change', e => _rtChangeDate(e.target.value));

    // Species filter (shared UI helper)
    _rt.speciesFilter = UI.makeMultiSelect({
        container: document.getElementById('rt-species-filter'),
        label: 'Filter species',
        items: [],
        onChange: () => _rtApplyFilter()
    });

    _rtChangeDate(_rt.currentDate);
}

function _rtGetTripsForDate(date) {
    const byKey = {};
    const keyOrder = [];

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
                byKey[key].catch[r.species] = (byKey[key].catch[r.species] || 0) + r.count;
            }
        });

    return keyOrder.map(key => {
        const row = byKey[key];
        return {
            ...row,
            catch: Object.entries(row.catch)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([sp, cnt]) => ({ sp, cnt }))
        };
    });
}

function _rtShiftDay(n) {
    const dt = new Date(_rt.currentDate + 'T12:00:00Z');
    const nextDt = new Date(dt.getTime() + n * 86400000);
    const next = nextDt.toISOString().slice(0, 10);
    if (next >= _rt.minDate && next <= _rt.maxDate) _rtChangeDate(next);
}

function _rtChangeDate(date) {
    _rt.currentDate = date;

    const dateInput = document.getElementById('rt-date');
    const prevBtn   = document.getElementById('rt-prev');
    const nextBtn   = document.getElementById('rt-next');
    const latestBtn = document.getElementById('rt-latest');

    dateInput.value  = date;
    prevBtn.disabled = date <= _rt.minDate;
    nextBtn.disabled = date >= _rt.maxDate;

    const isLatest = date === _rt.maxDate;
    latestBtn.classList.toggle('btn--active', isLatest);

    // Header
    const trips = _rtGetTripsForDate(date);
    const totalFish  = trips.reduce((s, r) => s + r.catch.reduce((a, c) => a + c.cnt, 0), 0);
    const totalTrips = trips.length;
    const dt = new Date(date + 'T12:00:00Z');
    const fmtDate = dt.toLocaleDateString('en-US',
        { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    const moon = (typeof moonPhase === 'function') ? moonPhase(date) : null;
    const moonHtml = moon
        ? ` \u00B7 <span class="rt-moon" title="${moon.illumination}% illuminated">${moon.emoji} ${moon.name} (${moon.illumination}%)</span>`
        : '';

    document.getElementById('rt-title').textContent =
        isLatest ? 'Counts for today' : `Counts for ${fmtDate}`;

    const subEl = document.getElementById('rt-sub');
    if (trips.length) {
        subEl.innerHTML = `${fmtDate} \u2014 ${totalTrips} trip${totalTrips !== 1 ? 's' : ''} \u00B7 ${totalFish.toLocaleString()} fish${moonHtml}`;
    } else {
        subEl.innerHTML = `${fmtDate} \u2014 no data scraped for this date${moonHtml}`;
    }
    document.getElementById('rt-src').href =
        `https://www.sandiegofishreports.com/dock_totals/boats.php?date=${date}`;

    // Refresh species filter items for the new date
    const speciesList = [...new Set(trips.flatMap(r => r.catch.map(c => c.sp)))].sort();
    const speciesItems = speciesList.map(sp => {
        const total = trips.reduce(
            (s, r) => s + (r.catch.find(c => c.sp === sp)?.cnt || 0), 0);
        return { value: sp, label: sp, meta: total.toLocaleString() };
    });
    _rt.speciesFilter.clear();
    _rt.speciesFilter.setItems(speciesItems);

    _rtBuildTable(trips);
    _rtApplyFilter();
}

function _rtBuildTable(trips) {
    const card = document.getElementById('rt-card');

    if (!trips.length) {
        card.innerHTML = `
            <div class="rt-empty">
                No catch data available for this date.<br>
                The scraper may not have run yet, or there were no reported trips.
            </div>`;
        return;
    }

    const landingOrder = [];
    const byLanding = {};
    trips.forEach(r => {
        if (!byLanding[r.landing]) {
            landingOrder.push(r.landing);
            byLanding[r.landing] = [];
        }
        byLanding[r.landing].push(r);
    });

    card.innerHTML = landingOrder.map(landing => {
        const lrows = byLanding[landing];
        const uniqueBoatCount = new Set(lrows.map(r => r.boat)).size;

        const tableRows = lrows.map(r => {
            const isMultiTrip = lrows.filter(x => x.boat === r.boat).length > 1;
            const pills = r.catch.map(c => {
                const avgStr = r.anglers > 0
                    ? (c.cnt / r.anglers).toFixed(1) + '/ang'
                    : '\u2014';
                return `
                    <span class="rt-pill" data-sp="${c.sp}">
                        <span class="rt-pill-count">${c.cnt}</span>
                        <span class="rt-pill-species">${c.sp}</span>
                        <span class="rt-pill-avg">${avgStr}</span>
                    </span>`;
            }).join('');

            return `
                <tr class="rt-trip-row${isMultiTrip ? ' rt-multi-trip' : ''}">
                    <td class="rt-col-boat">
                        <div class="rt-boat-name">${r.boat}</div>
                        <div class="rt-boat-trip">${r.trip}</div>
                    </td>
                    <td class="rt-col-anglers">${r.anglers || '\u2014'}</td>
                    <td class="rt-col-catch">
                        <div class="rt-catch-list">${pills}</div>
                    </td>
                </tr>`;
        }).join('');

        return `
            <div class="rt-landing-block">
                <div class="rt-landing-header">
                    <svg class="rt-landing-icon" width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/>
                        <path d="M3 8 Q6 4 9 8" stroke="currentColor" stroke-width="1.2" fill="none"/>
                    </svg>
                    <span class="rt-landing-name">${landing}</span>
                    <span class="rt-landing-count">
                        ${uniqueBoatCount} boat${uniqueBoatCount !== 1 ? 's' : ''}
                    </span>
                </div>
                <table class="rt-table">
                    <colgroup>
                        <col class="rt-col-boat">
                        <col class="rt-col-anglers">
                        <col class="rt-col-catch">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Boat / Trip</th>
                            <th>Anglers</th>
                            <th>Catch <span class="rt-th-hint">count &middot; avg per angler</span></th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>`;
    }).join('');
}

// Apply the species filter without rebuilding the table DOM.
function _rtApplyFilter() {
    const active = _rt.speciesFilter ? _rt.speciesFilter.getSelected() : new Set();

    document.querySelectorAll('.rt-pill').forEach(pill => {
        const show = active.size === 0 || active.has(pill.dataset.sp);
        pill.style.display = show ? 'inline-flex' : 'none';
    });

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
    const dates = reports.map(r => new Date(r.date + 'T12:00:00Z')).filter(d => !isNaN(d));
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
