#!/usr/bin/bash


# smolweb domain source
curl https://raw.githubusercontent.com/kevquirk/512kb.club/refs/heads/main/_data/sites.yml |\
grep url: |\
cut -d: -f2-100 |\
sed "s/^ *//"

