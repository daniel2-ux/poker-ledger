#!/bin/sh
# Build and publish dist/ to the gh-pages branch, which GitHub Pages serves.
set -e
npm run build
cd dist
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy"
git push -f -q https://github.com/daniel2-ux/poker-ledger.git gh-pages
rm -rf .git
echo "Deployed"
