#!/usr/bin/env python3
"""
San Diego Fish Reports Scraper v2

A robust and efficient scraper for collecting fishing report data from
https://www.sandiegofishreports.com/dock_totals/boats.php

Features:
- Improved HTML parsing with better error handling
- Robust data extraction and validation
- Efficient deduplication and data management
- Comprehensive logging
- Configurable date ranges and options
- Better handling of edge cases and malformed data

Usage:
    python sandiego_fish_reports_scraper_v2.py --start_date 2026-04-01 --end_date 2026-04-19
    python sandiego_fish_reports_scraper_v2.py --dry_run
    python sandiego_fish_reports_scraper_v2.py  # Scrape yesterday's data
"""

import requests
from bs4 import BeautifulSoup, Tag
import json
import os
import re
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from urllib.parse import urljoin
import argparse
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('scraper_v2.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)

# Constants
BASE_URL = "https://www.sandiegofishreports.com"
DATA_DIR = "data"
MAX_RECORDS = 10000
REQUEST_TIMEOUT = 30
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"

class FishReportsScraper:
    """Main scraper class for San Diego Fish Reports."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        })

        # Ensure data directory exists
        os.makedirs(DATA_DIR, exist_ok=True)

    def scrape_date(self, target_date: str, url_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Scrape fishing reports for a specific date.

        Args:
            target_date: The date to label the data with (YYYY-MM-DD)
            url_date: The date to use in the URL (defaults to target_date)

        Returns:
            List of report dictionaries
        """
        if url_date is None:
            url_date = target_date

        url = f"{BASE_URL}/dock_totals/boats.php?date={url_date}"
        logger.info(f"Scraping {url} (labeling as {target_date})")

        try:
            response = self.session.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')
            reports = self._parse_page(soup, target_date, url)

            logger.info(f"Extracted {len(reports)} reports for {target_date}")
            return reports

        except requests.RequestException as e:
            logger.error(f"Failed to fetch {url}: {e}")
            return []
        except Exception as e:
            logger.error(f"Error parsing data for {target_date}: {e}")
            return []

    def _parse_page(self, soup: BeautifulSoup, report_date: str, source_url: str) -> List[Dict[str, Any]]:
        """Parse the HTML page and extract fishing reports."""
        reports = []

        # Find all landing panels
        landing_panels = soup.find_all('div', class_='panel')

        for panel in landing_panels:
            landing_name = self._extract_landing_name(panel)
            if not landing_name:
                continue

            table = panel.find('table')
            if not table:
                continue

            # Extract reports from table rows
            panel_reports = self._parse_table(table, landing_name, report_date, source_url)
            reports.extend(panel_reports)

        return reports

    def _extract_landing_name(self, panel: Tag) -> Optional[str]:
        """Extract the landing name from a panel."""
        heading = panel.find('h2')
        if not heading:
            return None

        landing_name = heading.get_text(strip=True)
        # Remove common suffixes
        landing_name = re.sub(r'\s*Fish Counts for Today\s*$', '', landing_name)
        return landing_name.strip()

    def _parse_table(self, table: Tag, landing_name: str, report_date: str, source_url: str) -> List[Dict[str, Any]]:
        """Parse a table and extract fishing reports."""
        reports = []

        # Get table rows (skip header)
        tbody = table.find('tbody')
        rows = tbody.find_all('tr') if tbody else table.find_all('tr')[1:]

        for row in rows:
            cols = row.find_all('td')
            if len(cols) < 3:
                continue

            try:
                boat_info = self._parse_boat_info(cols[0])
                trip_info = self._parse_trip_info(cols[1])
                catch_info = self._parse_catch_info(cols[2])

                if not boat_info or not catch_info:
                    continue

                # Create reports for each species
                for species_data in catch_info:
                    report = {
                        'location': boat_info.get('location', 'San Diego, CA'),
                        'landing': landing_name,
                        'boat': boat_info['name'],
                        'trip': trip_info.get('trip', 'Unknown'),
                        'anglers': trip_info.get('anglers', 'Unknown'),
                        'species': species_data['species'],
                        'count': species_data['count'],
                        'released': species_data['released'],
                        'date': report_date,
                        'source': 'San Diego Fish Reports',
                        'source_url': source_url
                    }
                    reports.append(report)

            except Exception as e:
                logger.warning(f"Error parsing row: {e}")
                continue

        return reports

    def _parse_boat_info(self, col: Tag) -> Optional[Dict[str, str]]:
        """Parse boat information from the first column."""
        text = col.get_text(separator='\n', strip=True)
        lines = [line.strip() for line in text.split('\n') if line.strip()]

        if not lines:
            return None

        boat_name = lines[0]

        # Try to extract location from address lines
        location = 'San Diego, CA'  # Default
        for line in lines[1:]:
            if 'CA' in line or ',' in line:
                location = line
                break

        return {
            'name': boat_name,
            'location': location
        }

    def _parse_trip_info(self, col: Tag) -> Dict[str, str]:
        """Parse trip and angler information from the second column."""
        result = {'trip': 'Unknown', 'anglers': 'Unknown'}

        # Get text content
        text_parts = col.get_text(separator='|', strip=True).split('|')

        if text_parts:
            # First part is usually anglers
            anglers_match = re.search(r'(\d+)', text_parts[0])
            if anglers_match:
                result['anglers'] = anglers_match.group(1)

        # Find trip type from links
        a_tag = col.find('a')
        if a_tag:
            result['trip'] = a_tag.get_text(strip=True)

        return result

    def _parse_catch_info(self, col: Tag) -> List[Dict[str, Any]]:
        """Parse catch information from the third column."""
        catch_data = []

        # Get the text content
        catch_text = col.get_text(strip=True)

        # Split by commas, but be careful with commas in species names
        # Use regex to find patterns like "107 Rockfish" or "2 Sheephead Released"
        catch_matches = re.findall(r'(\d+)\s+([^,]+?)(?=,\s*\d|\s*$)', catch_text)

        for count_str, species_info in catch_matches:
            try:
                count = int(count_str)

                # Check if released
                released = 'Released' in species_info
                species = species_info.replace(' Released', '').strip()

                if species and count > 0:
                    catch_data.append({
                        'species': species,
                        'count': count,
                        'released': released
                    })

            except ValueError:
                continue

        return catch_data

    def save_reports(self, new_reports: List[Dict[str, Any]], dry_run: bool = False) -> None:
        """Save reports to JSON file with deduplication."""
        if dry_run:
            logger.info("DRY RUN - Not saving data")
            logger.info(f"Would save {len(new_reports)} reports")
            print(json.dumps(new_reports[:5], indent=2))  # Show sample
            return

        # Load existing data
        existing_data = self._load_existing_data()
        existing_reports = existing_data.get('reports', [])

        # Get dates being updated
        new_dates = set(r['date'] for r in new_reports)

        # Filter out old reports for these dates
        filtered_existing = [r for r in existing_reports if r['date'] not in new_dates]

        # Combine and deduplicate
        combined_reports = filtered_existing + new_reports
        unique_reports = self._deduplicate_reports(combined_reports)

        # Keep only the most recent records
        unique_reports = sorted(unique_reports, key=lambda x: x['date'], reverse=True)[:MAX_RECORDS]

        # Prepare final data structure
        data = {
            'reports': unique_reports,
            'last_updated': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'sources': list(set(r['source'] for r in unique_reports))
        }

        # Save to file
        filepath = os.path.join(DATA_DIR, 'fishing_reports.json')
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Saved {len(unique_reports)} reports to {filepath}")

    def _load_existing_data(self) -> Dict[str, Any]:
        """Load existing data from JSON file."""
        filepath = os.path.join(DATA_DIR, 'fishing_reports.json')
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {'reports': [], 'last_updated': '', 'sources': []}

    def _deduplicate_reports(self, reports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate reports based on key fields."""
        seen = set()
        unique_reports = []

        for report in reports:
            # Create a unique key
            key = (
                report['date'],
                report['location'],
                report['boat'],
                report['species'],
                report['count']
            )

            if key not in seen:
                seen.add(key)
                unique_reports.append(report)

        return unique_reports

    def scrape_date_range(self, start_date: str, end_date: str, dry_run: bool = False) -> None:
        """Scrape a range of dates."""
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')

        current = start
        all_reports = []

        while current <= end:
            date_str = current.strftime('%Y-%m-%d')

            # For the URL, use the current date
            # For labeling, use the previous day (based on the issue identified)
            label_date = (current - timedelta(days=1)).strftime('%Y-%m-%d')

            reports = self.scrape_date(label_date, date_str)
            all_reports.extend(reports)

            current += timedelta(days=1)

        if all_reports:
            self.save_reports(all_reports, dry_run)
        else:
            logger.warning("No reports collected")

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Scrape San Diego Fish Reports v2",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python sandiego_fish_reports_scraper_v2.py --start_date 2026-04-01 --end_date 2026-04-19
  python sandiego_fish_reports_scraper_v2.py --dry_run
  python sandiego_fish_reports_scraper_v2.py  # Scrape yesterday's data
        """
    )
    parser.add_argument('--start_date', type=str, help='Start date in YYYY-MM-DD format')
    parser.add_argument('--end_date', type=str, help='End date in YYYY-MM-DD format')
    parser.add_argument('--dry_run', action='store_true', help='Parse and show data without saving')
    parser.add_argument('--date', type=str, help='Scrape a specific date (YYYY-MM-DD)')
    parser.add_argument('--verbose', action='store_true', help='Enable verbose logging')

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    scraper = FishReportsScraper()

    try:
        if args.date:
            # Scrape specific date
            label_date = (datetime.strptime(args.date, '%Y-%m-%d') - timedelta(days=1)).strftime('%Y-%m-%d')
            reports = scraper.scrape_date(label_date, args.date)
            scraper.save_reports(reports, args.dry_run)

        elif args.start_date and args.end_date:
            # Scrape date range
            scraper.scrape_date_range(args.start_date, args.end_date, args.dry_run)

        else:
            # Scrape yesterday's data
            yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
            reports = scraper.scrape_date(yesterday)
            scraper.save_reports(reports, args.dry_run)

    except KeyboardInterrupt:
        logger.info("Scraping interrupted by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()