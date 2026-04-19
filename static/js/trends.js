// Trends section — Chart.js time series with moon-phase background bands.

(function () {

    const _tr = {
        reports: [],
        dates: [],
        allSpecies: [],
        allBoats: [],
        chart: null,
        speciesMS: null,
        boatsMS: null,
        mode: 'species',    // 'species' | 'boat'
        metric: 'total',    // 'total' | 'perAngler'
        smoothing: 0,       // 0 | 7 | 14
        rangeDays: 90       // 30 | 90 | 365 | 0 (all)
    };

    window.initTrendsSection = function (reports) {
        _tr.reports = reports;
        _tr.dates = [...new Set(reports.map(r => r.date))].filter(Boolean).sort();
        _tr.allSpecies = [...new Set(reports.map(r => r.species).filter(Boolean))].sort();
        _tr.allBoats   = [...new Set(reports.map(r => r.boat).filter(Boolean))].sort();

        const mount = document.getElementById('trendsSection');
        if (!mount) return;
        if (typeof Chart === 'undefined') {
            mount.innerHTML = '<div class="trends-empty">Chart library failed to load.</div>';
            return;
        }

        mount.innerHTML = `
            <div class="app-section">
                <div class="section-toolbar">
                    <div>
                        <div class="toolbar-title">Trends</div>
                        <div class="toolbar-sub">Daily fish counts over time, with moon-phase background bands.</div>
                    </div>
                </div>

                <div class="trends-body">
                    <div class="trends-control-row">
                        <label>View</label>
                        <div id="tr-mode"></div>
                        <div id="tr-species-ms"></div>
                        <div id="tr-boats-ms" hidden></div>
                    </div>

                    <div class="trends-control-row">
                        <label>Metric</label>
                        <div id="tr-metric"></div>
                        <label style="margin-left: var(--space-3);">Smoothing</label>
                        <div id="tr-smoothing"></div>
                        <label style="margin-left: var(--space-3);">Range</label>
                        <div id="tr-range"></div>
                    </div>

                    <div class="trends-chart-wrap">
                        <canvas id="trends-chart"></canvas>
                    </div>

                    <div class="trends-legend-note">
                        <span><span class="trends-legend-swatch new"></span>new moon (\u00B11 day)</span>
                        <span><span class="trends-legend-swatch full"></span>full moon (\u00B11 day)</span>
                    </div>
                </div>
            </div>
        `;

        // Segmented controls
        UI.makeSegmented({
            container: document.getElementById('tr-mode'),
            options: [
                { value: 'species', label: 'By species' },
                { value: 'boat',    label: 'By boat' }
            ],
            selected: _tr.mode,
            onChange: v => { _tr.mode = v; onModeChange(); }
        });

        UI.makeSegmented({
            container: document.getElementById('tr-metric'),
            options: [
                { value: 'total',     label: 'Total fish' },
                { value: 'perAngler', label: 'Per angler' }
            ],
            selected: _tr.metric,
            onChange: v => { _tr.metric = v; redraw(); }
        });

        UI.makeSegmented({
            container: document.getElementById('tr-smoothing'),
            options: [
                { value: '0',  label: 'None' },
                { value: '7',  label: '7-day' },
                { value: '14', label: '14-day' }
            ],
            selected: String(_tr.smoothing),
            onChange: v => { _tr.smoothing = parseInt(v, 10) || 0; redraw(); }
        });

        UI.makeSegmented({
            container: document.getElementById('tr-range'),
            options: [
                { value: '30',  label: '30d' },
                { value: '90',  label: '90d' },
                { value: '365', label: '1y' },
                { value: '0',   label: 'All' }
            ],
            selected: String(_tr.rangeDays),
            onChange: v => { _tr.rangeDays = parseInt(v, 10) || 0; redraw(); }
        });

        // Multi-selects
        _tr.speciesMS = UI.makeMultiSelect({
            container: document.getElementById('tr-species-ms'),
            label: 'Species',
            items: speciesItems(),
            selected: defaultSpeciesSelection(),
            onChange: () => redraw()
        });

        _tr.boatsMS = UI.makeMultiSelect({
            container: document.getElementById('tr-boats-ms'),
            label: 'Boats',
            items: boatItems(),
            selected: new Set(),
            onChange: () => redraw()
        });

        createChart();
        redraw();
    };

    // --- Default selections ------------------------------------------------

    function speciesItems() {
        const totals = {};
        _tr.reports.forEach(r => {
            if (!r.species) return;
            totals[r.species] = (totals[r.species] || 0) + (r.count || 0);
        });
        return _tr.allSpecies
            .map(sp => ({ value: sp, label: sp, meta: (totals[sp] || 0).toLocaleString() }))
            .sort((a, b) => parseInt(b.meta.replace(/,/g, '')) - parseInt(a.meta.replace(/,/g, '')));
    }

    function boatItems() {
        const totals = {};
        _tr.reports.forEach(r => {
            if (!r.boat) return;
            totals[r.boat] = (totals[r.boat] || 0) + (r.count || 0);
        });
        return _tr.allBoats
            .map(b => ({ value: b, label: b, meta: (totals[b] || 0).toLocaleString() }))
            .sort((a, b) => parseInt(b.meta.replace(/,/g, '')) - parseInt(a.meta.replace(/,/g, '')));
    }

    // Pick up to 3 most-caught species of interest as a sensible default.
    function defaultSpeciesSelection() {
        const preferred = ['Yellowtail', 'Bluefin Tuna', 'Yellowfin Tuna', 'Dorado'];
        const available = new Set(_tr.allSpecies);
        const picks = preferred.filter(s => available.has(s));
        if (picks.length) return new Set(picks.slice(0, 3));
        // Fall back to top 3 by total count
        return new Set(speciesItems().slice(0, 3).map(i => i.value));
    }

    // --- Aggregation -------------------------------------------------------

    function visibleDates() {
        if (!_tr.dates.length) return [];
        if (!_tr.rangeDays) return _tr.dates;
        const end = _tr.dates[_tr.dates.length - 1];
        const endTs = Date.parse(end + 'T12:00:00Z');
        const startTs = endTs - _tr.rangeDays * 86400000;
        return _tr.dates.filter(d => Date.parse(d + 'T12:00:00Z') >= startTs);
    }

    // Build one series per selected species: daily total (or per-angler) for
    // that species across all boats.
    function seriesBySpecies(dates) {
        const selected = _tr.speciesMS.getSelected();
        if (!selected.size) return [];

        // counts[date][species] = count
        // anglers[date] = set of trip keys seen (to sum distinct trips)
        const counts = {};
        const anglerSum = {};    // per-date total anglers across trips that caught anything

        const tripSeen = {};     // date -> Set(tripKey) to avoid double-counting anglers
        _tr.reports.forEach(r => {
            if (!r.date || !r.species || !selected.has(r.species)) return;
            counts[r.date] = counts[r.date] || {};
            counts[r.date][r.species] = (counts[r.date][r.species] || 0) + (r.count || 0);

            const tripKey = `${r.boat}|${r.trip}`;
            tripSeen[r.date] = tripSeen[r.date] || new Set();
            if (!tripSeen[r.date].has(tripKey)) {
                tripSeen[r.date].add(tripKey);
                anglerSum[r.date] = (anglerSum[r.date] || 0) + (parseInt(r.anglers) || 0);
            }
        });

        return [...selected].sort().map(sp => ({
            label: sp,
            data: dates.map(d => {
                const raw = (counts[d] && counts[d][sp]) || 0;
                if (_tr.metric === 'perAngler') {
                    const a = anglerSum[d] || 0;
                    return a > 0 ? raw / a : null;
                }
                return raw || null;
            })
        }));
    }

    // Build one series per selected boat: daily total across all species.
    function seriesByBoat(dates) {
        const selected = _tr.boatsMS.getSelected();
        if (!selected.size) return [];

        const counts = {};       // counts[date][boat]
        const anglerSum = {};    // anglerSum[date][boat]
        const tripSeen = {};     // tripSeen[date][boat] = Set of trip keys

        _tr.reports.forEach(r => {
            if (!r.date || !r.boat || !selected.has(r.boat)) return;
            counts[r.date] = counts[r.date] || {};
            counts[r.date][r.boat] = (counts[r.date][r.boat] || 0) + (r.count || 0);

            const tripKey = r.trip || '';
            tripSeen[r.date] = tripSeen[r.date] || {};
            tripSeen[r.date][r.boat] = tripSeen[r.date][r.boat] || new Set();
            if (!tripSeen[r.date][r.boat].has(tripKey)) {
                tripSeen[r.date][r.boat].add(tripKey);
                anglerSum[r.date] = anglerSum[r.date] || {};
                anglerSum[r.date][r.boat] = (anglerSum[r.date][r.boat] || 0) + (parseInt(r.anglers) || 0);
            }
        });

        return [...selected].sort().map(boat => ({
            label: boat,
            data: dates.map(d => {
                const raw = (counts[d] && counts[d][boat]) || 0;
                if (_tr.metric === 'perAngler') {
                    const a = (anglerSum[d] && anglerSum[d][boat]) || 0;
                    return a > 0 ? raw / a : null;
                }
                return raw || null;
            })
        }));
    }

    function rollingAverage(arr, window) {
        if (!window || window < 2) return arr;
        const out = new Array(arr.length).fill(null);
        let sum = 0, cnt = 0;
        const buf = [];
        for (let i = 0; i < arr.length; i++) {
            const v = arr[i];
            buf.push(v);
            if (v != null) { sum += v; cnt++; }
            if (buf.length > window) {
                const dropped = buf.shift();
                if (dropped != null) { sum -= dropped; cnt--; }
            }
            out[i] = (cnt > 0 && buf.length >= window) ? sum / cnt : null;
        }
        return out;
    }

    // --- Chart setup -------------------------------------------------------

    function createChart() {
        const root = getComputedStyle(document.documentElement);
        const palette = [1, 2, 3, 4, 5, 6, 7, 8]
            .map(n => root.getPropertyValue(`--chart-${n}`).trim() || '#555');
        const moonNewColor  = root.getPropertyValue('--moon-new').trim()  || 'rgba(100,100,120,0.12)';
        const moonFullColor = root.getPropertyValue('--moon-full').trim() || 'rgba(230,200,110,0.18)';

        const moonBands = {
            id: 'moonBands',
            beforeDatasetsDraw(chart) {
                const { ctx, chartArea, scales } = chart;
                const xScale = scales.x;
                if (!xScale || !chart.data.labels) return;
                const labels = chart.data.labels;
                ctx.save();
                labels.forEach((label, i) => {
                    const info = typeof daysToNearestNewOrFull === 'function'
                        ? daysToNearestNewOrFull(label)
                        : null;
                    if (!info || info.days > 1) return;
                    const x = xScale.getPixelForValue(i);
                    // Stripe width: span to the next label (or +1 day at the edge)
                    const nextX = (i + 1 < labels.length)
                        ? xScale.getPixelForValue(i + 1)
                        : x + (x - xScale.getPixelForValue(Math.max(0, i - 1)));
                    const w = Math.max(2, nextX - x);
                    ctx.fillStyle = info.kind === 'new' ? moonNewColor : moonFullColor;
                    ctx.fillRect(x - w / 2, chartArea.top, w, chartArea.bottom - chartArea.top);
                });
                ctx.restore();
            }
        };

        const canvas = document.getElementById('trends-chart');
        _tr.chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: {
                maintainAspectRatio: false,
                responsive: true,
                interaction: { mode: 'nearest', axis: 'x', intersect: false },
                scales: {
                    x: {
                        ticks: {
                            autoSkip: true,
                            maxTicksLimit: 10,
                            color: root.getPropertyValue('--fg-muted').trim() || '#666',
                            font: { size: 11 }
                        },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: root.getPropertyValue('--fg-muted').trim() || '#666',
                            font: { size: 11 }
                        },
                        grid: { color: 'rgba(0,0,0,0.05)' }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: { boxWidth: 10, boxHeight: 10, font: { size: 12 }, padding: 12 }
                    },
                    tooltip: {
                        callbacks: {
                            title(items) {
                                if (!items.length) return '';
                                const d = items[0].label;
                                const m = (typeof moonPhase === 'function') ? moonPhase(d) : null;
                                const pretty = new Date(d + 'T12:00:00Z').toLocaleDateString('en-US',
                                    { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                                return m ? `${pretty}  ${m.emoji} ${m.name} (${m.illumination}%)` : pretty;
                            },
                            label(ctx) {
                                const v = ctx.parsed.y;
                                if (v == null) return `${ctx.dataset.label}: —`;
                                const fmt = _tr.metric === 'perAngler'
                                    ? v.toFixed(2) + ' / angler'
                                    : v.toLocaleString();
                                return `${ctx.dataset.label}: ${fmt}`;
                            }
                        }
                    }
                }
            },
            plugins: [moonBands]
        });

        _tr.palette = palette;
    }

    function redraw() {
        if (!_tr.chart) return;
        const dates = visibleDates();
        const raw = _tr.mode === 'species' ? seriesBySpecies(dates) : seriesByBoat(dates);

        const datasets = raw.map((s, i) => {
            const color = _tr.palette[i % _tr.palette.length];
            const data = _tr.smoothing ? rollingAverage(s.data, _tr.smoothing) : s.data;
            return {
                label: s.label,
                data,
                borderColor: color,
                backgroundColor: color,
                borderWidth: 1.6,
                pointRadius: _tr.smoothing ? 0 : 2,
                pointHoverRadius: 4,
                tension: 0.25,
                spanGaps: true
            };
        });

        _tr.chart.data.labels = dates;
        _tr.chart.data.datasets = datasets;
        _tr.chart.options.scales.y.title = {
            display: true,
            text: _tr.metric === 'perAngler' ? 'Fish per angler' : 'Fish count',
            color: 'rgba(0,0,0,0.55)',
            font: { size: 11 }
        };
        _tr.chart.update('none');
    }

    function onModeChange() {
        const speciesEl = document.getElementById('tr-species-ms');
        const boatsEl   = document.getElementById('tr-boats-ms');
        if (_tr.mode === 'species') {
            speciesEl.hidden = false;
            boatsEl.hidden = true;
        } else {
            speciesEl.hidden = true;
            boatsEl.hidden = false;
            // If the user hasn't picked any boats yet, seed with top 3
            if (_tr.boatsMS.getSelected().size === 0) {
                const top = boatItems().slice(0, 3).map(i => i.value);
                _tr.boatsMS.setSelected(top);
            }
        }
        redraw();
    }
})();
