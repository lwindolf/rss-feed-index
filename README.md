
# RSS Feed Index

This repo hosts

1. a crawler for news feeds (RSS, Atom, ...)
2. the current crawling result `index.json` for the [majestic million websites](https://majestic.com/reports/majestic-million) which
is [CC BY Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/deed.en) licensed.
3. a Github Pages [site](https://lwindolf.github.io/rss-feed-index/) to test the results

## Feed Catalog Format

The catalog JSON stored as `index.json` has the following format

    {
        "example.com" : {
            "n" : "Example.com feed",
            "u" : "https://example.com/feed.xml",
            "t" : 134,
            "f" : "rss",
            "ns" : [ "syn", "wfw", "dc" ],
            "r" : 123456,
            "d" : 1757110273
        }
    }

The meaning of the fields being

| Field | Description                                            |
|-------|--------------------------------------------------------|
| <key> | Domain                                                 |
| n     | Feed title                                             |
| i     | Feed description                                       |
| u     | URL to feed                                            |
| t     | Average score of characters in item description        |
| f     | Feed type "rss", "atom", "json"                        |
| ns    | Namespaces / Features discovered                       |
| r     | Majestic million rank (optional)                       |
| d     | Last update timestamp of the feed                      |

All of the text fields are to be considered UTF-8 plain text and might need escaping.

## Crawler Usage

    wget https://downloads.majestic.com/majestic_million.csv
    npm i
    npm run crawl

## Crawler Ethics

- robots.txt is respected
- feed discovery only on domain root no traversal
- 1 update/check request per feed per month max
- no retries
- no parallel crawling

Effectivley most sites without a feed should be hit by 2 requests only.
All sites having feeds should see 2+nr of feeds (specified by `<link rel="alternate" ...>`) requests.

Crawler user agent is

    Mozilla/5.0 (compatible; rss-feed-index-bot/0.9; +https://github.com/lwindolf/rss-feed-index)

## Website Build

Prepare for deployment run:

    npm i
    npm run build-www

Test locally with `npx serve www`
