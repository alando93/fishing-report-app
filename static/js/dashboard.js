// Dashboard JavaScript

// Chart colors
const COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', 
    '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'
];

// Charts objects
let activityChart;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

async function initializeDashboard() {
    try {
        // Fetch the fishing report data
        const data = await fetchFishingData();
        
        // Display the date range and last updated time
        const dateRange = getDateRange(data.reports);
        document.getElementById('lastUpdated').textContent = `Data from ${dateRange} | Last updated: ${data.last_updated || 'Unknown'}`;
        
        // Render all charts and tables
        renderReportsTable(data.reports);
        renderActivityChart(data.reports);
        
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

function getDateRange(reports) {
    if (!reports || reports.length === 0) {
        return 'No data available';
    }
    
    // Extract all dates and find min and max
    const dates = reports
        .map(report => new Date(report.date))
        .filter(date => !isNaN(date));
    
    if (dates.length === 0) {
        return 'No valid dates';
    }
    
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    return `${formatDate(minDate)} to ${formatDate(maxDate)}`;
}

function renderReportsTable(reports) {
    const tableBody = document.getElementById('reportsTableBody');
    tableBody.innerHTML = '';

    // Sort reports by date (newest first)
    const sortedReports = [...reports].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    });

    // Show the 50 most recent reports
    const recentReports = sortedReports.slice(0, 50);

    if (recentReports.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="has-text-centered">No reports available</td></tr>';
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
            <td>${report.boat || 'Unknown'}</td>
            <td>${report.species || 'Unknown'}</td>
            <td>${report.count || 0}</td>
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
    // Group reports by date and species
    const dateSpeciesData = {};
    const allSpecies = new Set();
    
    reports.forEach(report => {
        const date = report.date;
        const species = report.species || 'Unknown';
        
        allSpecies.add(species);
        
        if (!dateSpeciesData[date]) {
            dateSpeciesData[date] = {};
        }
        
        if (!dateSpeciesData[date][species]) {
            dateSpeciesData[date][species] = 0;
        }
        
        dateSpeciesData[date][species] += report.count || 0;
    });
    
    // Get all unique species sorted
    const speciesList = Array.from(allSpecies).sort();
    
    // Get all dates sorted
    const allDates = Object.keys(dateSpeciesData).sort();
    
    // Format dates for display
    const formattedDates = allDates.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    // Create datasets for each species
    const datasets = speciesList.map((species, index) => {
        const data = allDates.map(date => {
            const count = dateSpeciesData[date][species] || 0;
            // Return null for 0 values so they don't appear on the chart
            return count === 0 ? null : count;
        });
        
        return {
            label: species,
            data: data,
            borderColor: COLORS[index % COLORS.length],
            backgroundColor: COLORS[index % COLORS.length] + '33', // Add transparency
            borderWidth: 2,
            tension: 0.3,
            fill: false,
            spanGaps: false // Don't connect across null values
        };
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
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Fishing Activity (Lifetime)'
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Fish'
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