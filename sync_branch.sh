#!/bin/bash

# Configuration: Set the name of your main branch (usually 'main' or 'master')
MAIN_BRANCH="main"

# Get the name of the branch you are currently on
CURRENT_BRANCH=$(git branch --show-current)

# Ensure you aren't accidentally trying to merge main into main
if [ "$CURRENT_BRANCH" == "$MAIN_BRANCH" ]; then
    echo " You are currently on '$MAIN_BRANCH'."
    echo "   Switch to your custom branch first using: git checkout <your-branch>"
    exit 1
fi

echo "------------------------------------------------"
echo " Syncing '$CURRENT_BRANCH' with '$MAIN_BRANCH'..."
echo "------------------------------------------------"

# 1. Check for uncommitted changes
# It is unsafe to merge if you have dirty work in progress.
if ! git diff-index --quiet HEAD --; then
    echo " Error: You have uncommitted changes."
    echo "    Please commit (git commit -m '...') or stash (git stash) them before syncing."
    exit 1
fi

# 2. Fetch the latest changes from the remote origin
echo "⬇️   Fetching latest changes from origin/$MAIN_BRANCH..."
git fetch origin $MAIN_BRANCH

# 3. Merge origin/main into the current branch
echo "🔀  Merging 'origin/$MAIN_BRANCH' into '$CURRENT_BRANCH'..."
if git merge origin/$MAIN_BRANCH; then
    echo "------------------------------------------------"
    echo " Success! '$CURRENT_BRANCH' is now up to date."
    echo "------------------------------------------------"
else
    echo "------------------------------------------------"
    echo " CONFLICT DETECTED!"
    echo "    Automatic merge failed. Please fix the conflicts in your code,"
    echo "    then run: git add . && git commit"
    echo "------------------------------------------------"
    exit 1
fi