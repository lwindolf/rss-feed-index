#!/bin/bash

# Fetches all blogrolls from index.json and prints htmlUrl (preferred) or xmlUrl values to stdout
while read -r blogroll; do
    echo "===> Processing $blogroll" >&2
    ( curl -sL "$blogroll" || true ) |\
    ( egrep "outline.*(htmlUrl|xmlUrl)" || true ) |\
    sed -e 's/^.*htmlUrl=.\([^"'"'"']*\).*$/\1/' \
        -e 's/^.*xmlUrl=.\([^"'"'"']*\).*$/\1/'
done < <(
    $(dirname "$0")/opml-all.js | jq -r ".blogrolls | keys | .[]"
) |\
sort -u

echo "Done." >&2
