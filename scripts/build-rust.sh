#!/bin/bash
# Build script for openclaw-bridge-rust

set -e

VERSION=${VERSION:-"0.1.0"}
OUTPUT_DIR="dist-rust"
BINARY_NAME="openclaw-bridge-rust"

echo "Building OpenClaw Bridge (Rust) v${VERSION}"
echo "Output directory: ${OUTPUT_DIR}"

# Clean previous builds
rm -rf "${OUTPUT_DIR}"
mkdir -p "${OUTPUT_DIR}"

# Determine build mode
if [ "${RELEASE}" = "1" ]; then
    BUILD_FLAGS="--release"
    TARGET_DIR="target/release"
    echo "Build mode: RELEASE"
else
    BUILD_FLAGS=""
    TARGET_DIR="target/debug"
    echo "Build mode: DEBUG"
fi

# Build for current platform
echo "Building for current platform..."
cargo build ${BUILD_FLAGS}
echo "✓ Built for current platform"

# Cross-platform builds (optional, requires cross tool)
if command -v cross &> /dev/null; then
    echo "Cross-compilation tool found, building for multiple platforms..."
    
    # Linux AMD64
    echo "Building for Linux AMD64..."
    cross build ${BUILD_FLAGS} --target x86_64-unknown-linux-gnu
    cp target/x86_64-unknown-linux-gnu/*/openclaw-bridge-rust "${OUTPUT_DIR}/${BINARY_NAME}-linux-amd64"
    
    # Linux ARM64
    echo "Building for Linux ARM64..."
    cross build ${BUILD_FLAGS} --target aarch64-unknown-linux-gnu
    cp target/aarch64-unknown-linux-gnu/*/openclaw-bridge-rust "${OUTPUT_DIR}/${BINARY_NAME}-linux-arm64"
    
    # macOS AMD64
    if [ "$(uname)" = "Darwin" ]; then
        echo "Building for macOS AMD64..."
        cargo build ${BUILD_FLAGS} --target x86_64-apple-darwin
        cp target/x86_64-apple-darwin/*/openclaw-bridge-rust "${OUTPUT_DIR}/${BINARY_NAME}-darwin-amd64"
        
        # macOS ARM64
        echo "Building for macOS ARM64..."
        cargo build ${BUILD_FLAGS} --target aarch64-apple-darwin
        cp target/aarch64-apple-darwin/*/openclaw-bridge-rust "${OUTPUT_DIR}/${BINARY_NAME}-darwin-arm64"
    fi
    
    # Windows AMD64
    echo "Building for Windows AMD64..."
    cross build ${BUILD_FLAGS} --target x86_64-pc-windows-gnu
    cp target/x86_64-pc-windows-gnu/*/openclaw-bridge-rust.exe "${OUTPUT_DIR}/${BINARY_NAME}-windows-amd64.exe"
    
    echo "✓ All cross-platform builds completed"
else
    echo "Cross-compilation tool not found. Install with: cargo install cross"
    echo "Skipping cross-platform builds."
    
    # Just copy the current platform binary
    if [ "$(uname)" = "Darwin" ]; then
        PLATFORM="darwin"
    elif [ "$(uname)" = "Linux" ]; then
        PLATFORM="linux"
    else
        PLATFORM="unknown"
    fi
    
    ARCH="$(uname -m)"
    if [ "${ARCH}" = "x86_64" ]; then
        ARCH="amd64"
    elif [ "${ARCH}" = "aarch64" ] || [ "${ARCH}" = "arm64" ]; then
        ARCH="arm64"
    fi
    
    cp "${TARGET_DIR}/${BINARY_NAME}" "${OUTPUT_DIR}/${BINARY_NAME}-${PLATFORM}-${ARCH}"
fi

echo ""
echo "Build completed! Binaries are in ${OUTPUT_DIR}/"
ls -lh "${OUTPUT_DIR}/"
