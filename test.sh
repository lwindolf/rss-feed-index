#!/bin/bash

set -euo pipefail

DIRNAME=$(dirname "$(readlink -f "$0")")
TMPDIR=$(mktemp -d)

trap 'rm -rf "$TMPDIR"' EXIT

fail() {
    echo "Failed!"
    exit 1
}

echo "TC1: autodiscover feed"
output=$( node bot/crawler.js --test https://lzone.de )
echo "$output" | grep -qF "u: 'https://lzone.de/feed/devops.xml'" || fail

echo "TC2: feed type atom"
# Reuse TC1 crawl result
echo "$output" | grep -qF "f: 'atom'" || fail

echo "TC3: feed title"
# Reuse TC1 crawl result
echo "$output" | grep -qF "n: 'DevOps Blog Feed'" || fail

echo "TC4: minor flag is 3 (1=fediverse + 2=indieweb + 64=blogroll)"
# Reuse TC1 crawl result
echo "$output" | grep -qF "M: 67" || fail

echo "TC5: minor flag is 16 (16=wordpress)"
output=$( node bot/crawler.js --test https://thehoopdoctors.com/ )
echo "$output" | grep -qF "M: 16" || fail

echo "TC6: Cloudflare adult filter"
output=$( node bot/crawler.js --test https://pornhub.com )
echo "$output" | grep -qF "Skipping pornhub.com - not resolvable" || fail

echo "TC7: Comment feeds are ignored"
output=$( node bot/crawler.js --test https://cookiedatabase.org )
echo "$output" | grep -qF "u: 'https://cookiedatabase.org/comments/feed/'" && fail || true

echo "TC8: <link rel=\"blogroll\"> discovery"
output=$( node bot/crawler.js --test https://roytang.net )
echo "$output" | grep -qF "blogroll: 'https://roytang.net" || fail

echo "TC9: micro.blog OPML discovery"
output=$( node bot/crawler.js --test https://john.philpin.com/ )
echo "$output" | grep -qF "blogroll: 'https://john.philpin.com/.well-known/recommendations.opml'" || fail

echo "TC10: LiveJournal OPML discovery"
output=$( node bot/crawler.js --test https://zaitcev.livejournal.com/ )
echo "$output" | grep -qF "blogroll: 'http://www.livejournal.com/tools/opml.bml?user=" || fail

echo "TC11: https:// prefix is stripped from resulting URLs"
(
    cd $TMPDIR
    test -f index.json && rm index.json
    echo "https://lzone.de" >domains.txt
    output=$( node $DIRNAME/bot/crawler.js --add domains.txt )
    grep -qF '"lzone.de":' index.json || fail
)

echo "TC12: trailing slash is stripped from URL"
(
    cd $TMPDIR
    test -f index.json && rm index.json
    echo "https://lzone.de/" >domains.txt
    output=$( node $DIRNAME/bot/crawler.js --add domains.txt )
    grep -qF '"lzone.de":' index.json || fail
)