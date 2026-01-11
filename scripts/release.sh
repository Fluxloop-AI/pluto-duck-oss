#!/bin/bash
set -e

# Release script for Pluto Duck
# Usage: ./scripts/release.sh [version]
# Example: ./scripts/release.sh 0.2.3
#          ./scripts/release.sh (uses version from tauri.conf.json)

cd "$(dirname "$0")/.."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Pluto Duck Release Script"
echo "========================================="

# Get version from argument or tauri.conf.json
if [ -n "$1" ]; then
    VERSION="$1"
else
    VERSION=$(grep -o '"version": "[^"]*"' tauri-shell/src-tauri/tauri.conf.json | head -1 | cut -d'"' -f4)
fi

if [ -z "$VERSION" ]; then
    echo -e "${RED}Error: Could not determine version${NC}"
    exit 1
fi

TAG="v$VERSION"

echo -e "${YELLOW}Version: $VERSION${NC}"
echo -e "${YELLOW}Tag: $TAG${NC}"
echo ""

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}Uncommitted changes detected. Staging all changes...${NC}"
    git add .
    
    echo ""
    echo "Changed files:"
    git status --short
    echo ""
    
    read -p "Enter commit message (or press Enter for default): " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
        COMMIT_MSG="release: v$VERSION"
    fi
    
    git commit -m "$COMMIT_MSG"
    echo -e "${GREEN}✓ Changes committed${NC}"
fi

# Push to main
echo ""
echo "Pushing to main branch..."
git push origin main
echo -e "${GREEN}✓ Pushed to main${NC}"

# Check if tag exists locally
if git rev-parse "$TAG" >/dev/null 2>&1; then
    echo ""
    echo -e "${YELLOW}Tag $TAG already exists locally.${NC}"
    read -p "Delete and recreate? (y/N): " RECREATE
    if [[ "$RECREATE" =~ ^[Yy]$ ]]; then
        git tag -d "$TAG"
        echo -e "${GREEN}✓ Deleted local tag${NC}"
        
        # Also delete remote tag if exists
        if git ls-remote --tags origin | grep -q "refs/tags/$TAG"; then
            git push origin ":refs/tags/$TAG"
            echo -e "${GREEN}✓ Deleted remote tag${NC}"
        fi
    else
        echo "Aborted."
        exit 0
    fi
fi

# Create and push tag
echo ""
echo "Creating tag $TAG..."
git tag "$TAG"
echo -e "${GREEN}✓ Tag created${NC}"

echo ""
echo "Pushing tag to origin..."
git push origin "$TAG"
echo -e "${GREEN}✓ Tag pushed${NC}"

echo ""
echo "========================================="
echo -e "${GREEN}Release $TAG triggered!${NC}"
echo "========================================="
echo ""
echo "GitHub Actions will now:"
echo "  1. Build macOS app (Apple Silicon + Intel)"
echo "  2. Sign and notarize the app"
echo "  3. Create GitHub Release with artifacts"
echo "  4. Update latest.json on GitHub Pages"
echo ""
echo "Monitor progress at:"
echo "  https://github.com/Fluxloop-AI/pluto-duck-oss/actions"
echo ""
echo "Release will be available at:"
echo "  https://github.com/Fluxloop-AI/pluto-duck-oss/releases/tag/$TAG"
