// vim: set ts=4 sw=4:

export class Config {
    static userAgent = 'Mozilla/5.0 (compatible; rss-feed-index-bot/0.9; +https://github.com/lwindolf/rss-feed-index)';
    static botName = 'rss-feed-index-bot/0.9';
    static maxRedirects = 15;
    static maxFeedSize = 10 * 1024 * 1024;

    // URLs containing those strings won't be processed
    static urlBlockRegex = /(\/comments\/feed|www\.youtube\.com|\/wp-json\/wp\/v2\/pages)/;
};
