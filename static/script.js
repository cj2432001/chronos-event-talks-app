// Chronos / The New York Times Redesign Client Engine v3.0
let ytPlayer = null;

// YouTube API initialization hook
window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('bg-youtube-iframe', {
        events: {
            'onError': onPlayerError
        }
    });
};

function onPlayerError(event) {
    console.warn("YouTube Player error encountered: ", event.data);
    // 2 (invalid parameter), 5 (HTML5 error), 100 (not found), 101/150 (not embeddable)
    if ([2, 5, 100, 101, 150].includes(event.data)) {
        showToast("Stream Restricted", "Video playback restricted by provider; reverting to static cover.", "warning");
        loadDefaultAmbientVideo();
        if (el.playVideoBtn) {
            el.playVideoBtn.style.display = 'none';
        }
    }
}

let state = {
    activeLayout: 'unified', // tabbed, unified, split
    activeSource: 'google',   // google, newsapi, newsdata, mediastack
    activeCategory: 'world',  // world, us, politics, ny, business, tech, science, health, sports, all
    splitRightSource: 'newsapi',
    searchQuery: '',
    openTarget: '_blank',     // _blank (new tab), _self (same page)
    isExplored: true,        // Bypassed landing screen explore requirement by default
    is360Active: false,       // Panoramic pan active state
    
    // API configuration status
    config: {
        newsapi: false,
        newsdata: false,
        mediastack: false
    },
    
    // Feeds cache (keyed by source + category)
    feeds: {
        google: {},
        newsapi: [],
        newsdata: [],
        mediastack: []
    },
    
    // Media cache
    resolvedImages: {},
    resolvedVideos: {},
    
    // Bookmarks database
    bookmarks: JSON.parse(localStorage.getItem('chronos_bookmarks_db') || '[]'),
    
    // Carousel state
    activeArticle: null,
    carouselArticles: [],    // Top articles in rotation
    carouselIndex: 0,
    
    // Autoplay timer settings (starts paused until explore is clicked)
    isPlaying: false,
    autoplayTime: 7000,      // 7 seconds
    elapsedMs: 0,
    autoplayTimerId: null,
    
    // Video player state
    isVideoPlaying: false,
    selectedArticle: null
};

const AMBIENT_VIDEO_URL = "https://www.youtube.com/embed/lmzmJNxspkc?autoplay=1&mute=1&controls=0&loop=1&playlist=lmzmJNxspkc&enablejsapi=1&showinfo=0&rel=0&iv_load_policy=3";

// Dynamic Vignette Gradients mapping
const VIGNETTES = [
    'radial-gradient(circle at 25% 45%, rgba(10,32,25,0.45) 0%, rgba(0,0,0,0.76) 45%, rgba(0,0,0,0.96) 100%)', // Teal/Forest
    'radial-gradient(circle at 25% 45%, rgba(68,22,12,0.45) 0%, rgba(0,0,0,0.76) 45%, rgba(0,0,0,0.96) 100%)', // Sunset
    'radial-gradient(circle at 25% 45%, rgba(56,38,18,0.45) 0%, rgba(0,0,0,0.76) 45%, rgba(0,0,0,0.96) 100%)', // Sepia
    'radial-gradient(circle at 25% 45%, rgba(20,24,58,0.45) 0%, rgba(0,0,0,0.76) 45%, rgba(0,0,0,0.96) 100%)'  // Indigo
];

// DOM Elements hook
const el = {
    layoutToggles: document.getElementById('layout-toggles'),
    targetSwitch: document.getElementById('target-switch'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    refreshBtn: document.getElementById('refresh-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
    savePrefBtn: document.getElementById('save-pref-btn'),
    toastContainer: document.getElementById('toast-container'),
    logo: document.getElementById('logo'),
    
    // Search toggle
    searchTrigger: document.getElementById('nyt-search-trigger'),
    searchSlider: document.getElementById('nyt-search-slider'),
    
    // Sections sidebar
    sectionsTrigger: document.getElementById('sections-sidebar-trigger'),
    sectionsSidebar: document.getElementById('sections-sidebar'),
    closeSectionsBtn: document.getElementById('close-sections-btn'),
    
    // 360 trigger
    nyt360Trigger: document.getElementById('nyt-360-trigger'),
    
    // Backdrop layers
    cinematicBg: document.getElementById('cinematic-bg'),
    bgImageWrapper: document.getElementById('bg-image-wrapper'),
    bgVideoWrapper: document.getElementById('bg-video-wrapper'),
    colorVignette: document.getElementById('bg-color-vignette'),
    
    // Magazine displays
    magazineCanvas: document.getElementById('nyt-magazine-layout'),
    
    // Left Feature details
    featuredTitle: document.getElementById('featured-title'),
    featuredDesc: document.getElementById('featured-desc'),
    featuredCategoryMain: document.getElementById('featured-category-main'),
    featuredCategorySub: document.getElementById('featured-category-sub'),
    featuredDateNum: document.getElementById('featured-date-num'),
    featuredIndexTotal: document.getElementById('featured-index-total'),
    featuredSourceName: document.getElementById('featured-source-name'),
    featuredPubDate: document.getElementById('featured-pub-date'),
    readArticleBtn: document.getElementById('read-article-btn'),
    playVideoBtn: document.getElementById('play-video-btn'),
    broadcastBtn: document.getElementById('broadcast-btn'),
    
    stepperPrevBtn: document.getElementById('stepper-prev-btn'),
    stepperNextBtn: document.getElementById('stepper-next-btn'),
    playbackPlay: document.getElementById('playback-play'),
    playbackTimelineProgress: document.getElementById('playback-timeline-progress'),
    
    // Center curved paths & decks
    timelineNodesTrack: document.getElementById('timeline-nodes-track'),
    upcomingSlidesDeck: document.getElementById('nyt-upcoming-deck'),
    
    // Bottom lists
    headlinesDeckList: document.getElementById('headlines-deck-list'),
    
    // Split layout
    splitCanvas: document.getElementById('split-canvas'),
    splitLeftGrid: document.getElementById('split-left-grid'),
    splitRightGrid: document.getElementById('split-right-grid'),
    splitLeftCounter: document.getElementById('split-left-counter'),
    splitRightCounter: document.getElementById('split-right-counter'),
    splitRightSelect: document.getElementById('split-right-select'),
    
    skeletonLoader: document.getElementById('skeleton-loader'),
    noArticlesFound: document.getElementById('no-articles-found'),
    
    // Social Buttons inside left pane
    shareFacebookBtn: document.getElementById('share-facebook-btn'),
    shareTwitterBtn: document.getElementById('share-twitter-btn'),
    shareCopyBtn: document.getElementById('share-copy-btn'),
    shareBookmarkBtn: document.getElementById('share-bookmark-btn'),
    
    // Modal controls
    tweetModal: document.getElementById('tweet-modal'),
    closeModalBtn: document.getElementById('close-modal-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCounter: document.getElementById('char-counter'),
    postBtn: document.getElementById('modal-post-btn'),
    previewHeadline: document.getElementById('tweet-preview-headline'),
    previewDomain: document.getElementById('tweet-preview-domain')
};

// Initial document hook
document.addEventListener('DOMContentLoaded', () => {
    loadPreferences();
    checkBackendConfig().then(() => {
        initializeView();
    });
    setupEventListeners();
});

// Layout setup
async function initializeView() {
    // Set active defaults for unified layout
    switchLayout('unified');
    updateTargetSwitchUI();
    el.splitRightSelect.value = state.splitRightSource;
    updateSubnavHighlight();
}

// Binding listeners
function setupEventListeners() {
    // Logo Homepage reset functionality (in-place reset)
    if (el.logo) {
        el.logo.addEventListener('click', (e) => {
            e.preventDefault();
            state.activeCategory = 'world';
            if (el.searchInput) el.searchInput.value = '';
            state.searchQuery = '';
            if (el.clearSearch) el.clearSearch.style.display = 'none';
            updateSubnavHighlight();
            refreshActiveLayoutFeeds();
            showToast("Welcome Home", "Resetting Chronos Canvas to the latest world news.", "info");
        });
    }

    // Hamburger Sidebar menu toggle
    if (el.sectionsTrigger) {
        el.sectionsTrigger.addEventListener('click', () => {
            el.sectionsSidebar.style.display = 'flex';
        });
    }
    if (el.closeSectionsBtn) {
        el.closeSectionsBtn.addEventListener('click', () => {
            el.sectionsSidebar.style.display = 'none';
        });
    }
    if (el.sectionsSidebar) {
        el.sectionsSidebar.addEventListener('click', (e) => {
            if (e.target === el.sectionsSidebar) el.sectionsSidebar.style.display = 'none';
        });
        
        // Sidebar link clicks
        el.sectionsSidebar.querySelectorAll('.sidebar-sec-link').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                el.sectionsSidebar.style.display = 'none';
                
                const category = link.dataset.category;
                state.activeCategory = category;
                updateSubnavHighlight();
                await refreshActiveLayoutFeeds();
            });
        });
    }

    // Panoramic 360 viewer trigger
    if (el.nyt360Trigger) {
        el.nyt360Trigger.addEventListener('click', () => {
            state.is360Active = !state.is360Active;
            el.bgImageWrapper.classList.toggle('panoramic-active', state.is360Active);
            
            if (state.is360Active) {
                showToast("360 Panoramic View Active", "Slow panning backdrop animation active.", "success");
                el.nyt360Trigger.style.borderColor = "var(--accent-cyan)";
                el.nyt360Trigger.style.color = "var(--accent-cyan)";
            } else {
                showToast("360 Panoramic Deactivated", "Backdrop static position restored.", "success");
                el.nyt360Trigger.style.borderColor = "rgba(255,255,255,0.25)";
                el.nyt360Trigger.style.color = "var(--text-light-primary)";
            }
        });
    }

    // Search toggle box
    if (el.searchTrigger) {
        el.searchTrigger.addEventListener('click', () => {
            if (el.searchSlider.style.display === 'none') {
                el.searchSlider.style.display = 'flex';
                el.searchInput.focus();
            } else {
                el.searchSlider.style.display = 'none';
            }
        });
    }

    // Landing page Explore button
    const exploreBtn = document.getElementById('intro-explore-btn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            const introScreen = document.getElementById('intro-screen');
            const appWrapper = document.getElementById('nyt-app-wrapper');
            
            if (introScreen) introScreen.classList.add('fade-out');
            if (appWrapper) {
                appWrapper.style.opacity = '1';
                appWrapper.style.pointerEvents = 'all';
                appWrapper.style.transform = 'scale(1)';
            }
            
            // STRICTLY toggle explored states to enable auto-video streaming!
            state.isExplored = true;
            
            // If the active article has a video stream, transition to it immediately!
            if (state.activeArticle) {
                const videoUrl = state.activeArticle.videoUrl || state.resolvedVideos[state.activeArticle.id];
                if (videoUrl) {
                    playBackgroundVideo(videoUrl);
                }
            }
            
            // Resume slider autoplay
            state.isPlaying = true;
            startAutoplayTimer();
        });
    }

    // Top subnav links categories navigation
    const navCategories = document.getElementById('nyt-nav-categories');
    if (navCategories) {
        navCategories.addEventListener('click', async (e) => {
            e.preventDefault();
            const link = e.target.closest('.subnav-link');
            if (!link) return;

            const category = link.dataset.category;
            state.activeCategory = category;
            
            updateSubnavHighlight();
            await refreshActiveLayoutFeeds();
        });
    }

    if (el.layoutToggles) {
        el.layoutToggles.addEventListener('click', (e) => {
            const btn = e.target.closest('.layout-tab-btn');
            if (!btn) return;
            switchLayout(btn.dataset.layout);
        });
    }

    if (el.targetSwitch) el.targetSwitch.addEventListener('click', toggleLinkTarget);
    el.refreshBtn.addEventListener('click', () => refreshActiveLayoutFeeds(true));
    el.savePrefBtn.addEventListener('click', savePreferences);

    el.splitRightSelect.addEventListener('change', async (e) => {
        state.splitRightSource = e.target.value;
        await fetchFeedIfEmpty(state.splitRightSource);
        renderActiveLayout();
    });

    el.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        el.clearSearch.style.display = state.searchQuery ? 'block' : 'none';
        renderActiveLayout();
    });

    el.clearSearch.addEventListener('click', () => {
        el.searchInput.value = '';
        state.searchQuery = '';
        el.clearSearch.style.display = 'none';
        renderActiveLayout();
    });

    el.playVideoBtn.addEventListener('click', toggleVideoPlayback);
    el.broadcastBtn.addEventListener('click', () => {
        if (state.activeArticle) openShareModal(state.activeArticle);
    });
    
    // Index Stepper arrow clicks
    if (el.stepperPrevBtn) el.stepperPrevBtn.addEventListener('click', () => advanceCarousel(-1));
    if (el.stepperNextBtn) el.stepperNextBtn.addEventListener('click', () => advanceCarousel(1));
    if (el.playbackPlay) el.playbackPlay.addEventListener('click', togglePlayPauseAutoplay);

    // Social actions binding
    if (el.shareFacebookBtn) {
        el.shareFacebookBtn.addEventListener('click', () => {
            if (!state.activeArticle) return;
            const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(state.activeArticle.link)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        });
    }
    if (el.shareTwitterBtn) {
        el.shareTwitterBtn.addEventListener('click', () => {
            if (state.activeArticle) openShareModal(state.activeArticle);
        });
    }
    if (el.shareCopyBtn) {
        el.shareCopyBtn.addEventListener('click', () => {
            if (!state.activeArticle) return;
            navigator.clipboard.writeText(state.activeArticle.link).then(() => {
                showToast("Link Copied", "Article link is copied to clipboard.", "success");
            }).catch(() => {
                showToast("Copy Failed", "Could not copy link automatically.", "error");
            });
        });
    }
    if (el.shareBookmarkBtn) {
        el.shareBookmarkBtn.addEventListener('click', toggleActiveBookmarkState);
    }

    el.closeModalBtn.addEventListener('click', closeShareModal);
    el.modalCancelBtn.addEventListener('click', closeShareModal);
    el.tweetModal.addEventListener('click', (e) => {
        if (e.target === el.tweetModal) closeShareModal();
    });
    el.tweetTextarea.addEventListener('input', updateCharCount);
    el.postBtn.addEventListener('click', launchTweetIntent);

    // Pull-up handle click event
    const pullHandle = document.getElementById('deck-pull-handle');
    if (pullHandle) {
        pullHandle.addEventListener('click', () => {
            const container = document.getElementById('headlines-deck-list');
            if (container) {
                const isExpanded = container.classList.contains('deck-expanded');
                expandCardsDeck(!isExpanded);
            }
        });
    }

    // Scroll gesture: scroll down expands deck, scroll up at top collapses it
    let lastWheelTime = 0;
    window.addEventListener('wheel', (e) => {
        const now = Date.now();
        if (now - lastWheelTime < 300) return; // Debounce
        
        const container = document.getElementById('headlines-deck-list');
        if (!container) return;
        
        const isExpanded = container.classList.contains('deck-expanded');
        // Expand on scroll down
        if (e.deltaY > 20 && !isExpanded) {
            expandCardsDeck(true);
            lastWheelTime = now;
        }
    });

    const scrollContainer = document.getElementById('headlines-deck-list');
    if (scrollContainer) {
        scrollContainer.addEventListener('wheel', (e) => {
            if (scrollContainer.classList.contains('deck-expanded') && scrollContainer.scrollTop === 0 && e.deltaY < -10) {
                expandCardsDeck(false);
            }
        });
    }
}

// Config details
async function checkBackendConfig() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        state.config.newsapi = config.newsapi_configured;
        state.config.newsdata = config.newsdata_configured;
        state.config.mediastack = config.mediastack_configured;
        
        // Update sidebar badges too
        updateSidebarBadge('newsapi', state.config.newsapi);
        updateSidebarBadge('newsdata', state.config.newsdata);
        updateSidebarBadge('mediastack', state.config.mediastack);
    } catch (error) {
        console.error("Failed checking config status:", error);
    }
}

function updateSidebarBadge(service, active) {
    const badge = document.getElementById(`sidebar-status-${service}`);
    if (!badge) return;
    if (active) {
        badge.className = 'status-badge online';
        badge.textContent = 'KEYS ACTIVE';
    } else {
        badge.className = 'status-badge';
        badge.textContent = 'KEYS PENDING';
    }
}

function updateSubnavHighlight() {
    document.querySelectorAll('.subnav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.category === state.activeCategory);
    });
}

// Target switch control
function toggleLinkTarget() {
    state.openTarget = state.openTarget === '_blank' ? '_self' : '_blank';
    updateTargetSwitchUI();
}

function updateTargetSwitchUI() {
    const isBlank = state.openTarget === '_blank';
    const switchBullet = el.targetSwitch ? el.targetSwitch.querySelector('.switch-bullet') : null;
    
    if (switchBullet) {
        if (isBlank) {
            switchBullet.style.left = '2px';
        } else {
            switchBullet.style.left = 'calc(50% - 2px)';
        }
    }
    
    if (el.targetSwitch) {
        el.targetSwitch.querySelectorAll('.switch-opt').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.target === state.openTarget);
        });
    }

    if (el.readArticleBtn && state.activeArticle) {
        el.readArticleBtn.target = state.openTarget;
    }
}

// Layout Switch
function switchLayout(layout) {
    state.activeLayout = layout;
    loadDefaultAmbientVideo();
    stopAutoplayTimer();
    
    if (layout === 'split') {
        if (el.magazineCanvas) el.magazineCanvas.classList.remove('active');
        if (el.splitCanvas) el.splitCanvas.classList.add('active');
        el.cinematicBg.style.opacity = '0';
    } else {
        if (el.splitCanvas) el.splitCanvas.classList.remove('active');
        if (el.magazineCanvas) el.magazineCanvas.classList.add('active');
        el.cinematicBg.style.opacity = '1';
    }

    refreshActiveLayoutFeeds().then(() => {
        renderActiveLayout();
    });
}

// Refresh feeds
async function refreshActiveLayoutFeeds(forceRefresh = false) {
    showLoading(true);
    stopAutoplayTimer();
    loadDefaultAmbientVideo();
    
    try {
        if (state.activeLayout === 'split') {
            await fetchFeed('google', forceRefresh);
            await fetchFeed(state.splitRightSource, forceRefresh);
        } else {
            // Fetch Google RSS category feed dynamically
            await fetchFeed('google', forceRefresh);
        }
    } catch (e) {
        console.error("Refresh error:", e);
    } finally {
        showLoading(false);
        renderActiveLayout();
    }
}

async function fetchFeedIfEmpty(source) {
    if (source === 'google') {
        const catCache = state.feeds.google[state.activeCategory];
        if (!catCache || catCache.length === 0) {
            showLoading(true);
            const success = await fetchFeed('google', false);
            showLoading(false);
            return success;
        }
        return true;
    } else {
        if (state.feeds[source].length === 0) {
            showLoading(true);
            const success = await fetchFeed(source, false);
            showLoading(false);
            return success;
        }
        return true;
    }
}

async function fetchFeed(source, forceRefresh = false) {
    let url = `/api/news?source=${source}`;
    if (source === 'google') {
        url += `&category=${state.activeCategory}`;
    }
    if (forceRefresh) url += '&refresh=true';
    
    try {
        const response = await fetch(url);
        const result = await response.json();
        
        if (response.status === 403) {
            showToast("API Key Missing", `Please configure active key for '${source}' inside app.py.`, "error");
            return false;
        }
        
        if (result.success) {
            if (source === 'google') {
                state.feeds.google[state.activeCategory] = result.data;
            } else {
                state.feeds[source] = result.data;
            }
            return true;
        } else {
            showToast("Fetch Failed", result.message || `Error fetching data from ${source}.`, "error");
            return false;
        }
    } catch (error) {
        showToast("Network Error", "Failed to connect with Flask server.", "error");
        return false;
    }
}

// Render Router
function renderActiveLayout() {
    el.noArticlesFound.style.display = 'none';

    if (state.activeLayout === 'split') {
        renderSplitView();
    } else {
        renderMagazineView();
    }
}

// Dynamic Kinetic Typographic Scramble Animation
function scrambleText(element, text) {
    if (!element) return;
    
    // 1. Scatter current characters out
    const currentSpans = element.querySelectorAll('span');
    if (currentSpans.length > 0) {
        currentSpans.forEach(span => {
            const rx = Math.floor(Math.random() * 80) - 40;
            const ry = Math.floor(Math.random() * 80) - 40;
            const rr = Math.floor(Math.random() * 60) - 30;
            
            span.style.transform = `translate3d(${rx}px, ${ry}px, 0) rotate(${rr}deg)`;
            span.classList.add('scrambled');
        });
    }

    setTimeout(() => {
        element.innerHTML = '';
        
        // 2. Insert new characters scrambled
        const chars = text.split('');
        chars.forEach((char, idx) => {
            if (char === ' ') {
                element.appendChild(document.createTextNode(' '));
                return;
            }
            
            const span = document.createElement('span');
            span.textContent = char;
            span.className = 'scrambled';
            
            const rx = Math.floor(Math.random() * 80) - 40;
            const ry = Math.floor(Math.random() * 80) - 40;
            const rr = Math.floor(Math.random() * 60) - 30;
            span.style.transform = `translate3d(${rx}px, ${ry}px, 0) rotate(${rr}deg)`;
            
            element.appendChild(span);
            
            // Stagger character entry
            setTimeout(() => {
                span.style.transform = 'none';
                span.classList.remove('scrambled');
            }, 50 + (idx * 15));
        });
    }, 280);
}

// Render Magazine grid view
function renderMagazineView() {
    let articles = state.feeds.google[state.activeCategory] || [];
    
    const filtered = filterBySearch(articles);
    el.featuredIndexTotal.textContent = String(Math.min(filtered.length, 29)).padStart(2, '0');
    
    if (filtered.length === 0) {
        el.noArticlesFound.style.display = 'block';
        el.magazineCanvas.classList.remove('active');
        return;
    } else {
        el.magazineCanvas.classList.add('active');
    }

    const sortedArticles = getSortedArticlesForDeck(filtered);
    
    // Set active articles in slideshow (Top 10 articles)
    state.carouselArticles = sortedArticles.slice(0, 10);
    
    renderTimelineNodes();
    renderUpcomingDeck();

    el.headlinesDeckList.innerHTML = '';
    sortedArticles.forEach((art, idx) => {
        const card = createNewsCard(art, idx);
        
        card.addEventListener('click', (e) => {
            // Avoid selecting slide if clicking image link or title link
            if (e.target.closest('.nyt-card-title-link') || e.target.closest('.nyt-card-img-box img')) {
                return;
            }
            selectFeaturedArticle(art, idx);
        });

        el.headlinesDeckList.appendChild(card);
    });

    // Select first article on render
    if (state.carouselArticles.length > 0) {
        selectFeaturedArticle(state.carouselArticles[0], 0);
    }
}

// Render floating node cards along curving timeline map
function renderTimelineNodes() {
    el.timelineNodesTrack.innerHTML = '';
    if (state.carouselArticles.length === 0) return;
    
    // Render Node 1 (Active Featured slide)
    const card1Art = state.activeArticle || state.carouselArticles[0];
    const node1 = createFloatingMapNode(card1Art, 0, 1);
    el.timelineNodesTrack.appendChild(node1);
    
    // Render Node 2 (Upcoming slide in rotation)
    const nextIdx = (state.carouselIndex + 1) % state.carouselArticles.length;
    const card2Art = state.carouselArticles[nextIdx];
    if (card2Art && card2Art.id !== card1Art.id) {
        const node2 = createFloatingMapNode(card2Art, nextIdx, 2);
        el.timelineNodesTrack.appendChild(node2);
    }
}

function createFloatingMapNode(art, index, nodeNumber) {
    const node = document.createElement('div');
    node.className = `path-node ${index === state.carouselIndex ? 'active' : ''}`;
    node.dataset.index = index;
    
    const imageUrl = art.imageUrl || state.resolvedImages[art.id];
    const imgHTML = (imageUrl && imageUrl !== 'none' && imageUrl !== 'checking')
        ? `<img src="${imageUrl}" alt="thumb">`
        : `<i class="fa-solid fa-mountain"></i>`;
        
    const domain = art.source.toUpperCase();
    
    node.innerHTML = `
        <div class="node-thumb">
            ${imgHTML}
        </div>
        <div class="node-body">
            <span class="node-tag" style="font-size: 0.5rem; font-weight: 700; color: var(--accent-cyan); display: block; text-transform: uppercase;">${domain}</span>
            <span class="node-title-txt">${art.title}</span>
        </div>
    `;
    
    node.addEventListener('click', () => {
        selectFeaturedArticle(art, index);
    });
    
    return node;
}

// Render upcoming vertical slides deck
function renderUpcomingDeck() {
    el.upcomingSlidesDeck.innerHTML = '';
    if (state.carouselArticles.length <= 1) return;
    
    // Display next 3 upcoming slides
    for (let i = 1; i <= 3; i++) {
        const idx = (state.carouselIndex + i) % state.carouselArticles.length;
        const art = state.carouselArticles[idx];
        if (!art) continue;
        
        const card = document.createElement('div');
        card.className = 'upcoming-card-node';
        
        let catText = art.source.toUpperCase();
        
        card.innerHTML = `
            <span class="up-meta">${String(idx + 1).padStart(2, '0')} / ${catText}</span>
            <span class="up-title">${art.title}</span>
            <p class="up-desc">${art.description}</p>
        `;
        
        card.addEventListener('click', () => {
            selectFeaturedArticle(art, idx);
        });
        
        el.upcomingSlidesDeck.appendChild(card);
    }
}

// Select featured details
function selectFeaturedArticle(art, index) {
    state.activeArticle = art;
    state.carouselIndex = index;

    // 1. Scramble Text Headline Transition
    scrambleText(el.featuredTitle, art.title);
    
    // 2. Normal text loads
    el.featuredDesc.textContent = art.description;
    el.featuredSourceName.textContent = art.source;
    
    // Subnav categories mapping
    const category = art.provider === 'google' ? 'WORLD' : 'JOURNEY';
    el.featuredCategoryMain.textContent = category;
    el.featuredCategorySub.textContent = art.source.toUpperCase();
    
    let dateDigit = '17';
    let dateStr = 'Recent';
    if (art.pubDate) {
        const d = new Date(art.pubDate);
        if (!isNaN(d)) {
            dateDigit = String(d.getDate()).padStart(2, '0');
            dateStr = d.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
        }
    }
    el.featuredDateNum.textContent = dateDigit;
    el.featuredPubDate.innerHTML = dateStr;
    
    el.readArticleBtn.href = art.link;
    el.readArticleBtn.target = state.openTarget;

    // 3. Vignette color shifts dynamically based on slide index
    const vig = VIGNETTES[index % VIGNETTES.length];
    if (el.colorVignette) {
        el.colorVignette.style.background = vig;
    }

    // 4. Cross-fade background cover
    const imageUrl = art.imageUrl || state.resolvedImages[art.id];
    el.bgImageWrapper.style.opacity = '0';
    setTimeout(() => {
        if (imageUrl && imageUrl !== 'none' && imageUrl !== 'checking') {
            el.bgImageWrapper.style.backgroundImage = `url('${imageUrl}')`;
        } else {
            el.bgImageWrapper.style.background = `linear-gradient(135deg, #09090b 0%, #121217 100%)`;
        }
        el.bgImageWrapper.style.opacity = '1';
    }, 280);

    // 5. Scroll active list card into view
    document.querySelectorAll('.bottom-scroll-container .nyt-scroll-card').forEach(card => {
        card.classList.remove('active-featured');
    });
    const cardEl = document.getElementById(`card-${art.id}`);
    if (cardEl) {
        cardEl.classList.add('active-featured');
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // 6. Refresh node coordinates cards & bookmark button icon state
    renderTimelineNodes();
    renderUpcomingDeck();
    updateBookmarkIconUI(art.id);

    // 7. Background video auto-transition (STRICTLY verify explored status first)
    if (state.isExplored) {
        const videoUrl = art.videoUrl || state.resolvedVideos[art.id];
        if (videoUrl) {
            el.playVideoBtn.style.display = 'inline-flex';
            playBackgroundVideo(videoUrl);
        } else {
            loadDefaultAmbientVideo();
            el.playVideoBtn.style.display = 'none';
            
            if (art.provider === 'google') {
                resolveVideoLink(art);
            }
        }
    } else {
        // Landing mode: Keep default loop running and cover displayed
        loadDefaultAmbientVideo();
    }

    state.elapsedMs = 0;
    if (el.playbackTimelineProgress) el.playbackTimelineProgress.style.width = '0%';
}

// Google video crawling resolver
async function resolveVideoLink(art) {
    if (state.resolvedVideos[art.id] !== undefined) return;
    
    try {
        const response = await fetch(`/api/get-image?url=${encodeURIComponent(art.link)}&title=${encodeURIComponent(art.title)}`);
        const result = await response.json();
        
        if (result.success && result.video_url) {
            state.resolvedVideos[art.id] = result.video_url;
            if (state.activeArticle && state.activeArticle.id === art.id && state.isExplored) {
                el.playVideoBtn.style.display = 'inline-flex';
                playBackgroundVideo(result.video_url); // Triggers auto-fade transition immediately
            }
        } else {
            state.resolvedVideos[art.id] = null;
        }
    } catch (e) {
        state.resolvedVideos[art.id] = null;
    }
}

// Autoplay progress loop
function startAutoplayTimer() {
    if (state.autoplayTimerId) clearInterval(state.autoplayTimerId);
    
    if (state.isPlaying && !state.isVideoPlaying && state.carouselArticles.length > 1 && state.isExplored) {
        if (el.playbackPlay) {
            el.playbackPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
            el.playbackPlay.title = "Pause Slideshow";
        }
        
        state.autoplayTimerId = setInterval(() => {
            state.elapsedMs += 100;
            const pct = Math.min((state.elapsedMs / state.autoplayTime) * 100, 100);
            if (el.playbackTimelineProgress) el.playbackTimelineProgress.style.width = `${pct}%`;
            
            if (state.elapsedMs >= state.autoplayTime) {
                state.elapsedMs = 0;
                advanceCarousel(1);
            }
        }, 100);
    } else {
        if (el.playbackPlay) {
            el.playbackPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
            el.playbackPlay.title = "Play Slideshow";
        }
    }
}

function stopAutoplayTimer() {
    if (state.autoplayTimerId) {
        clearInterval(state.autoplayTimerId);
        state.autoplayTimerId = null;
    }
}

function togglePlayPauseAutoplay() {
    state.isPlaying = !state.isPlaying;
    if (state.isPlaying) {
        startAutoplayTimer();
    } else {
        stopAutoplayTimer();
        if (el.playbackPlay) el.playbackPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

function advanceCarousel(dir) {
    if (state.carouselArticles.length === 0) return;
    
    let nextIdx = state.carouselIndex + dir;
    if (nextIdx >= state.carouselArticles.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = state.carouselArticles.length - 1;
    
    selectFeaturedArticle(state.carouselArticles[nextIdx], nextIdx);
}

// Toggle background video streams
function toggleVideoPlayback() {
    if (state.isVideoPlaying) {
        loadDefaultAmbientVideo();
    } else {
        const videoUrl = state.activeArticle.videoUrl || state.resolvedVideos[state.activeArticle.id];
        if (videoUrl) {
            playBackgroundVideo(videoUrl);
        } else {
            showToast("Resolving Video", "Crawling video streams for this headline...", "info");
            // Trigger resolution if not started
            if (state.resolvedVideos[state.activeArticle.id] === undefined) {
                resolveVideoLink(state.activeArticle).then(() => {
                    const freshUrl = state.resolvedVideos[state.activeArticle.id];
                    if (freshUrl) {
                        playBackgroundVideo(freshUrl);
                    } else {
                        showToast("Unavailable", "No video stream could be resolved for this article.", "warning");
                    }
                });
            }
        }
    }
}

function playBackgroundVideo(embedUrl) {
    if (!embedUrl) return;
    const iframe = document.getElementById('bg-youtube-iframe');
    if (iframe) {
        // Keep background cover visible (opacity 1) while loading the new video
        el.bgImageWrapper.style.opacity = '1';
        iframe.style.opacity = '0';
        
        // Extract video ID to use YT Player API if available
        const match = embedUrl.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        
        if (ytPlayer && typeof ytPlayer.loadVideoById === 'function' && match) {
            const vid = match[1];
            try {
                ytPlayer.loadVideoById({
                    videoId: vid,
                    suggestedQuality: 'default'
                });
                
                // Fade in the iframe after 1.5 seconds (estimated load time)
                setTimeout(() => {
                    if (state.isVideoPlaying) {
                        iframe.style.opacity = '1';
                        setTimeout(() => {
                            if (state.isVideoPlaying) el.bgImageWrapper.style.opacity = '0';
                        }, 150);
                    }
                }, 1500);
            } catch (err) {
                // Fail-safe fallback if player API fails
                iframe.src = embedUrl;
            }
        } else {
            // Fallback to changing iframe.src
            iframe.onload = () => {
                iframe.style.opacity = '1';
                setTimeout(() => {
                    if (state.isVideoPlaying) el.bgImageWrapper.style.opacity = '0';
                }, 150);
                iframe.onload = null;
            };
            iframe.src = embedUrl;
        }
    }
    
    state.isVideoPlaying = true;
    if (el.playVideoBtn) {
        el.playVideoBtn.querySelector('.play-btn-text').textContent = 'Stop Video';
        el.playVideoBtn.querySelector('i').className = 'fa-solid fa-square';
    }
    stopAutoplayTimer();
}

function loadDefaultAmbientVideo() {
    const iframe = document.getElementById('bg-youtube-iframe');
    if (iframe) {
        if (iframe.src !== AMBIENT_VIDEO_URL) {
            iframe.src = AMBIENT_VIDEO_URL;
        }
        iframe.style.opacity = '0';
    }
    
    // Fade in background image cover to hide ambient video loop
    el.bgImageWrapper.style.opacity = '1';
    
    state.isVideoPlaying = false;
    if (el.playVideoBtn) {
        el.playVideoBtn.querySelector('.play-btn-text').textContent = 'Play Video';
        el.playVideoBtn.querySelector('i').className = 'fa-solid fa-play';
    }
    
    if (state.isPlaying && state.isExplored) {
        startAutoplayTimer();
    }
}

// Bookmark storage toggle
function toggleActiveBookmarkState() {
    if (!state.activeArticle) return;
    const artId = state.activeArticle.id;
    const idx = state.bookmarks.indexOf(artId);
    
    if (idx > -1) {
        state.bookmarks.splice(idx, 1);
        showToast("Bookmark Removed", "Article removed from local reading list.", "success");
    } else {
        state.bookmarks.push(artId);
        showToast("Bookmark Saved", "Article pinned to local reading list.", "success");
    }
    
    localStorage.setItem('chronos_bookmarks_db', JSON.stringify(state.bookmarks));
    updateBookmarkIconUI(artId);
}

function updateBookmarkIconUI(artId) {
    if (!el.shareBookmarkBtn) return;
    const isBookmarked = state.bookmarks.includes(artId);
    const icon = el.shareBookmarkBtn.querySelector('i');
    
    if (isBookmarked) {
        el.shareBookmarkBtn.classList.add('active-bookmark');
        if (icon) icon.className = 'fa-solid fa-bookmark';
    } else {
        el.shareBookmarkBtn.classList.remove('active-bookmark');
        if (icon) icon.className = 'fa-regular fa-bookmark';
    }
}

// Split pane view
function renderSplitView() {
    // Default splits categories
    const leftArticles = filterBySearch(state.feeds.google['world'] || []);
    const rightArticles = filterBySearch(state.feeds.google['us'] || []);
    
    el.splitLeftCounter.textContent = `${leftArticles.length} articles`;
    el.splitRightCounter.textContent = `${rightArticles.length} articles`;
    
    el.splitLeftGrid.innerHTML = '';
    el.splitRightGrid.innerHTML = '';
    
    if (leftArticles.length === 0 && rightArticles.length === 0) {
        el.noArticlesFound.style.display = 'block';
        return;
    }
    
    const leftSorted = getSortedArticlesForDeck(leftArticles);
    const rightSorted = getSortedArticlesForDeck(rightArticles);
    
    leftSorted.forEach((art, idx) => {
        el.splitLeftGrid.appendChild(createNewsCard(art, idx, true));
    });
    
    rightSorted.forEach((art, idx) => {
        el.splitRightGrid.appendChild(createNewsCard(art, idx, true));
    });
}

// Sorting articles with images first
function getSortedArticlesForDeck(articles) {
    let sorted = [...articles];
    
    const hasImage = (art) => {
        if (art.imageUrl) return true;
        const cached = state.resolvedImages[art.id];
        return cached && cached !== 'none' && cached !== 'checking';
    };
    
    sorted.sort((a, b) => {
        const imgA = hasImage(a);
        const imgB = hasImage(b);
        
        if (imgA && !imgB) return -1;
        if (!imgA && imgB) return 1;
        
        return new Date(b.pubDate) - new Date(a.pubDate);
    });
    
    return sorted;
}

// Create Card layout
function createNewsCard(art, idx, isSplitPane = false) {
    const card = document.createElement('div');
    card.className = `nyt-scroll-card card-standard-img`;
    card.id = `card-${art.id}`;
    
    let sourceClass = 'nyt-card-meta';
    if (art.provider === 'newsapi') sourceClass = 'nyt-card-meta src-newsapi';
    else if (art.provider === 'newsdata') sourceClass = 'nyt-card-meta src-newsdata';
    else if (art.provider === 'mediastack') sourceClass = 'nyt-card-meta src-mediastack';

    let timeStr = 'Recent';
    if (art.pubDate) {
        const d = new Date(art.pubDate);
        if (!isNaN(d)) {
            timeStr = d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'}) + ' ' + 
                      d.toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit', hour12: false});
        }
    }

    let imageHTML = '';
    const imageUrl = art.imageUrl || state.resolvedImages[art.id];
    
    if (imageUrl) {
        imageHTML = `
            <div class="nyt-card-img-box">
                <img src="${imageUrl}" alt="news graphic" loading="lazy" onerror="this.parentElement.style.display='none'">
            </div>`;
    } else {
        imageHTML = `
            <div class="nyt-card-img-box" id="img-box-${art.id}">
                <div class="image-loading-placeholder"></div>
            </div>`;
        triggerGoogleImageResolution(art);
    }

    const linkTarget = state.openTarget;

    card.innerHTML = `
        ${imageHTML}
        <div class="nyt-card-body">
            <div class="${sourceClass}">
                <span class="meta-src">${art.source}</span>
                <span class="meta-time">${timeStr}</span>
            </div>
            <h3 class="nyt-card-title">
                <a href="${art.link}" target="${linkTarget}" rel="noopener noreferrer" class="nyt-card-title-link">${art.title}</a>
            </h3>
            <p class="nyt-card-snippet">${art.description || 'No description available.'}</p>
        </div>
    `;

    // Click handlers to open articles natively on text/image clicks
    const imgEl = card.querySelector('.nyt-card-img-box img');
    if (imgEl) {
        imgEl.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(art.link, linkTarget, 'noopener,noreferrer');
        });
    }

    const titleLink = card.querySelector('.nyt-card-title-link');
    if (titleLink) {
        titleLink.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(art.link, linkTarget, 'noopener,noreferrer');
        });
    }

    return card;
}

// On-the-fly resolver
async function triggerGoogleImageResolution(art) {
    if (state.resolvedImages[art.id] !== undefined) return;
    state.resolvedImages[art.id] = 'checking';
    
    try {
        const response = await fetch(`/api/get-image?url=${encodeURIComponent(art.link)}&title=${encodeURIComponent(art.title)}`);
        const result = await response.json();
        
        const imgBox = document.getElementById(`img-box-${art.id}`);
        
        if (result.success && result.image_url) {
            state.resolvedImages[art.id] = result.image_url;
            if (result.video_url) {
                state.resolvedVideos[art.id] = result.video_url;
            }
            
            if (imgBox) {
                imgBox.innerHTML = `<img src="${result.image_url}" alt="news graphic" style="opacity: 0; transition: opacity 0.4s ease" onload="this.style.opacity=1" onerror="handleImageFailure('${art.id}')">`;
                
                imgBox.querySelector('img').addEventListener('click', (e) => {
                    e.stopPropagation();
                    window.open(art.link, state.openTarget, 'noopener,noreferrer');
                });
            }
            
            // Refresh coordinates map cards
            if (state.carouselArticles.some(a => a.id === art.id)) {
                renderTimelineNodes();
            }
        } else {
            handleImageFailure(art.id);
        }
    } catch (e) {
        handleImageFailure(art.id);
    }
}

function handleImageFailure(articleId) {
    state.resolvedImages[articleId] = 'none';
    const card = document.getElementById(`card-${articleId}`);
    if (!card) return;
    
    const imgBox = document.getElementById(`img-box-${articleId}`) || card.querySelector('.nyt-card-img-box');
    if (imgBox) imgBox.remove();
    
    card.className = 'nyt-scroll-card card-text-only';
}

// Search filter helper
function filterBySearch(articles) {
    if (!state.searchQuery) return articles;
    return articles.filter(art => {
        return art.title.toLowerCase().includes(state.searchQuery) ||
               art.description.toLowerCase().includes(state.searchQuery) ||
               art.source.toLowerCase().includes(state.searchQuery);
    });
}

// Alerts
function showToast(title, desc, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `toast-item ${type === 'success' ? 'toast-success' : ''}`;
    const iconClass = type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation';
    
    toast.innerHTML = `
        <i class="${iconClass} toast-icon"></i>
        <div class="toast-msg-area">
            <span class="toast-title">${title}</span>
            <span class="toast-desc">${desc}</span>
        </div>
    `;
    
    el.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => {
            toast.remove();
        }, 250);
    }, 4500);
}

// Loading state
function showLoading(isLoading) {
    if (isLoading) {
        el.skeletonLoader.style.display = 'grid';
        el.magazineCanvas.classList.remove('active');
        el.splitCanvas.classList.remove('active');
        el.refreshIcon.classList.add('fa-spin');
        el.refreshBtn.disabled = true;
    } else {
        el.skeletonLoader.style.display = 'none';
        el.refreshIcon.classList.remove('fa-spin');
        el.refreshBtn.disabled = false;
        
        if (state.activeLayout === 'split') el.splitCanvas.classList.add('active');
        else el.magazineCanvas.classList.add('active');
    }
}

// Preferences
function savePreferences() {
    const preferences = {
        activeLayout: state.activeLayout,
        activeSource: state.activeSource,
        splitRightSource: state.splitRightSource,
        openTarget: state.openTarget
    };
    
    localStorage.setItem('chronos_default_preferences_v3', JSON.stringify(preferences));
    showToast("Preferences Pinned", "Your default layouts and categories are saved.", "success");
}

function loadPreferences() {
    const saved = localStorage.getItem('chronos_default_preferences_v3');
    if (!saved) return;
    
    try {
        const preferences = JSON.parse(saved);
        if (preferences.activeLayout) state.activeLayout = preferences.activeLayout;
        if (preferences.activeSource) state.activeSource = preferences.activeSource;
        if (preferences.splitRightSource) state.splitRightSource = preferences.splitRightSource;
        if (preferences.openTarget) state.openTarget = preferences.openTarget;
    } catch (e) {
        console.error("Error loading preferences:", e);
    }
}

// Share Composer modal
function openShareModal(art) {
    state.selectedArticle = art;
    
    const prefix = `📰 ${art.title}\n\n`;
    const suffix = `\n\nLink: ${art.link} via @chronos_deck`;
    const urlLengthForTwitter = 23;
    
    const prefixLen = prefix.length;
    const suffixLen = 8 + urlLengthForTwitter + 17;
    
    let headlineText = art.title;
    if (headlineText.length > (280 - suffixLen - 3)) {
        headlineText = headlineText.substring(0, (280 - suffixLen - 6)) + '...';
    }
    
    const draftText = `📰 ${headlineText}\n\nLink: ${art.link} via @chronos_deck`;
    
    el.tweetTextarea.value = draftText;
    el.previewHeadline.textContent = art.title;
    
    try {
        const u = new URL(art.link);
        el.previewDomain.textContent = u.hostname.replace('www.', '');
    } catch (e) {
        el.previewDomain.textContent = 'news.google.com';
    }
    
    updateCharCount();
    el.tweetModal.style.display = 'flex';
    el.tweetTextarea.focus();
}

function closeShareModal() {
    el.tweetModal.style.display = 'none';
    state.selectedArticle = null;
}

function getTwitterTextLength(text) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    let urlCount = 0;
    
    const tempText = text.replace(urlRegex, () => {
        urlCount++;
        return 'x'.repeat(23);
    });
    
    return tempText.length;
}

function updateCharCount() {
    const text = el.tweetTextarea.value;
    const len = getTwitterTextLength(text);
    
    el.charCounter.textContent = `${len} / 280`;
    
    if (len > 280) {
        el.charCounter.className = 'danger';
        el.postBtn.disabled = true;
    } else {
        el.postBtn.disabled = false;
        if (len > 250) el.charCounter.className = 'warning';
        else el.charCounter.className = '';
    }
}

function launchTweetIntent() {
    const text = el.tweetTextarea.value;
    const encodedText = encodeURIComponent(text);
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    window.open(intentUrl, '_blank', 'noopener,noreferrer');
    closeShareModal();
}

function expandCardsDeck(shouldExpand) {
    const container = document.getElementById('headlines-deck-list');
    const handle = document.getElementById('deck-pull-handle');
    if (!container) return;
    
    if (shouldExpand) {
        container.classList.add('deck-expanded');
        if (handle) {
            handle.innerHTML = '<i class="fa-solid fa-chevron-down"></i> <span>Return to Canvas</span>';
            handle.style.position = 'fixed';
            handle.style.bottom = '80vh';
            handle.style.zIndex = '1900';
            handle.style.borderRadius = '4px 4px 0 0';
        }
        showToast("Expanded View", "Displaying all available headlines in catalog deck.", "info");
    } else {
        container.classList.remove('deck-expanded');
        if (handle) {
            handle.innerHTML = '<i class="fa-solid fa-chevron-up"></i> <span>Pull Up to Expand</span>';
            handle.style.position = 'static';
            handle.style.zIndex = '100';
            handle.style.borderRadius = '4px 4px 0 0';
        }
        showToast("Cinematic View", "Restored main editorial canvas.", "info");
    }
}
