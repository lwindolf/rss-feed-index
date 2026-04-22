
# RSS Feed Index

This repo hosts

1. a crawler for news feeds (RSS, Atom, ...)
2. the current crawling result `index.json`
3. a Github Pages [site](https://lwindolf.github.io/rss-feed-index/) to test the results

## Crawler Usage

First set up the repo

    git submodule init
    git submodule update

    npm i

and then run
    
    datasets/urls_majestic.sh >domains.txt
    npm run crawl -- --add domains.txt

or run a crawl on the existing index with

    rpn run crawl

After a completed crawl start a new one with 

    npm run crawl -- --restart

## Crawler Ethics

- robots.txt is respected
- feed discovery only on domain root no traversal
- minimal traffic
  - 1 update/check request per feed per month max
  - almost no retries
  - no parallel crawling on a domain
- filtering of domains using Cloudflares family filter (1.1.1.3 resolver) to avoid malware and adult content

Effectivly most sites without a feed should be hit by 2 requests only.
All sites having feeds should see 2+nr of feed links (as specified by `<link rel="alternate" ...>` and `<link rel="blogroll" ...>`) requests and redirects.

Crawler user agent is

    Mozilla/5.0 (compatible; rss-feed-index-bot/0.9; +https://github.com/lwindolf/rss-feed-index)

## Website Build

Prepare for deployment run:

    npm i
    npm run build-www

Test locally with `npx serve www`

## Index Format

### Feed Catalog Format

The catalog JSON stored as `index.json` and a reduced version when built as `www/data/url-feeds.json` has the following format

    {
        "example.com" : [{
            "n" : "Example.com feed",
            "i" : "Description of example.com feed",
            "u" : "https://example.com/feed.xml",
            "t" : 134,
            "f" : "rss",
            "ns" : [ "syn", "wfw", "dc" ],
            "d" : 1757110273,
            "c" : 1757082347,
            "m" : 0
        }]
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
| m     | Feed has enclosures (1=audio, 2=video, 3=both)         |
| ns    | Namespaces / Features discovered                       |
| r     | Timestamp of most recent item in the feed              |
| d     | Timestamp of last crawl of the feed                    |
| M     | "minor" communities bitmask, meaning defined by `.meta.minorBitmask` |

All of the text fields are to be considered UTF-8 plain text and might need escaping.

### Blogroll Catalog Format

The blogroll catalog JSON stored as `www/data/blogroll.json` has the following format

    "https://cdn.lazaruscorporation.co.uk/blogs/2/442/british-weird-rss-starter-pack.xml": {
      "u": "https://cdn.lazaruscorporation.co.uk",
      "t": "British Weird RSS Starter Pack",
      "n": 16,
      "d": 1776190669,
      "D": "cdn.lazaruscorporation.co.uk",
      "M": 4
    },

The meaning of the fields being

| Field | Description                                            |
|-------|--------------------------------------------------------|
| <key> | OPML URL                                               |
| t     | OPML title                                             |
| u     | URL to homepage (optional)                             |
| n     | Number of feeds                                        |
| d     | Timestamp of last crawl of the OPML                    |
| M     | bitmask (1=web, 2=catalog, 4=planet)                   |

All of the text fields are to be considered UTF-8 plain text and might need escaping.

