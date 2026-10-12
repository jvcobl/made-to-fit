#!/usr/bin/env bash
# Build the website version of the game and publish it to the gh-pages branch, which GitHub Pages serves at
# https://jvcobl.github.io/made-to-fit/
#
#   bash scripts/deploy-pages.sh
#
# Run it from a clean checkout after the tests pass. The source stays on main; gh-pages holds only the built site
# (index.html, the link-preview image, the icons and .nojekyll), one commit per deploy, each naming the main commit it
# came from. Set DEPLOY_MSG_EXTRA to append lines (for example commit trailers) to the deploy commit message.
set -euo pipefail
cd "$(dirname "$0")/.."
REMOTE="${REMOTE:-origin}"

if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or stash your changes first, so the deploy can say which commit it came from." >&2
  exit 1
fi
SRC_REV="$(git rev-parse --short HEAD)"

node build.mjs site

WT="$(mktemp -d)"
cleanup() { git worktree remove --force "$WT" >/dev/null 2>&1 || true; rm -rf "$WT"; git worktree prune; }
trap cleanup EXIT

if git ls-remote --exit-code --heads "$REMOTE" gh-pages >/dev/null 2>&1; then
  git fetch -q "$REMOTE" gh-pages
  git worktree add -q -B gh-pages "$WT" "$REMOTE/gh-pages"
else
  # first deploy: start gh-pages with no history from main
  git worktree add -q --detach "$WT"
  git -C "$WT" checkout -q --orphan gh-pages
  git -C "$WT" rm -rq --cached . >/dev/null
fi

# replace everything on the branch with the fresh build
find "$WT" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -R dist/site/. "$WT"/
git -C "$WT" add -A
if git -C "$WT" diff --cached --quiet; then
  echo "The site on gh-pages already matches this build. Nothing to push."
  exit 0
fi
MSG="Deploy the site from $SRC_REV"
if [ -n "${DEPLOY_MSG_EXTRA:-}" ]; then MSG="$MSG"$'\n\n'"$DEPLOY_MSG_EXTRA"; fi
git -C "$WT" -c user.name="${DEPLOY_NAME:-Claude}" -c user.email="${DEPLOY_EMAIL:-noreply@anthropic.com}" commit -q -m "$MSG"
git -C "$WT" push -q "$REMOTE" gh-pages
echo "Pushed gh-pages ($(git -C "$WT" rev-parse --short HEAD)). GitHub Pages usually shows it within a minute or two."
