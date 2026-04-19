// SoCal Fishing Dashboard

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
    const dt = new Date(_rt.currentDate + 'T12:00:00Z');
    const nextDt = new Date(dt.getTime() + n * 24 * 60 * 60 * 1000);
    const next = nextDt.toISOString().slice(0, 10);
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
    const dt = new Date(date + 'T12:00:00Z');
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
