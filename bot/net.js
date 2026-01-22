// vim: set ts=4 sw=4:

// Simple fetch override to allow for automatic timeouts and retry handling

import { Config } from './config.js';
import { request as httpsRequest } from 'https';
import { request as httpRequest } from 'http';

/* allows to use the exported fetch as default fetch */
const originalFetch = globalThis.fetch.bind(globalThis);

// Simple fetch wrapper with timeout handling using Node.js native requests
//
// Handles extra option redirectCount and cancels after Config.maxRedirects is
// reached and adds an abort controller with 30s timeout
globalThis.fetch = async function(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    options.signal = controller.signal;

    const { method = 'GET', headers = {}, body } = options;

    return new Promise((resolve, reject) => {
        const isHttps = url.startsWith('https://');
        const requestFn = isHttps ? httpsRequest : httpRequest;

        const req = requestFn(url, { method, headers, timeout: 10000 }, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;

                // Skip overly large responses
                if (data.length > Config.maxFeedSize) {
                    req.destroy();
                    reject(new Error('Response too large'));
                }
            });

            res.on('end', () => {
                clearTimeout(timeoutId);
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    if ((options.redirectCount || 0) < Config.maxRedirects) {
                        // Follow redirect
                        let netLocation = res.headers.location;
                        if (!netLocation.startsWith('http')) {
                            // Handle relative redirects
                            const baseUrl = new URL(url);
                            netLocation = new URL(netLocation, baseUrl).href;
                        }

                        console.log(`-> Redirecting to ${netLocation}`);
                        options.redirectCount = (options.redirectCount || 0) + 1;
                        fetch(netLocation, options)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        reject(new Error('Too many redirects'));
                    }
                    return;
                } else if (res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(`HTTP Error: ${res.statusCode}`));
                    return;
                }
                resolve(data);
            });
        });

        req.on('error', (error) => {
            console.error("Request error:", error);
            clearTimeout(timeoutId);
            reject(error);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timed out'));
        });

        if (body) {
            req.write(body);
        }

        req.end();
    });
}