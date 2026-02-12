# iOS High-Performance Build Automation

This repository includes a `build_deploy.sh` script intended for macOS runners and local macOS machines.

## Included files

- `build_deploy.sh`: Fast `xcodebuild`-based pipeline (Clean → Resolve → Version → Test → Archive → Export) with optional Bluetooth/Wi-Fi scan logging.
- `exportOptions.testflight.plist`: Template for TestFlight/App Store upload flow.
- `exportOptions.enterprise.plist`: Template for Enterprise in-house distribution.

## Usage

1. Copy or rename the desired export options template to `exportOptions.plist`.
2. Update placeholders (`YOUR_TEAM_ID`, bundle ID/profile names).
3. Update script config values at the top of `build_deploy.sh`.
4. Run:

```bash
chmod +x build_deploy.sh
./build_deploy.sh
```

## Bluetooth/Wi-Fi scanning integration

- Scanning is enabled by default via `ENABLE_RADIO_SCAN=true`.
- The script runs Wi-Fi and Bluetooth scans in parallel and writes timestamped logs under `Builds/RadioScans`.
- To disable scanning, set `ENABLE_RADIO_SCAN=false`.

## Notes

- The script automatically uses all CPU cores via `-jobs $(sysctl -n hw.ncpu)`.
- `xcbeautify` is optional; if unavailable, the script falls back to raw `xcodebuild` output.
- The script validates required files before running, and exits immediately on failures.
