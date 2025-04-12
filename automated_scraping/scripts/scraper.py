import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime
import time
import random

# Make sure the data directory exists
os.makedirs("data", exist_ok=True)

def scrape_h2o_sportz():
    """Scrape H2O Sportz Fishing Reports"""
    reports = []
    try:
        url = "https://h2osportz.com/southern-california-fishing-report/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.content, "html.parser")
        
        # Look for report sections/containers
        report_sections = soup.select(".entry-content p")
        
        for p in report_sections:
            text = p.get_text().strip()
            if not text or len(text) < 10:
                continue
                
            # Try to extract location and fish information
            if ":" in text and any(fish in text.lower() for fish in ["tuna", "yellowtail", "dorado", "rockfish", "halibut", "bass"]):
                try:
                    location = text.split(":")[0].strip()
                    details = text.split(":")[1].strip()
                    
                    # Extract fish types (simple approach)
                    fish_types = []
                    for fish in ["tuna", "yellowtail", "dorado", "rockfish", "halibut", "bass"]:
                        if fish in details.lower():
                            fish_types.append(fish.title())
                    
                    if fish_types and location:
                        reports.append({
                            "location": location,
                            "details": details,
                            "species": ", ".join(fish_types),
                            "date": datetime.now().strftime("%Y-%m-%d"),
                            "source": "H2O Sportz"
                        })
                except:
                    continue
    except Exception as e:
        print(f"Error scraping H2O Sportz: {e}")
    
    return reports

def scrape_dana_wharf():
    """Scrape Dana Wharf fishing reports"""
    reports = []
    try:
        url = "https://danawharf.com/fish-report/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(url, headers=headers)
        soup = BeautifulSoup(response.content, "html.parser")
        
        # Look for report elements
        report_elements = soup.select(".fish-report-content")
        
        for element in report_elements:
            date_elem = element.select_one(".fish-report-date")
            report_date = date_elem.get_text().strip() if date_elem else datetime.now().strftime("%Y-%m-%d")
            
            catches = element.select(".fish-catch")
            for catch in catches:
                try:
                    species = catch.select_one(".fish-name")
                    count = catch.select_one(".fish-count")
                    
                    if species and count:
                        reports.append({
                            "location": "Dana Point",
                            "species": species.get_text().strip(),
                            "count": count.get_text().strip(),
                            "date": report_date,
                            "source": "Dana Wharf"
                        })
                except:
                    continue
    except Exception as e:
        print(f"Error scraping Dana Wharf: {e}")
    
    return reports

def scrape_fishing_reports():
    """Combine all scraping functions and return all reports"""
    all_reports = []
    
    # Add reports from each source
    all_reports.extend(scrape_h2o_sportz())
    time.sleep(random.uniform(1, 3))  # Be nice to servers
    all_reports.extend(scrape_dana_wharf())
    
    # Add more scraping functions as needed
    
    return all_reports

def load_existing_data():
    """Load existing data if available"""
    try:
        with open("data/fishing_reports.json", "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"reports": [], "last_updated": ""}

def save_data(reports):
    """Save scraped data to JSON file"""
    existing_data = load_existing_data()
    
    # Add new reports
    combined_reports = existing_data.get("reports", []) + reports
    
    # Remove duplicates (simple approach)
    unique_reports = []
    seen = set()
    
    for report in combined_reports:
        # Create a key from important fields
        key = f"{report.get('date')}-{report.get('location')}-{report.get('species')}"
        if key not in seen:
            seen.add(key)
            unique_reports.append(report)
    
    # Keep only the last 100 reports to prevent the file from growing too large
    unique_reports = sorted(unique_reports, key=lambda x: x.get("date", ""), reverse=True)[:100]
    
    # Prepare data with metadata
    data = {
        "reports": unique_reports,
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "sources": list(set(report.get("source", "") for report in unique_reports))
    }
    
    # Save to file
    with open("data/fishing_reports.json", "w") as f:
        json.dump(data, f, indent=2)
    
    print(f"Saved {len(unique_reports)} reports to data/fishing_reports.json")

def generate_stats():
    """Generate statistics from the reports"""
    data = load_existing_data()
    reports = data.get("reports", [])
    
    if not reports:
        return
    
    # Count by location
    locations = {}
    for report in reports:
        location = report.get("location", "Unknown")
        if location in locations:
            locations[location] += 1
        else:
            locations[location] = 1
    
    # Count by species
    species = {}
    for report in reports:
        fish = report.get("species", "").split(", ")
        for f in fish:
            if f:
                if f in species:
                    species[f] += 1
                else:
                    species[f] = 1
    
    # Create stats object
    stats = {
        "total_reports": len(reports),
        "locations": locations,
        "species": species
    }
    
    # Save stats
    with open("data/stats.json", "w") as f:
        json.dump(stats, f, indent=2)
    
    print("Generated statistics in data/stats.json")

if __name__ == "__main__":
    print("Starting scraper...")
    new_reports = scrape_fishing_reports()
    print(f"Scraped {len(new_reports)} new reports")
    
    save_data(new_reports)
    generate_stats()
    print("Scraping completed successfully")