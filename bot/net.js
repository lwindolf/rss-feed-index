// vim: set ts=4 sw=4:

// Simple fetch wrapper with timeout handling

async function pfetch(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    options.headers = {
        ...options.headers,
        signal: controller.signal,
        'User-Agent': 'Mozilla/5.0 (compatible; rss-feed-index-bot/0.9; +https://github.com/lwindolf/rss-feed-index)'
    };

    try {
        return await fetch(url, options);
    } catch (error) {
        console.error("Fetch error:", error);
    } finally {
        clearTimeout(timeoutId);
    }
}

export { pfetch };