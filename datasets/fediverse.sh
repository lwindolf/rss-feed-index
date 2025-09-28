#!/bin/bash

set -euo pipefail

# Note rate limit is 300 requests per 5 minutes
INSTANCE=mastodon.social
COUNT=40
PAGES=25

p=0
next="https://$INSTANCE/api/v1/timelines/public?local=false&limit=$COUNT"
while [ $p -lt $PAGES ]; do
    if [ $p -gt 0 ]; then
        echo "Page $p ($next)" >&2
        sleep 1
    fi
    json=$(curl -s "$next")
    next=$(curl -sI "$next" | grep "^link:" | sed "s/,/\n/g" | grep 'rel="next"' | sed "s/.*<//;s/>.*//")
    input=$(echo "$json" | jq .[].content )
    
    # Use a temporary array to store unique domains
    declare -A domains

    # Note double escaped \" because that's how it appears in the JSON"
    # Use regex to extract links
    while [[ $input =~ href=\\\"(https?://[^\\]+)\\ ]]; do
        # Extract the full URL
        url="${BASH_REMATCH[1]}"

        # Extract the domain using regex
        if [[ $url =~ ^https?://([^/]+) ]]; then
            domain="${BASH_REMATCH[1]}"
            domains["$domain"]=1  # Store unique domains in an associative array
        fi
        
        # Remove the matched part from the string
        input=${input#*"${BASH_REMATCH[0]}"}
    done

    max_id=$(echo "$json" | jq '.[-1].id')
    p=$((p+1))
done

# Print unique domains
for domain in "${!domains[@]}"; do
        echo "$domain"
done | sort