#!/bin/bash

# Fetches all blogrolls from index.json and prints htmlUrl values to stdout
while read -r blogroll; do
    echo "===> Processing $blogroll" >&2
    ( curl -sL "$blogroll" || true ) |\
    ( grep "outline.*htmlUrl" || true ) |\
    sed 's/^.*htmlUrl=.\([^"'"'"']*\).*$/\1/'
done < <(jq -r '.blogrolls | keys | .[]' "$(dirname "$0")/../index.json")

echo "Done." >&2