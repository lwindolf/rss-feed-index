#!/usr/bin/bash


# Use a CSV of Wiby websites to cover the smolnet
# filter out webarchive.me/geocities to avoid useless
# crawling load

curl https://raw.githubusercontent.com/plumkewe/wiby-websites-list/refs/heads/main/websites.csv |\
grep -v webarchive.me.geocities |\
grep "^[0-9][0-9]*;htt[ps]*://" |\
cut -d";" -f2
