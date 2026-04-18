# Fishing Report App

## SoCal Fishing Dashboard

A web-based dashboard that automatically scrapes Southern California fishing reports from multiple sources and provides interactive visualizations of fishing activity data.

---

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

```
fishing-report-app/
├── automated_scraping/
│   └── scripts/
│       └── scraper2.py          # Scraper that fetches and parses fish counts
├── .github/
│   └── workflows/
│       └── scrape.yml           # GitHub Actions workflow that runs the scraper
├── data/
│   └── fishing_reports.json     # Scraped data consumed by the dashboard
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── dashboard.js         # Charts and reports table
│       └── boatCalendar.js      # Boat activity calendar heatmap
├── index.html                   # Main dashboard page
├── requirements.txt
└── README.md
```

---

## How It Works

### 1. `automated_scraping/scripts/scraper2.py`

This is the core scraper. It fetches daily fish count pages from [San Diego Fish Reports](https://www.sandiegofishreports.com/dock_totals/boats.php) and parses them into structured records.

**What it does, step by step:**

1. Sends an HTTP GET request to the fish reports site for a given date (defaulting to today).
2. Parses the HTML using `BeautifulSoup`, finding each landing's panel and its boat table.
3. For each boat row, extracts:
   - **Landing name** (e.g., "H&M Landing")
   - **Boat name**
   - **Trip type** (e.g., "3/4 Day", "Full Day")
   - **Number of anglers**
   - **Fish counts** — parsed from strings like `"12 Yellowtail, 5 Tuna"` using regex
   - **Released flag** — whether the fish were caught and released
4. Loads the existing `data/fishing_reports.json`, removes any records that fall on the same date(s) being scraped (to avoid duplicates on re-runs), then merges in the new records.
5. Caps the stored dataset at 10,000 most recent records.
6. Saves the result back to `data/fishing_reports.json`.

**Running the scraper locally:**

```bash
# Install dependencies
pip install -r requirements.txt

# Scrape today's data
python automated_scraping/scripts/scraper2.py

# Scrape a custom date range
python automated_scraping/scripts/scraper2.py --start_date 2025-04-01 --end_date 2025-05-24

# Dry run (parse and print without saving)
python automated_scraping/scripts/scraper2.py --dry_run
```

---

### 2. `.github/workflows/scrape.yml`

This is a GitHub Actions workflow that runs the scraper automatically in the cloud so you don't have to do it manually.

**Trigger conditions:**
- **On a schedule** — runs every 12 hours via a cron job (`0 */12 * * *`)
- **Manually** — can be triggered at any time from the GitHub Actions tab using `workflow_dispatch`

**What the workflow does:**

1. Checks out the repository.
2. Sets up Python 3.10.
3. Installs dependencies from `requirements.txt`.
4. Runs `scraper2.py` to fetch the latest fish counts.
5. Commits any changes to the `data/` directory and pushes them back to the repository.

If there's nothing new to commit (e.g., the site hasn't updated yet), the step exits cleanly with `"No changes to commit"` rather than failing.

**Important:** The workflow requires that GitHub Actions has write access to the repository. This is enabled by default for public repos; for private repos, verify that `Settings → Actions → Workflow permissions` is set to "Read and write permissions."

---

### 3. `data/fishing_reports.json`

This is the data file that the dashboard reads from. It is generated and updated by the scraper and committed to the repo by the GitHub Actions workflow.

**Structure:**

```json
{
  "reports": [
    {
      "location": "San Diego, CA",
      "landing": "H&M Landing",
      "boat": "Intrepid",
      "trip": "Full Day",
      "anglers": "24",
      "species": "Yellowtail",
      "count": 18,
      "released": false,
      "date": "2025-05-24",
      "source": "San Diego Fish Reports",
      "source_url": "https://www.sandiegofishreports.com/dock_totals/boats.php?date=2025-05-24"
    }
  ],
  "last_updated": "2025-05-24 08:00:00",
  "sources": ["San Diego Fish Reports"]
}
```

**Key fields:**

| Field | Description |
|---|---|
| `location` | City/state of the landing, parsed from the boat's address |
| `landing` | The dock or landing the boat departed from |
| `boat` | Name of the fishing vessel |
| `trip` | Trip type (e.g., Half Day, 3/4 Day, Full Day, Overnight) |
| `anglers` | Number of passengers on the trip |
| `species` | Fish species caught (e.g., "Yellowtail", "Bluefin Tuna") |
| `count` | Number of fish of that species caught on that trip |
| `released` | `true` if the fish were caught and released, `false` if kept |
| `date` | Date of the fishing trip in `YYYY-MM-DD` format |
| `source` | Name of the data source |
| `source_url` | Direct URL to the original report for that date |

The file stores up to **10,000 records**, keeping the most recent ones. Records are deduplicated using a composite key of `date + location + boat + species + count`.

---

## Dashboard Features

- **Stacked bar chart** — daily fish counts broken down by species, with a configurable date range (7d / 30d / 90d / All)
- **Species trend chart** — line chart comparing individual species over time; toggle species on/off using the chip buttons
- **Reports table** — the 50 most recent raw records, sorted by date
- **Boat Activity Calendar** — a GitHub-style heatmap showing how many boats were active each day; hover for a preview, click to pin the full boat list for that day

---

## Setup

1. Fork or clone this repository.
2. Enable GitHub Actions on the repo (it should run automatically on schedule).
3. To backfill historical data, run the scraper locally with a date range:
   ```bash
   python automated_scraping/scripts/scraper2.py --start_date 2025-01-01 --end_date 2025-05-24
   ```
4. Commit and push `data/fishing_reports.json`.
5. Deploy `index.html` via GitHub Pages, Netlify, or any static host — it reads `data/fishing_reports.json` via a relative fetch, so no backend is needed.