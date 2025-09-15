#!/bin/bash

set -euo pipefail


fail() {
    echo "Failed!"
    exit 1
}

echo "TC1: autodiscover feed"
output=$( node bot/crawler.js --test lzone.de )
echo "$output" | grep -q "u: 'https://lzone.de//feed/devops.xml'" || fail

echo "TC2: feed type atom"
# Reuse TC1 crawl result
echo "$output" | grep -q "f: 'atom'" || fail

echo "TC3: feed title"
# Reuse TC1 crawl result
echo "$output" | grep -q "n: 'DevOps Blog Feed'" || fail

echo "TC4: Cloudflare adult filter"
output=$( node bot/crawler.js --test pornhub.com )
echo "$output" | grep -q "Skipping pornhub.com - not resolvable" || fail

echo "TC5: Comment feeds are ignored"
output=$( node bot/crawler.js --test cookiedatabase.org )
echo "$output" | grep -q "u: 'https://cookiedatabase.org/comments/feed/'" && fail || true