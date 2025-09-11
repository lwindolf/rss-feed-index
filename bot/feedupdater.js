// vim: set ts=4 sw=4:

// Download, parse and merge feeds

import { parserAutoDiscover } from './parsers/autodiscover.js';
import { Feed } from './feed.js';
import { pfetch } from './net.js';

export class FeedUpdater {
    // returns a feed properties or at least error code (e.g. "{ error: Feed.ERROR_XML }")
    // result should be merged into the feed being updated
    static async fetch(url, corsProxyAllowed = false) {
        console.info(`-> Fetching ${url}`);
        var feed = await pfetch(url, {}, corsProxyAllowed)
            .then(async (str) => {
                if (str) {
                    let parser = parserAutoDiscover(str, url);
                    if(!parser)
                        return new Feed({ error: Feed.ERROR_DISCOVER });

                    let feed = parser.parse(str);
                    if(!feed) {
                        console.error(`Failed to parse feed from ${url}`);
                        return new Feed({ error: Feed.ERROR_XML });
                    }
                    feed.source = url;
                    feed.error = Feed.ERROR_NONE;
                    return feed;
                } else {
                    return new Feed({ error: Feed.ERROR_NET });
                }
            })
            .catch((e) => {
                console.error(e);
                return new Feed({ error: Feed.ERROR_NET });
            });
        return feed;
    }
}