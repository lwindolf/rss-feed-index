// vim: set ts=4 sw=4:

import Config from 'config.js';
import fetch from 'node-fetch';

// Simple fetch wrapper with timeout handling
//
// Note: do not use DOMJS fetch as it does not support timeout handling

async function pfetch(url, options = {}) {
    const controller = globalThis.AbortController;
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    options.signal = controller.signal;
    options.headers['User-Agent'] = Config.userAgent;

    try {
        return await fetch(url, options);
    } catch (error) {
        console.error("Fetch error:", error);
    } finally {
        clearTimeout(timeoutId);
    }
}

export { pfetch };