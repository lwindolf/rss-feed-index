#!/bin/bash

set -euo pipefail


jq .meta index/index.json

cat <<EOT >index/commit-status.json
{
  "meta": {
    "name": "RSS Feed Daily Index Commit",
    "favicon": "https://lwindolf.github.io/rss-feed-index/feed.svg",
    "links": {
      "Website": "https://lwindolf.github.io/rss-feed-index",
      "Source": "https://github.com/lwindolf/rss-feed-index"
    }
  },
  "data": {
  },
  "schedule": {
    "lastUpdate": $(date +%s),
    "refresh": 36000,
    "maxAge": 129000
  }
}
EOT

git commit -m 'Update index' index/index.json
git push
