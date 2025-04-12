// Dashboard JavaScript

// Chart colors
const COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', 
    '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'
];

// Charts objects
let activityChart;
let hotSpotsChart;
let speciesChart;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    try {
        // Fetch the fishing report data
        const data = await fetchFishingData();
        
        // Update the Last Updated text
        document.getElementById('lastUpdated').textContent = `Last updated: ${data.last_updated || 'Unknown'}`;
        
        // Render all charts and tables
        renderReportsTable(data.reports);
        renderActivityChart(data.reports);
        renderHotSpotsChart(data.reports);
        renderSpeciesChart(data.reports);
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showErrorMessage('Failed to load dashboard data. Please try again later.');
    }
}

async function fetchFishingData() {
    try {
        const response = await fetch('data/fishing_reports.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        // Return some sample data if fetch fails
        return {
            reports: [
                { date: '2025-04-10', location: 'Dana Point', species: 'Yellowtail', source: 'Sample Data' },
                { date: '2025-04-10', location: 'Newport', species: 'Rockfish', source: 'Sample Data' },
                { date: '2025-04-09', location: 'Oceanside', species: 'Dorado', source: 'Sample Data' },
                { date: '2025-04-09', location: 'San Diego', species: 'Bluefin Tuna', source: 'Sample Data' },
                { date: '2025-04-08', location: 'Huntington', species: 'Halibut', source: 'Sample Data' }
            ],
            last_updated: 'SAMPLE DATA'
        };
    }
}

function renderReportsTable(reports) {
    const tableBody = document.getElementById('reportsTableBody');
    tableBody.innerHTML = '';
    
    // Sort reports by date (newest first)
    const sortedReports = [...reports].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });
    
    // Show the 20 most recent reports
    const recentReports = sortedReports.slice(0, 20);
    
    if (recentReports.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="has-text-centered">No reports available</td></tr>';
        return;
    }
    
    recentReports.forEach(report => {
        const row = document.createElement('tr');
        
        // Format the date
        const date = new Date(report.date);
        const formattedDate = date.toLocaleDateString();
        
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${report.location || 'Unknown'}</td>
            <td>${formatSpecies(report.species)}</td>
            <td>${report.source || 'Unknown'}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

function formatSpecies(species) {
    if (!species) return 'Unknown';
    
    // If species contains commas, create tags for each
    if (species.includes(',')) {
        const speciesList = species.split(',').map(s => s.trim());
        return speciesList.map(s => {
            const className = `${s.toLowerCase()}-color`;
            return `<span class="tag ${className}">${s}</span>`;
        }).join(' ');
    }
    
    // Otherwise just return the species name
    return species;
}

function renderActivityChart(reports) {
    // Group reports by date
    const dateGroups = {};
    
    reports.forEach(report => {
        const date = report.date;
        if (!dateGroups[date]) {
            dateGroups[date] = 0;
        }
        dateGroups[date]++;
    });
    
    // Sort dates
    const sortedDates = Object.keys(dateGroups).sort();
    
    // Take the last 14 days
    const recentDates = sortedDates.slice(-14);
    const recentCounts = recentDates.map(date => dateGroups[date]);
    
    // Format dates for display
    const formattedDates = recentDates.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    // Create/update chart
    const ctx = document.getElementById('activityChart').getContext('2d');
    
    if (activityChart) {
        activityChart.destroy();
    }
    
    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: formattedDates,
            datasets: [{
                label: 'Number of Reports',
                data: recentCounts,
                backgroundColor: 'rgba(0, 136, 254, 0.2)',
                borderColor: '#0088FE',
                borderWidth: 2,
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Fishing Activity (Last 14 Days)'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Reports'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            }
        }
    });
}

function renderHotSpotsChart(reports) {
    // Count reports by location
    const locationCounts = {};
    
    reports.forEach(report => {
        const location = report.location || 'Unknown';
        if (!locationCounts[location]) {
            locationCounts[location] = 0;
        }
        locationCounts[location]++;
    });
    
    // Sort locations by count (descending)
    const sortedLocations = Object.keys(locationCounts).sort((a, b) => {
        return locationCounts[b] - locationCounts[a];
    });
    
    // Take top 5 locations
    const topLocations = sortedLocations.slice(0, 5);
    const topCounts = topLocations.map(location => locationCounts[location]);
    
    // Create/update chart
    const ctx = document.getElementById('hotSpotsChart').getContext('2d');
    
    if (hotSpotsChart) {
        hotSpotsChart.destroy();
    }
    
    hotSpotsChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: topLocations,
            datasets: [{
                data: topCounts,
                backgroundColor: COLORS.slice(0, topLocations.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

function renderSpeciesChart(reports) {
    // Count reports by species
    const speciesCounts = {};
    
    reports.forEach(report => {
        if (!report.species) return;
        
        // Handle comma-separated species
        const speciesList = report.species.includes(',') 
            ? report.species.split(',').map(s => s.trim())
            : [report.species.trim()];
        
        speciesList.forEach(species => {
            if (!speciesCounts[species]) {
                speciesCounts[species] = 0;
            }
            speciesCounts[species]++;
        });
    });
    
    // Sort species by count (descending)
    const sortedSpecies = Object.keys(speciesCounts).sort((a, b) => {
        return speciesCounts[b] - speciesCounts[a];
    });
    
    // Take top 6 species
    const topSpecies = sortedSpecies.slice(0, 6);
    const topCounts = topSpecies.map(species => speciesCounts[species]);
    
    // Create/update chart
    const ctx = document.getElementById('speciesChart').getContext('2d');
    
    if (speciesChart) {
        speciesChart.destroy();
    }
    
    speciesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topSpecies,
            datasets: [{
                label: 'Number of Reports',
                data: topCounts,
                backgroundColor: COLORS.slice(0, topSpecies.length)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Reports'
                    }
                }
            }
        }
    });
}

function showErrorMessage(message) {
    const container = document.querySelector('.container');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'notification is-danger';
    errorDiv.innerHTML = `<p><i class="fas fa-exclamation-triangle mr-2"></i>${message}</p>`;
    
    // Insert at the top of the container
    container.insertBefore(errorDiv, container.firstChild);
    
    // Remove after 10 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 10000);
}