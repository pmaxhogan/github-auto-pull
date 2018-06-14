#!/bin/sh
set -e

npm install -g pkg
mkdir build >/dev/null 2>&1 || true
pkg . --out-path build/
echo "Built to build/"
