# Chronos // Premium News Deck

Chronos is a premium, modern, sleek, and minimalist news deck built with **Python Flask** and plain **HTML, JavaScript, and CSS** (vanilla). It displays real-time global news headlines parsed directly from the Google News RSS Feed as its default content engine, and provides clean empty placeholders/toggle triggers for other premium providers (NewsAPI, NewsData.io, and Mediastack) that elegantly alert the user if API keys are missing.

## Key Features

- **Obsidian Dark Theme**: A high-end dark dashboard aesthetic inspired by design leaders like Vercel and Linear, featuring custom layout spacing, ambient background glowing gradients, and thin zinc border lines.
- **Flexible Layout Configurations**:
  1. **Tabbed View**: Displays selected channels separately in distinct panes.
  2. **Unified Timeline**: Merges all activated news feeds into a single chronologically sorted stream.
  3. **Split Canvas**: A dual-pane layout allowing side-by-side comparison of the default Google News RSS feed alongside any alternative premium source on a single page.
- **Persistent Selection Preferences**: Pin your favorite default layout and source selections using the dashboard bookmark button; selections are preserved in local storage and persist across page loads.
- **Active Channel Indicators**: Animating green/grey/red pulse dot markers representing whether news sources are active, loading, or missing API keys.
- **Toast Notifications**: Built-in glass-styled notification banners that slide smoothly into view to display instructions or warnings (such as missing API keys).
- **Asynchronous Refresh Actions**: An active refresh button with rotating animations updates feeds asynchronously without reloading the tab.
- **Integrated Twitter/X Intent**: Allows users to select any specific headline and draft, edit, and share it on X/Twitter via Web Intent, using Twitter-adjusted character length calculations.

## Running the Application

1. Make sure Python 3.x is installed.
2. Install the necessary packages:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the Flask development server:
   ```bash
   python3 app.py
   ```
4. Open the web interface in your browser:
   ```
   http://127.0.0.1:8080
   ```

## Configuration

To activate premium sources, set the corresponding API keys in `app.py` or as environment variables:
- `NEWSAPI_API_KEY`
- `NEWSDATA_API_KEY`
- `MEDIASTACK_API_KEY`
