#!/bin/bash

curl -sL https://url.town/rss | grep "<link>" | sed "s/.*<link>//;s/<\/link>.*//"
