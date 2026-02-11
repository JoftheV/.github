#!/bin/bash

# ==============================================================================
#  HIGH-PERFORMANCE IOS BUILD SCRIPT
#  Architecture: MVVM-C / VIPER
#  Optimized for: Speed, Parallelism, and CI/CD Automation
# ==============================================================================

set -euo pipefail

# --- CONFIGURATION (EDIT THESE) ---
PROJECT_NAME="YourApp"
SCHEME_NAME="YourApp-Production"  # Ensure this scheme is 'Shared' in Xcode
BUNDLE_ID="com.you.yourapp"
IS_WORKSPACE=false                 # Set true if using CocoaPods/SPM workspace

# Paths
OUTPUT_DIR="./Builds"
ARCHIVE_PATH="$OUTPUT_DIR/$PROJECT_NAME.xcarchive"
EXPORT_PATH="$OUTPUT_DIR/IPA"
PLIST_PATH="./$PROJECT_NAME/Info.plist"
EXPORT_OPTIONS_PLIST="./exportOptions.plist" # Create this via Xcode -> Export for a template
SPM_CACHE_DIR="./SourcePackages"
TEST_RESULTS_PATH="$OUTPUT_DIR/TestResults"

# Performance Flags
THREADS="$(sysctl -n hw.ncpu)" # Use all available cores
START_TIME=$SECONDS

# Colors for formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ==============================================================================
#  FUNCTIONS
# ==============================================================================

echo_stage() {
    echo -e "\n${CYAN}====================================================${NC}"
    echo -e "${CYAN}🚀  $1${NC}"
    echo -e "${CYAN}====================================================${NC}\n"
}

check_status() {
    if [ "$1" -ne 0 ]; then
        echo -e "\n${RED}❌  Build Failed at stage: $2${NC}"
        exit 1
    fi
}

require_file() {
    if [ ! -f "$1" ]; then
        echo -e "${RED}❌  Required file not found: $1${NC}"
        exit 1
    fi
}

setup_env() {
    mkdir -p "$OUTPUT_DIR" "$EXPORT_PATH" "$SPM_CACHE_DIR"

    if ! command -v xcodebuild >/dev/null 2>&1; then
        echo -e "${RED}❌  xcodebuild is required but not available in PATH.${NC}"
        exit 1
    fi

    require_file "$PLIST_PATH"
    require_file "$EXPORT_OPTIONS_PLIST"

    if [ "$IS_WORKSPACE" = true ]; then
        CONTAINER_FILE="${PROJECT_NAME}.xcworkspace"
        FILE_FLAG=(-workspace "$CONTAINER_FILE")
    else
        CONTAINER_FILE="${PROJECT_NAME}.xcodeproj"
        FILE_FLAG=(-project "$CONTAINER_FILE")
    fi

    require_file "$CONTAINER_FILE"
}

run_archive() {
    if command -v xcbeautify >/dev/null 2>&1; then
        xcodebuild archive \
            "${FILE_FLAG[@]}" \
            -scheme "$SCHEME_NAME" \
            -archivePath "$ARCHIVE_PATH" \
            -configuration Release \
            -sdk iphoneos \
            COMPILER_INDEX_STORE_ENABLE=NO \
            SWIFT_COMPILATION_MODE=wholemodule \
            | xcbeautify
        return ${PIPESTATUS[0]}
    fi

    xcodebuild archive \
        "${FILE_FLAG[@]}" \
        -scheme "$SCHEME_NAME" \
        -archivePath "$ARCHIVE_PATH" \
        -configuration Release \
        -sdk iphoneos \
        COMPILER_INDEX_STORE_ENABLE=NO \
        SWIFT_COMPILATION_MODE=wholemodule
}

# ==============================================================================
#  EXECUTION FLOW
# ==============================================================================

setup_env

# 1. CLEANUP & DEPENDENCIES
echo_stage "Cleaning & Resolving Dependencies"

# Note: Skipping 'clean' action can speed up local incremental builds.
# For CI/CD, clean is recommended.
xcodebuild clean "${FILE_FLAG[@]}" -scheme "$SCHEME_NAME" -quiet

# Resolve SPM packages concurrently
xcodebuild -resolvePackageDependencies \
    "${FILE_FLAG[@]}" \
    -scheme "$SCHEME_NAME" \
    -clonedSourcePackagesDirPath "$SPM_CACHE_DIR" \
    -jobs "$THREADS"

check_status $? "Dependency Resolution"

# 2. VERSIONING (Auto-Increment Build Number)
echo_stage "Bumping Build Number"
CURRENT_VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$PLIST_PATH")
BUILD_NUMBER=$(date +%Y%m%d%H%M) # Timestamp-based build number

/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" "$PLIST_PATH"
echo -e "${GREEN}Version: $CURRENT_VERSION ($BUILD_NUMBER)${NC}"

# 3. RUN TESTS (Unit & UI)
# Running tests before archiving to fail fast if logic is broken.
echo_stage "Running Tests (Parallelized)"

xcodebuild test \
    "${FILE_FLAG[@]}" \
    -scheme "$SCHEME_NAME" \
    -destination 'platform=iOS Simulator,name=iPhone 15 Pro,OS=latest' \
    -parallel-testing-enabled YES \
    -parallel-testing-worker-count "$THREADS" \
    -resultBundlePath "$TEST_RESULTS_PATH" \
    -quiet

check_status $? "Unit Tests"

# 4. ARCHIVE (The Heavy Lifting)
echo_stage "Building Archive"

# COMPILER OPTIMIZATIONS:
# - COMPILER_INDEX_STORE_ENABLE=NO: Skips indexing (saves time for CI nodes).
# - SWIFT_COMPILATION_MODE=wholemodule: Optimizes release executable quality.
run_archive
check_status $? "Archiving"

# 5. EXPORT IPA
echo_stage "Exporting .ipa"

xcodebuild -exportArchive \
    -archivePath "$ARCHIVE_PATH" \
    -exportOptionsPlist "$EXPORT_OPTIONS_PLIST" \
    -exportPath "$EXPORT_PATH" \
    -allowProvisioningUpdates

check_status $? "IPA Export"

# ==============================================================================
#  SUMMARY
# ==============================================================================

DURATION=$((SECONDS - START_TIME))
echo -e "\n${GREEN}✅  BUILD SUCCESSFUL!${NC}"
echo -e "${GREEN}📂  Output: $EXPORT_PATH/${PROJECT_NAME}.ipa${NC}"
echo -e "${GREEN}⏱   Time Taken: $((DURATION / 60))m $((DURATION % 60))s${NC}"

# Open output folder (macOS)
open "$EXPORT_PATH"
