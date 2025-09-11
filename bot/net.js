// vim: set ts=4 sw=4:

import { Config } from './config.js';
import { request as httpsRequest } from 'https';
import { request as httpRequest } from 'http';

// Simple fetch wrapper with timeout handling using Node.js native requests

async function pfetch(url, options = {}, redirectCount = 0) {
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
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    if (redirectCount < Config.maxRedirects) {
                        // Follow redirect
                        console.log(`-> Redirecting to ${res.headers.location}`);
                        pfetch(res.headers.location, options, redirectCount + 1)
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

export { pfetch };