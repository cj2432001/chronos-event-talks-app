# Chronos // Immersive News Deck & Editorial Canvas

[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue.svg)](https://www.python.org/)
[![Framework](https://img.shields.io/badge/framework-Flask-black.svg)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Chronos** is a cinematic, gesture-driven global news dashboard that aggregates real-time headlines, decodes media redirects on-the-fly, and streams topic-matching YouTube videos as immersive, interactive background backdrops.

It is built with a lightweight **Python/Flask** backend proxy and a highly interactive, responsive **Vanilla HTML/JS/CSS** frontend.

---

## 🌟 Key Features

*   **🎬 Cinematic Video Backdrops (No UI)**: Plays topic-related YouTube videos behind active articles. Built-in CSS offset clipping and `pointer-events` disablement completely crop out player titles, buttons, and channel details.
*   **📂 YouTube-Style Catalog Deck (Pull Up Grid)**: Swipe up or scroll down on the page to expand the bottom cards bar into a full-screen grid catalog. Features larger cards, publication details, and full summary snippets. Scroll up at the top of the grid to collapse back to the slide deck.
*   **⚡ Asynchronous Lazy Resolving**: Switches categories instantly (< 100ms) by returning text headlines first. Web images and YouTube streams are resolved dynamically in background API threads as the user scrolls.
*   **🌌 3D Panoramic Parallax**: Tapping the `360` button zooms and pans background images continuously to simulate space and depth.
*   **🔀 Text Scramble Transitions**: Implements a character-level stagger scramble text effect for headlines.
*   **💾 Database Bookmarks & Sharing**: Direct localStorage integration for bookmarks and Web Intents for custom X/Twitter broadcasts.

---

## 🛠️ Project Structure

```
├── app.py                  # Flask backend proxy & asset crawler
├── requirements.txt        # Python dependency manifest
├── test_browser.py         # Selenium headless browser verification test suite
├── templates/
│   └── index.html          # Main HTML structure, sidebars, and modals
└── static/
    ├── style.css           # Cinematic overlays, grid keyframes, and layout styles
    └── script.js           # Client state machine, APIs, and scroll listeners
```

---

## ⚙️ Installation & Setup

### Prerequisites
Make sure Python 3.8+ is installed on your system.

### 1. Clone & Install Dependencies
Navigate to the project folder and install the required libraries:
```bash
pip install -r requirements.txt
```

### 2. Configure API Keys (Optional)
Chronos works completely **free** out of the box using Google News RSS feeds. To enable paid premium alternative engines, configure your API keys in `app.py` or export them as environment variables:
```bash
export NEWSAPI_API_KEY="your-api-key"
export NEWSDATA_API_KEY="your-api-key"
export MEDIASTACK_API_KEY="your-api-key"
```

### 3. Run the Development Server
Launch the Flask backend:
```bash
python3 app.py
```
Open **[http://127.0.0.1:8080](http://127.0.0.1:8080)** in your browser to view the application.
