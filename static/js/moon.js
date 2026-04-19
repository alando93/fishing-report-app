// Moon phase calculator.
//
// Computes the lunar phase for any date using a synodic-month approximation
// anchored at the known new moon of 2000-01-06 18:14 UTC. Accurate to within
// about a day, which is fine for a fishing report dashboard.

(function (global) {
    const SYNODIC_MONTH = 29.530588853;
    const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

    const PHASES = [
        { name: 'New Moon',        emoji: '\uD83C\uDF11' },
        { name: 'Waxing Crescent', emoji: '\uD83C\uDF12' },
        { name: 'First Quarter',   emoji: '\uD83C\uDF13' },
        { name: 'Waxing Gibbous',  emoji: '\uD83C\uDF14' },
        { name: 'Full Moon',       emoji: '\uD83C\uDF15' },
        { name: 'Waning Gibbous',  emoji: '\uD83C\uDF16' },
        { name: 'Last Quarter',    emoji: '\uD83C\uDF17' },
        { name: 'Waning Crescent', emoji: '\uD83C\uDF18' }
    ];

    function moonPhase(dateString) {
        const ts = Date.parse(dateString.length === 10 ? dateString + 'T12:00:00Z' : dateString);
        const daysSince = (ts - REFERENCE_NEW_MOON) / 86400000;
        let phase = (daysSince / SYNODIC_MONTH) % 1;
        if (phase < 0) phase += 1;

        // Map phase fraction to one of 8 named phases.
        // Each named phase spans 1/8 of the cycle, centered on its canonical value.
        const idx = Math.floor(((phase + 1 / 16) % 1) * 8) % 8;
        const { name, emoji } = PHASES[idx];

        // Illumination: 0 at new, 1 at full, back to 0. Uses cos approximation.
        const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);

        return { phase, name, emoji, illumination };
    }

    // Distance in days to the nearest new or full moon. Used for overlay bands.
    function daysToNearestNewOrFull(dateString) {
        const { phase } = moonPhase(dateString);
        const toNew = Math.min(phase, 1 - phase) * SYNODIC_MONTH;
        const toFull = Math.abs(phase - 0.5) * SYNODIC_MONTH;
        if (toNew < toFull) return { kind: 'new', days: toNew };
        return { kind: 'full', days: toFull };
    }

    global.moonPhase = moonPhase;
    global.daysToNearestNewOrFull = daysToNearestNewOrFull;
})(window);
