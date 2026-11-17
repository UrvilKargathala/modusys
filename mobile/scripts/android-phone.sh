#!/bin/sh
# Build and launch the app on a USB-connected Android phone.
# Works in any terminal tab, even one opened before ~/.zshrc set ANDROID_HOME.
set -e

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$PATH:$ANDROID_HOME/platform-tools"

# The phone reaches the local backend (npm run dev in ~/modusys) at localhost:3001.
# Site photos upload straight to the staging storage (the SSH tunnel on port 3900), so forward that too.
# run-android forwards Metro's port 8081 itself.
adb reverse tcp:3001 tcp:3001
adb reverse tcp:3900 tcp:3900

exec npx react-native run-android "$@"
