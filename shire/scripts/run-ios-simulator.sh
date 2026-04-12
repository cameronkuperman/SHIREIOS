#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WORKSPACE_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
MOBILE_DIR="$WORKSPACE_DIR/apps/mobile"
REQUESTED_SIMULATOR="${SHIRE_IOS_SIMULATOR:-}"
PREFERRED_FAMILY="${SHIRE_IOS_SIMULATOR_FAMILY:-iPad Pro}"

trim_value() {
  printf '%s\n' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

extract_simulator_name() {
  printf '%s\n' "$1" | sed -E 's/^[[:space:]]*(.*) \([0-9A-F-]+\) \((Booted|Shutdown)\)[[:space:]]*$/\1/'
}

extract_simulator_udid() {
  printf '%s\n' "$1" | sed -E 's/^.*\(([0-9A-F-]+)\) \((Booted|Shutdown)\)[[:space:]]*$/\1/'
}

print_simulator_record() {
  line=$(trim_value "$1")

  if [ -z "$line" ]; then
    return 1
  fi

  name=$(extract_simulator_name "$line")
  udid=$(extract_simulator_udid "$line")

  if [ -z "$name" ] || [ -z "$udid" ]; then
    return 1
  fi

  printf '%s|%s\n' "$name" "$udid"
}

find_simulator() {
  if [ -n "$REQUESTED_SIMULATOR" ]; then
    printf '%s|%s\n' "$(trim_value "$REQUESTED_SIMULATOR")" "$(trim_value "$REQUESTED_SIMULATOR")"
    return 0
  fi

  devices=$(xcrun simctl list devices available)

  booted_preferred=$(printf '%s\n' "$devices" | awk -v family="$PREFERRED_FAMILY" 'index($0, family) && /Booted/ { print; exit }')
  if [ -n "$booted_preferred" ]; then
    print_simulator_record "$booted_preferred"
    return 0
  fi

  available_preferred=$(printf '%s\n' "$devices" | awk -v family="$PREFERRED_FAMILY" 'index($0, family) { print; exit }')
  if [ -n "$available_preferred" ]; then
    print_simulator_record "$available_preferred"
    return 0
  fi

  booted_ipad=$(printf '%s\n' "$devices" | awk '/iPad/ && /Booted/ { print; exit }')
  if [ -n "$booted_ipad" ]; then
    print_simulator_record "$booted_ipad"
    return 0
  fi

  available_ipad=$(printf '%s\n' "$devices" | awk '/iPad/ { print; exit }')
  if [ -n "$available_ipad" ]; then
    print_simulator_record "$available_ipad"
    return 0
  fi

  return 1
}

SIMULATOR_RECORD=$(find_simulator || true)
SIMULATOR_NAME=$(printf '%s' "$SIMULATOR_RECORD" | cut -d '|' -f 1)
SIMULATOR_UDID=$(printf '%s' "$SIMULATOR_RECORD" | cut -d '|' -f 2)

if [ -z "$SIMULATOR_NAME" ] || [ -z "$SIMULATOR_UDID" ]; then
  echo "No available iPad simulator was found. Install one in Xcode > Settings > Components." >&2
  exit 1
fi

echo "Using iOS simulator: $SIMULATOR_NAME ($SIMULATOR_UDID)"

cd "$MOBILE_DIR"
pnpm exec expo run:ios -d "$SIMULATOR_UDID"
