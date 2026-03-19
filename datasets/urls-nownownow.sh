#!/bin/bash

curl -sL https://nownownow.com/nownownow.txt | awk '{print $NF}' | sed "s/\/now\/*//"
