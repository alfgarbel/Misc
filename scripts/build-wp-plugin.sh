#!/bin/sh
# Builds public/downloads/ogsmith-wordpress.zip from wordpress-plugin/ogsmith.
# File times are pinned so the same source always gives the same zip.
set -e
cd "$(dirname "$0")/../wordpress-plugin"
out=../public/downloads/ogsmith-wordpress.zip
mkdir -p ../public/downloads
rm -f "$out"
find ogsmith -exec touch -t 202601010000 {} +
zip -X -q -r "$out" ogsmith
echo "Wrote public/downloads/ogsmith-wordpress.zip"
