# Fishing Report App

## SoCal Fishing Dashboard

A web-based dashboard that automatically scrapes Southern California fishing reports from multiple sources and provides interactive visualizations of fishing activity data.

## Features

- 🎣 **Automated Scraping**: Collects fishing reports from various SoCal sources including H2O Sportz, San Diego Fish Reports, and other local fishing report websites
- 📊 **Interactive Visualizations**: Uses Chart.js to display fishing activity trends and patterns
- 🏄 **Real-time Data**: Automatically updates data every 12 hours with the latest fishing reports
- 📱 **Responsive Design**: Built with Bulma CSS for a clean, mobile-friendly interface
- 📋 **Detailed Reports**: Displays comprehensive fishing data including species caught, locations, boat information, and angler counts
- 🔄 **Data Export**: Stores data in both JSON and CSV formats for easy analysis

## Technologies Used

- **Backend/Scraping**: Python with BeautifulSoup4 and Requests for web scraping
- **Frontend**: HTML5, CSS3, JavaScript
- **Visualization**: Chart.js for interactive charts
- **Styling**: Bulma CSS framework with Font Awesome icons
- **Data Storage**: JSON and CSV formats

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/alando93/fishing-report-app.git
   cd fishing-report-app
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the scrapers** (optional - data is already included):
   ```bash
   python automated_scraping/scripts/scraper.py
   python automated_scraping/scripts/scraper2.py
   python automated_scraping/scripts/scraper3.py
   ```

## Usage

### Viewing the Dashboard

1. **Start a local web server**:
   ```bash
   python -m http.server 8000
   ```

2. **Open your browser** and navigate to `http://localhost:8000`

The dashboard will load the latest fishing report data and display interactive visualizations.

### Updating Data

To manually update the fishing reports:

```bash
# Run all scrapers
python automated_scraping/scripts/scraper.py && python automated_scraping/scripts/scraper2.py && python automated_scraping/scripts/scraper3.py
```

The scrapers will:
- Fetch data from configured fishing report websites
- Parse and clean the data
- Save results to `data/fishing_reports.json` and `data/fishing_reports.csv`

## Data Sources

The application scrapes data from:
- H2O Sportz (Southern California fishing reports)
- San Diego Fish Reports (local landing counts)
- Additional SoCal fishing report sources

## Project Structure

```
fishing-report-app/
├── index.html                 # Main dashboard page
├── README.md                  # This file
├── requirements.txt           # Python dependencies
├── automated_scraping/
│   └── scripts/
│       ├── scraper.py         # H2O Sportz scraper
│       ├── scraper2.py        # Additional scraper
│       └── scraper3.py        # Additional scraper
├── data/
│   ├── fishing_reports.json   # Scraped data in JSON format
│   └── fishing_reports.csv    # Scraped data in CSV format
└── static/
    ├── css/
    │   └── style.css          # Custom styles
    └── js/
        └── dashboard.js       # Dashboard JavaScript logic
```

## Data Format

Each fishing report contains:
- `location`: Fishing location/area
- `landing`: Boat landing or marina
- `boat`: Boat name
- `trip`: Trip type (e.g., "1/2 Day AM")
- `anglers`: Number of anglers
- `species`: Fish species caught
- `count`: Number of fish caught
- `released`: Whether fish were released
- `date`: Date of the report
- `source`: Data source website

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Disclaimer

This application is for informational purposes only. Always check local fishing regulations and conditions before fishing. Data accuracy is not guaranteed and should be verified with official sources.

