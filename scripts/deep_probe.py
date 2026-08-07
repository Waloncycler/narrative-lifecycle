import sys
import requests
from bs4 import BeautifulSoup
import json
import os

def fetch_url(url):
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        
        # Check if PDF
        if 'application/pdf' in resp.headers.get('Content-Type', ''):
            return {"type": "pdf", "content": "PDF parsing requires pdfplumber/PyMuPDF (mocked for now, assuming PDF downloaded)", "url": url}
            
        soup = BeautifulSoup(resp.text, 'html.parser')
        
        # Remove script/style
        for script in soup(["script", "style"]):
            script.decompose()
            
        text = soup.get_text(separator=' ', strip=True)
        return {"type": "html", "title": soup.title.string if soup.title else "", "text": text[:5000], "url": url} # limit to 5000 chars for context
        
    except Exception as e:
        return {"error": str(e), "url": url}

if __name__ == "__main__":
    url = sys.argv[1]
    print(json.dumps(fetch_url(url), ensure_ascii=False))
