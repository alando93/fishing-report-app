import requests
from bs4 import BeautifulSoup
import csv
import os
import re
from datetime import datetime, timedelta

# Ensure the data directory exists
os.makedirs("data", exist_ok=True)

def parse_fish_counts(html_content, report_date=None):
    """Parse fish counts from the HTML content."""
    soup = BeautifulSoup(html_content, 'html.parser')
    if report_date is None:
        report_date = datetime.now().strftime("%Y-%m-%d")
    landing_panels = soup.find_all('div', class_='panel')
    data = []
    for panel in landing_panels:
        heading = panel.find('h2')
        if not heading:
            continue
        landing_name = heading.text.strip().replace(' Fish Counts for Today', '')
        table = panel.find('table')
        if not table:
            continue
        rows = table.find('tbody').find_all('tr') if table.find('tbody') else table.find_all('tr')[1:]
        for row in rows:
            columns = row.find_all('td')
            if len(columns) < 3:
                continue
            boat_info = columns[0].text.strip().split('\n')
            boat_name = boat_info[0].strip().replace('b', '').strip()
            text_parts = columns[1].get_text(separator='|', strip=True).split('|')
            num_anglers = text_parts[0] if text_parts else None
            a_tag = columns[1].find('a')
            trip_type = a_tag.get_text(strip=True) if a_tag else None
            catch_info = columns[2].text.strip()
            fish_counts = re.findall(r'(\d+) ([^,]+?)(?:,|$)', catch_info)
            location = "Unknown"
            for line in boat_info:
                if "CA" in line:
                    location = line.strip()
                    break
            for count, species in fish_counts:
                clean_species = species.strip().split(' Released')[0].strip()
                is_released = 'Released' in species
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

def save_csv(reports, filename="data/fishing_reports.csv"):
    """Save the reports to a CSV file."""
    if not reports:
        print("No data to save.")
        return
    fieldnames = [
        "location", "landing", "boat", "trip", "anglers",
        "species", "count", "released", "date", "source"
    ]
    with open(filename, "w", newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for report in reports:
            writer.writerow(report)
    print(f"Saved {len(reports)} reports to {filename}")

def main(html_content=None, date=None, dry_run=False, all_reports=None):
    """Main function to scrape, parse, and save fish counts."""
    if html_content is None:
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
            return all_reports if all_reports is not None else []
    print(f"Parsing fish counts for date: {date}...")
    new_reports = parse_fish_counts(html_content, report_date=date)
    print(f"Parsed {len(new_reports)} new reports.")
    if all_reports is not None:
        all_reports.extend(new_reports)
    return all_reports if all_reports is not None else new_reports

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Scrape San Diego Fish Reports for a date range or today and export to CSV.")
    parser.add_argument("--start_date", type=str, help="Start date in YYYY-MM-DD format")
    parser.add_argument("--end_date", type=str, help="End date in YYYY-MM-DD format")
    parser.add_argument("--dry_run", action="store_true", help="If set, do not save any data to fishing_reports.csv")
    args = parser.parse_args()

    all_reports = []
    if args.start_date and args.end_date:
        start_date = datetime.strptime(args.start_date, "%Y-%m-%d")
        end_date = datetime.strptime(args.end_date, "%Y-%m-%d")
        current_date = start_date
        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")
            main(date=date_str, dry_run=args.dry_run, all_reports=all_reports)
            current_date += timedelta(days=1)
    else:
        today_str = datetime.now().strftime("%Y-%m-%d")
        main(date=today_str, dry_run=args.dry_run, all_reports=all_reports)

    if not args.dry_run:
        save_csv(all_reports)
    else:
        print("Dry run enabled: not saving any data.")