#!/usr/bin/bash


# Links from smallnet webring xxiivv.com
#
# While xxiivv provides RSS links we need the website link, so filtering is done on the websites

curl -s "https://webring.xxiivv.com/" |\
grep "a href=" |\
grep -v 'class="rss"' |\
sed 's/^.*href="\([^"]*\)".*$/\1/'
