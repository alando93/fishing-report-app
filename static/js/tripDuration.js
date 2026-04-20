// Trip-duration parsing and allocation.
//
// Multi-day fishing trips (e.g. "3 Day") have their entire catch stamped with
// the *return* date in the scraped data. This module parses those trip strings
// into a numeric duration and provides an allocator that spreads a trip's
// contribution evenly across the calendar days it spans.

(function (global) {

    // Ordered rules: first match wins. Each rule returns { tripDays, label? }.
    // `label` is only used for display; we generate a canonical one later.
    const RULES = [
        // Fractional "N Day" / "N.5 Day" / "1.75 Day" — must come before plain "N Day"
        { re: /^(\d+(?:\.\d+)?)\s*day\b/i,         days: m => parseFloat(m[1]) },

        // "1/2 Day", "3/4 Day" (with optional suffix like "AM", "PM", "Twilight",
        // "Local", "Offshore", "Coronado Islands", "Islands")
        { re: /^1\/2\s*day\b/i,                    days: () => 0.5 },
        { re: /^3\/4\s*day\b/i,                    days: () => 0.75 },
        { re: /^extended\s*1\/2\s*day\b/i,         days: () => 0.5 },

        // Hour-based: "4 Hour", "10 Hour", etc.
        { re: /^(\d+(?:\.\d+)?)\s*hour\b/i,        days: m => parseFloat(m[1]) / 24 },

        // Overnight (returns next morning) — treat as 1 day per user decision.
        { re: /^reverse\s*overnight\b/i,           days: () => 1 },
        { re: /^overnight\b/i,                     days: () => 1 },

        // "Full Day" (with any suffix)
        { re: /^full\s*day\b/i,                    days: () => 1 }
    ];

    // Parse a trip string into { tripDays, windowDays, isMultiDay, label, raw }.
    // Unknown / empty strings default to 1 day (isMultiDay = false).
    function parse(tripString) {
        const raw = (tripString || '').trim();
        let tripDays = 1;
        let matched = false;

        for (const rule of RULES) {
            const m = raw.match(rule.re);
            if (m) {
                tripDays = rule.days(m);
                matched = true;
                break;
            }
        }

        const windowDays = Math.max(1, Math.ceil(tripDays));
        const isMultiDay = windowDays > 1;

        // Canonical display label for multi-day trips (ignores Local/Islands suffix)
        let label = '';
        if (isMultiDay) {
            label = (Number.isInteger(tripDays) ? tripDays : tripDays) + ' Day';
        }

        return { tripDays, windowDays, isMultiDay, label, raw, matched };
    }

    // Return an array of { date, weight } pairs representing how a trip's
    // catch should be distributed across calendar days.
    //
    // `returnDate` is the 'YYYY-MM-DD' the trip was reported under. The trip's
    // catch is spread evenly across `windowDays` days ending on `returnDate`.
    function allocate(returnDate, tripString) {
        const { windowDays } = parse(tripString);
        if (windowDays <= 1) {
            return [{ date: returnDate, weight: 1, dayIndex: 1, totalDays: 1 }];
        }

        const out = [];
        const baseTs = Date.parse(returnDate + 'T12:00:00Z');
        const weight = 1 / windowDays;
        for (let i = 0; i < windowDays; i++) {
            const offset = windowDays - 1 - i;
            const d = new Date(baseTs - offset * 86400000).toISOString().slice(0, 10);
            out.push({ date: d, weight, dayIndex: i + 1, totalDays: windowDays });
        }
        return out;
    }

    // Pretty-format the numeric trip duration for table display.
    // 1 → "1", 0.5 → "0.5", 0.75 → "0.75", 1.75 → "1.75", 2.5 → "2.5".
    function formatDays(n) {
        if (n == null || isNaN(n)) return '\u2014';
        if (Number.isInteger(n)) return String(n);
        // Strip trailing zeros after decimal, keep up to 2 decimals.
        return parseFloat(n.toFixed(2)).toString();
    }

    global.TripDuration = { parse, allocate, formatDays };
})(window);
