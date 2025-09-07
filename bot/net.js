// vim: set ts=4 sw=4:

// Simple fetch wrapper to allow for automatic CORS proxy

import { Config } from './config.js';

// Fetch and URL normally or via CORS proxy
async function pfetch(url, options = {}, CORS = false) {
    options.headers = {
        ...options.headers,
        'User-Agent': 'Mozilla/5.0 (compatible; rss-feed-index-bot/0.9; +https://github.com/lwindolf/rss-feed-index)'
    };

    if (!CORS)
        return await fetch(url, options);

    // We expect only CORS proxy URLs where we just need to add the encoded URL
    return await fetch(Config.corsProxy+encodeURI(url), options);
}

export { pfetch };