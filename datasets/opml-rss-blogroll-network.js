#!/usr/bin/env node

import YAML from 'yaml';

// Fetch https://raw.githubusercontent.com/robalexdev/rss-blogroll-network/refs/heads/main/feeds.yaml
await fetch("https://raw.githubusercontent.com/robalexdev/rss-blogroll-network/refs/heads/main/feeds.yaml")
    .then(response => response.text())
    .then(data => {
        // Extract YAML array key "feed_urls"
        const parsed = YAML.parse(data);
        let output = { blogrolls: {} };
        parsed.feed_urls.forEach(url => {
            if (!url.startsWith('file://')) {
                output.blogrolls[url] = { u: url };
            }
        });
        console.log(JSON.stringify(output));
    });
