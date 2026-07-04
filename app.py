import logging
import os
import re
import time
import requests
import urllib.parse
import concurrent.futures
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request, render_template

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Empty API configuration blocks
API_KEYS = {
    'newsapi': os.environ.get('NEWSAPI_API_KEY', ''),
    'newsdata': os.environ.get('NEWSDATA_API_KEY', ''),
    'mediastack': os.environ.get('MEDIASTACK_API_KEY', '')
}

GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en"

# Caches
_news_cache = {}
_media_cache = {} # Caches resolved image & video URLs
CACHE_DURATION_SECS = 180  # 3 minutes

# Unsplash category stock fallback mapping for high-quality visuals
STOCK_FALLBACKS = {
    'technology': "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop",
    'space': "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop",
    'finance': "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?q=80&w=1200&auto=format&fit=crop",
    'business': "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1200&auto=format&fit=crop",
    'politics': "https://images.unsplash.com/photo-1541872703-74c5e44368f9?q=80&w=1200&auto=format&fit=crop",
    'world': "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop",
    'science': "https://images.unsplash.com/photo-1532094349884-543bc11b234d?q=80&w=1200&auto=format&fit=crop",
    'climate': "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1200&auto=format&fit=crop",
    'health': "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1200&auto=format&fit=crop",
    'default': "https://images.unsplash.com/photo-1475274047050-1d0c0975c63e?q=80&w=1200&auto=format&fit=crop" # Misty mountain peak
}

def get_fallback_visual(title):
    """Selects a highly relevant Unsplash stock background image based on keywords in the title."""
    title_lower = title.lower()
    if any(k in title_lower for k in ['nasa', 'space', 'galaxy', 'rocket', 'moon', 'mars', 'satellite', 'spacex']):
        return STOCK_FALLBACKS['space']
    if any(k in title_lower for k in ['technology', 'ai', 'artificial intelligence', 'microsoft', 'apple', 'google', 'cyber', 'software', 'iphone', 'samsung', 'nvidia']):
        return STOCK_FALLBACKS['technology']
    if any(k in title_lower for k in ['finance', 'stock', 'wall street', 'bitcoin', 'crypto', 'economy', 'interest rate', 'fed', 'inflation']):
        return STOCK_FALLBACKS['finance']
    if any(k in title_lower for k in ['trump', 'biden', 'court', 'senate', 'election', 'government', 'white house', 'politics', 'pm ', 'president', 'minister']):
        return STOCK_FALLBACKS['politics']
    if any(k in title_lower for k in ['climate', 'heat', 'temperature', 'weather', 'flood', 'rain', 'storm', 'fire', 'carbon', 'ocean']):
        return STOCK_FALLBACKS['climate']
    if any(k in title_lower for k in ['science', 'research', 'biology', 'physic', 'discovery', 'dna', 'nature']):
        return STOCK_FALLBACKS['science']
    if any(k in title_lower for k in ['health', 'covid', 'virus', 'doctor', 'hospital', 'medical', 'parasite', 'disease', 'outbreak']):
        return STOCK_FALLBACKS['health']
    if any(k in title_lower for k in ['business', 'company', 'startup', 'acquire', 'merger', 'deal', 'billion', 'ceo']):
        return STOCK_FALLBACKS['business']
    return STOCK_FALLBACKS['default']

def search_duckduckgo_image(query):
    """Scrapes DuckDuckGo search to extract related open-graph images for the query (Hardcore Fallback Strategy)."""
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
        search_url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
        resp = requests.get(search_url, headers=headers, timeout=2.0)
        resp.raise_for_status()
        
        soup = BeautifulSoup(resp.text, 'html.parser')
        # Find search result links, crawl the first one for og:image
        links = soup.find_all('a', class_='result__url')
        for link in links[:3]:
            href = link.get('href')
            if href and 'uddg=' in href:
                actual_url = urllib.parse.unquote(href.split('uddg=')[1].split('&')[0])
                if not any(k in actual_url for k in ['youtube.com', 'wikipedia.org']):
                    r = requests.get(actual_url, headers=headers, timeout=1.5)
                    s = BeautifulSoup(r.text, 'html.parser')
                    og = s.find('meta', property='og:image')
                    if og and og.get('content'):
                        return og.get('content').strip()
    except Exception as e:
        logger.debug(f"DuckDuckGo fallback image search failed for '{query}': {e}")
    return None

def get_related_youtube_video(title):
    """Finds a related YouTube video embed link based on search query keywords."""
    try:
        query = f"{title} news breaking"
        search_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(query)}"
        headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
        yresp = requests.get(search_url, headers=headers, timeout=2.0)
        
        video_ids = re.findall(r'\"videoIds\"\:\[\"([a-zA-Z0-9_-]{11})\"\]', yresp.text)
        if not video_ids:
            video_ids = re.findall(r'watch\?v=([a-zA-Z0-9_-]{11})', yresp.text)
            
        if video_ids:
            vid = video_ids[0]
            return f"https://www.youtube.com/embed/{vid}?autoplay=1&mute=1&controls=0&loop=1&playlist={vid}&enablejsapi=1&showinfo=0&rel=0&iv_load_policy=3"
    except Exception as e:
        logger.error(f"Error searching YouTube for '{title}': {e}")
    return None

def resolve_single_article_media(art):
    """Resolves redirect URL, extracts og:image, and crawls fallback channels if needed."""
    google_url = art['link']
    
    # Check cache first
    if google_url in _media_cache:
        cached = _media_cache[google_url]
        art['imageUrl'] = cached.get('imageUrl')
        art['videoUrl'] = cached.get('videoUrl')
        art['realUrl'] = cached.get('realUrl')
        return

    img_url = None
    real_url = google_url
    video_url = None

    try:
        from googlenewsdecoder import gnewsdecoder
        # Strategy A: Decode Google redirect link
        decoded = gnewsdecoder(google_url)
        if decoded.get('status'):
            real_url = decoded['decoded_url']
            
            # Strategy B: Scraping OpenGraph tags
            headers = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
            resp = requests.get(real_url, headers=headers, timeout=1.8)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, 'html.parser')
            og_img = soup.find('meta', property='og:image')

            if og_img and og_img.get('content'):
                img_url = og_img.get('content').strip()
            else:
                twitter_img = soup.find('meta', name='twitter:image')
                if twitter_img and twitter_img.get('content'):
                    img_url = twitter_img.get('content').strip()

            if img_url and not img_url.startswith('http'):
                img_url = urllib.parse.urljoin(real_url, img_url)

    except Exception as e:
        logger.error(f"Primary image extraction failed for {google_url}: {e}")

    # Strategy C: DuckDuckGo search fallback if og:image fails
    if not img_url:
        img_url = search_duckduckgo_image(art['title'])

    # Strategy D: Unsplash category-specific visual fallback (Guarantees we never have blank images)
    if not img_url:
        img_url = get_fallback_visual(art['title'])

    # Strategy E: Crawl YouTube
    video_url = get_related_youtube_video(art['title'])

    art['imageUrl'] = img_url
    art['videoUrl'] = video_url
    art['realUrl'] = real_url

    # Store in cache
    _media_cache[google_url] = {
        'imageUrl': img_url,
        'videoUrl': video_url,
        'realUrl': real_url
    }

def resolve_news_batch_media(articles, limit=6):
    """Resolves media assets for the top N articles in parallel using thread pool."""
    logger.info(f"Resolving media concurrently for top {limit} articles...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=limit) as executor:
        executor.map(resolve_single_article_media, articles[:limit])

def parse_google_rss(category='all'):
    """Fetches and parses the Google News RSS feed, optionally filtered by category."""
    logger.info(f"Fetching Google News RSS Feed (Category: {category})...")
    
    if category == 'ny':
        url = "https://news.google.com/rss/headlines/section/geo/New%20York?hl=en-US&gl=US&ceid=US:en"
    elif category in ['world', 'us', 'business', 'tech', 'science', 'sports', 'health', 'politics', 'opinion', 'arts', 'style', 'food', 'travel', 'magazine', 'tmagazine', 'realestate']:
        topic_map = {
            'us': 'NATION',
            'politics': 'NATION',
            'opinion': 'NATION',
            'business': 'BUSINESS',
            'realestate': 'BUSINESS',
            'tech': 'TECHNOLOGY',
            'science': 'SCIENCE',
            'sports': 'SPORTS',
            'health': 'HEALTH',
            'arts': 'ENTERTAINMENT',
            'style': 'ENTERTAINMENT',
            'food': 'ENTERTAINMENT',
            'travel': 'ENTERTAINMENT',
            'magazine': 'WORLD',
            'tmagazine': 'WORLD',
            'world': 'WORLD'
        }
        topic_name = topic_map.get(category, 'WORLD')
        url = f"https://news.google.com/rss/headlines/section/topic/{topic_name}?hl=en-US&gl=US&ceid=US:en"
    else:
        url = GOOGLE_NEWS_RSS_URL
        
    response = requests.get(url, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'xml')
    items = soup.find_all('item')
    parsed_articles = []

    for item in items:
        title_raw = item.find('title').text.strip() if item.find('title') else "No Title"
        link = item.find('link').text.strip() if item.find('link') else "#"
        pub_date = item.find('pubDate').text.strip() if item.find('pubDate') else ""
        description_raw = item.find('description').text.strip() if item.find('description') else ""
        
        # Parse source name
        source_el = item.find('source')
        source_name = "Google News"
        if source_el:
            source_name = source_el.text.strip()
        
        title = title_raw
        if source_name and title_raw.endswith(f" - {source_name}"):
            title = title_raw[:-len(f" - {source_name}")].strip()
            
        desc_soup = BeautifulSoup(description_raw, 'html.parser')
        description = desc_soup.get_text().strip()
        if len(description) > 300:
            description = description[:297] + "..."

        article_id = f"google-{hash(title) & 0xffffffff}"

        parsed_articles.append({
            'id': article_id,
            'title': title,
            'link': link,
            'pubDate': pub_date,
            'source': source_name,
            'description': description or "No description available.",
            'provider': 'google',
            'imageUrl': None,
            'videoUrl': None,
            'realUrl': link
        })
    
    return parsed_articles

def fetch_newsapi():
    """Fetches news from NewsAPI."""
    key = API_KEYS.get('newsapi', '').strip()
    if not key:
        raise ValueError("api_key_missing")

    logger.info("Fetching NewsAPI Feed...")
    url = f"https://newsapi.org/v2/top-headlines?country=us&pageSize=30"
    headers = {'X-Api-Key': key}
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    
    data = response.json()
    articles = data.get('articles', [])
    parsed_articles = []

    for index, art in enumerate(articles):
        title = art.get('title') or "No Title"
        link = art.get('url') or "#"
        pub_date = art.get('publishedAt') or ""
        source = art.get('source', {}).get('name') or "NewsAPI"
        description = art.get('description') or "No description available."
        image_url = art.get('urlToImage') or None
        
        parsed_articles.append({
            'id': f"newsapi-{index}-{hash(title) & 0xffffffff}",
            'title': title,
            'link': link,
            'pubDate': pub_date,
            'source': source,
            'description': description,
            'provider': 'newsapi',
            'imageUrl': image_url,
            'videoUrl': None,
            'realUrl': link
        })

    return parsed_articles

def fetch_newsdata():
    """Fetches news from NewsData.io."""
    key = API_KEYS.get('newsdata', '').strip()
    if not key:
        raise ValueError("api_key_missing")

    logger.info("Fetching NewsData.io Feed...")
    url = f"https://newsdata.io/api/1/news?apikey={key}&language=en"
    response = requests.get(url, timeout=10)
    response.raise_for_status()

    data = response.json()
    results = data.get('results', [])
    parsed_articles = []

    for index, art in enumerate(results):
        title = art.get('title') or "No Title"
        link = art.get('link') or "#"
        pub_date = art.get('pubDate') or ""
        source = art.get('source_id') or "NewsData.io"
        description = art.get('description') or "No description available."
        image_url = art.get('image_url') or None
        
        parsed_articles.append({
            'id': f"newsdata-{index}-{hash(title) & 0xffffffff}",
            'title': title,
            'link': link,
            'pubDate': pub_date,
            'source': source.capitalize(),
            'description': description,
            'provider': 'newsdata',
            'imageUrl': image_url,
            'videoUrl': None,
            'realUrl': link
        })

    return parsed_articles

def fetch_mediastack():
    """Fetches news from Mediastack."""
    key = API_KEYS.get('mediastack', '').strip()
    if not key:
        raise ValueError("api_key_missing")

    logger.info("Fetching Mediastack Feed...")
    url = f"http://api.mediastack.com/v1/news?access_key={key}&languages=en&limit=30"
    response = requests.get(url, timeout=10)
    response.raise_for_status()

    data = response.json()
    results = data.get('data', [])
    parsed_articles = []

    for index, art in enumerate(results):
        title = art.get('title') or "No Title"
        link = art.get('url') or "#"
        pub_date = art.get('published_at') or ""
        source = art.get('source') or "Mediastack"
        description = art.get('description') or "No description available."
        image_url = art.get('image') or None
        
        parsed_articles.append({
            'id': f"mediastack-{index}-{hash(title) & 0xffffffff}",
            'title': title,
            'link': link,
            'pubDate': pub_date,
            'source': source,
            'description': description,
            'provider': 'mediastack',
            'imageUrl': image_url,
            'videoUrl': None,
            'realUrl': link
        })

    return parsed_articles

@app.route('/')
def index():
    """Renders the dashboard page."""
    return render_template('index.html')

@app.route('/api/news', methods=['GET'])
def get_news():
    """API endpoint to get headlines from a specified source, filtered optionally by category."""
    source = request.args.get('source', 'google').lower()
    category = request.args.get('category', 'all').lower()
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()

    cache_key = f"{source}-{category}"

    valid_sources = ['google', 'newsapi', 'newsdata', 'mediastack']
    if source not in valid_sources:
        return jsonify({'success': False, 'error': 'invalid_source', 'message': f'Invalid news source: {source}'}), 400

    if not force_refresh and cache_key in _news_cache:
        cache_entry = _news_cache[cache_key]
        if current_time - cache_entry['timestamp'] < CACHE_DURATION_SECS:
            logger.info(f"Serving {cache_key} from cache")
            return jsonify({
                'success': True,
                'source': source,
                'category': category,
                'cached': True,
                'data': cache_entry['data']
            })

    try:
        if source == 'google':
            data = parse_google_rss(category)
            # Resolve media for the top 6 articles concurrently
            resolve_news_batch_media(data, limit=6)
        elif source == 'newsapi':
            data = fetch_newsapi()
            # For premium APIs, search YouTube and fallback images
            with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
                for art in data[:6]:
                    executor.submit(resolve_single_article_media, art)
        elif source == 'newsdata':
            data = fetch_newsdata()
            with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
                for art in data[:6]:
                    executor.submit(resolve_single_article_media, art)
        elif source == 'mediastack':
            data = fetch_mediastack()
            with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
                for art in data[:6]:
                    executor.submit(resolve_single_article_media, art)
            
        _news_cache[cache_key] = {
            'timestamp': current_time,
            'data': data
        }
        
        return jsonify({
            'success': True,
            'source': source,
            'category': category,
            'cached': False,
            'data': data
        })
        
    except ValueError as e:
        if str(e) == "api_key_missing":
            return jsonify({
                'success': False,
                'error': 'api_key_missing',
                'service': source,
                'message': f"API key is missing for '{source}'. Please configure it in app.py."
            }), 403
        return jsonify({'success': False, 'error': 'error', 'message': str(e)}), 500
    except Exception as e:
        logger.exception(f"Error fetching headlines from source: {source}")
        if cache_key in _news_cache:
            return jsonify({
                'success': True,
                'source': source,
                'category': category,
                'cached': True,
                'data': _news_cache[cache_key]['data'],
                'warning': f"Failed to fetch fresh news; serving cached data. Error: {str(e)}"
            })
        return jsonify({
            'success': False,
            'error': 'fetch_failed',
            'message': f"Failed to fetch headlines from {source}: {str(e)}"
        }), 500

@app.route('/api/get-image')
def get_image():
    """Resolves a Google redirect URL and extracts its og:image, fallback visual, and related YouTube video."""
    google_url = request.args.get('url', '')
    if not google_url:
        return jsonify({'success': False, 'error': 'missing_url'}), 400

    # Return cached data if available
    if google_url in _media_cache:
        return jsonify({
            'success': True,
            'image_url': _media_cache[google_url].get('imageUrl'),
            'video_url': _media_cache[google_url].get('videoUrl'),
            'real_url': _media_cache[google_url].get('realUrl')
        })

    try:
        art = {'link': google_url, 'title': request.args.get('title', 'news breaking'), 'imageUrl': None, 'videoUrl': None, 'realUrl': google_url}
        resolve_single_article_media(art)
        
        return jsonify({
            'success': True,
            'image_url': art['imageUrl'],
            'video_url': art['videoUrl'],
            'real_url': art['realUrl']
        })

    except Exception as e:
        logger.error(f"Error resolving media for {google_url}: {str(e)}")
        # Provide stock fallback as absolute insurance
        fallback_img = get_fallback_visual(request.args.get('title', ''))
        return jsonify({
            'success': True,
            'image_url': fallback_img,
            'video_url': None,
            'real_url': google_url
        })

@app.route('/api/config', methods=['GET'])
def get_config():
    """Checks configured API status."""
    return jsonify({
        'newsapi_configured': bool(API_KEYS.get('newsapi', '').strip()),
        'newsdata_configured': bool(API_KEYS.get('newsdata', '').strip()),
        'mediastack_configured': bool(API_KEYS.get('mediastack', '').strip())
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)
