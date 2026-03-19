#!/bin/bash
echo "Cleaning extended attributes and re-signing native modules..."
xattr -cr .
codesign --force --deep --sign - node_modules/better-sqlite3/build/Release/better_sqlite3.node
codesign --force --deep --sign - node_modules/electron/dist/Electron.app/Contents/MacOS/Electron
echo "Done! You can now run 'npm run dev'."
