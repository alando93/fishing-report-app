import requests
from bs4 import BeautifulSoup
import json
import os
import re
from datetime import datetime, timedelta

# Ensure the data directory exists
os.makedirs("data", exist_ok=True)

def parse_fish_counts(html_content, report_date=None):
    """Parse fish counts from the HTML content."""
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Use the provided report_date or default to today's date
    if report_date is None:
        report_date = datetime.now().strftime("%Y-%m-%d")
    
    # Find all landing panels (each landing has a panel with tables)
    landing_panels = soup.find_all('div', class_='panel')
    
    data = []
    
    for panel in landing_panels:
        # Check if this panel contains fish counts (has an h2 heading)
        heading = panel.find('h2')
        if not heading:
            continue
            
        landing_name = heading.text.strip().replace(' Fish Counts for Today', '')
        
        # Find the table in this panel
        table = panel.find('table')
        if not table:
            continue
            
        # Process each row in the table
        rows = table.find('tbody').find_all('tr') if table.find('tbody') else table.find_all('tr')[1:]
        
        for row in rows:
            columns = row.find_all('td')
            if len(columns) < 3:
                continue
                
            # Extract boat information
            boat_info = columns[0].text.strip().split('\n')
            boat_name = boat_info[0].strip().replace('b', '').strip()
            
            # Extract trip details
            trip_info = columns[1].text.strip().split('\n')
            anglers_match = re.search(r'(\d+) Anglers', trip_info[0])
            num_anglers = anglers_match.group(1) if anglers_match else "0"
            
            trip_type = ""
            for line in trip_info:
                if "Day" in line:
                    trip_type = line.strip()
                    break
            
            # Extract fish counts
            catch_info = columns[2].text.strip()
            
            # Parse the catch information
            fish_counts = re.findall(r'(\d+) ([^,]+?)(?:,|$)', catch_info)
            
            # Get location from the boat info
            location = "Unknown"
            for line in boat_info:
                if "CA" in line:
                    location = line.strip()
                    break
            
            # Add each fish type to our data
            for count, species in fish_counts:
                # Clean up species (remove any "Released" text)
                clean_species = species.strip().split(' Released')[0].strip()
                is_released = 'Released' in species
                
                # Create the report
                data.append({
                    "location": location,
                    "landing": landing_name,
                    "boat": boat_name,
                    "trip": trip_type,
                    "anglers": num_anglers,
                    "species": clean_species,
                    "count": int(count.strip()),
                    "released": is_released,
                    "date": report_date,
                    "source": "San Diego Fish Reports"
                })
    
    return data

def load_existing_data():
    """Load existing data from fishing_reports.json."""
    try:
        with open("data/fishing_reports.json", "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"reports": [], "last_updated": "", "sources": []}

def save_data(new_reports):
    """Save the combined data to fishing_reports.json."""
    existing_data = load_existing_data()
    combined_reports = existing_data.get("reports", []) + new_reports

    # Remove duplicates
    unique_reports = []
    seen = set()
    for report in combined_reports:
        key = f"{report['date']}-{report['location']}-{report['boat']}-{report['species']}-{report['count']}"
        if key not in seen:
            seen.add(key)
            unique_reports.append(report)

    # Keep only the last 10000 reports
    unique_reports = sorted(unique_reports, key=lambda x: x["date"], reverse=True)[:10000]

    # Prepare the final data structure
    data = {
        "reports": unique_reports,
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "sources": list(set(report["source"] for report in unique_reports))
    }

    # Save to JSON file
    with open("data/fishing_reports.json", "w") as f:
        json.dump(data, f, indent=2)

    print(f"Saved {len(unique_reports)} reports to data/fishing_reports.json")
    
    # Generate a summary
    print("\nSummary by landing and boat:")
    summary = {}
    for report in unique_reports:
        landing = report["landing"]
        boat = report["boat"]
        if landing not in summary:
            summary[landing] = {}
        if boat not in summary[landing]:
            summary[landing][boat] = {}
        
        species = report["species"]
        count = report["count"]
        
        if species in summary[landing][boat]:
            summary[landing][boat][species] += count
        else:
            summary[landing][boat][species] = count
    
    # Print the summary
    for landing, boats in summary.items():
        print(f"\n{landing}:")
        for boat, species_counts in boats.items():
            print(f"  {boat}:")
            for species, count in species_counts.items():
                print(f"    {species}: {count}")

def main(html_content=None, date=None):
    """Main function to scrape, parse, and save fish counts."""
    if html_content is None:
        # Use the provided date or default to today's date
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")
        
        url = f"https://www.sandiegofishreports.com/dock_totals/boats.php?date={date}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            html_content = response.content
        except requests.RequestException as e:
            print(f"Error fetching data from {url}: {e}")
            return
    
    print(f"Parsing fish counts for date: {date}...")
    new_reports = parse_fish_counts(html_content, report_date=date)
    print(f"Parsed {len(new_reports)} new reports.")
    save_data(new_reports)

# Example usage with the provided HTML or a specific date
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Scrape San Diego Fish Reports for a date range or today.")
    parser.add_argument("--start_date", type=str, help="Start date in YYYY-MM-DD format")
    parser.add_argument("--end_date", type=str, help="End date in YYYY-MM-DD format")
    args = parser.parse_args()

    if args.start_date and args.end_date:
        start_date = datetime.strptime(args.start_date, "%Y-%m-%d")
        end_date = datetime.strptime(args.end_date, "%Y-%m-%d")
        current_date = start_date

        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")
            main(date=date_str)
            current_date += timedelta(days=1)
    else:
        # Run for today's date
        today_str = datetime.now().strftime("%Y-%m-%d")
        main(date=today_str)


#Usage:
#To run for a custom range:
#python automated_scraping/scripts/scraper2.py --start_date 2025-04-01 --end_date 2025-05-24
#To run for today:
#python automated_scraping/scripts/scraper2.py