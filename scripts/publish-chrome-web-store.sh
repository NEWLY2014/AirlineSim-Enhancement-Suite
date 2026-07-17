#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
    echo "Usage: $0 path/to/extension.zip" >&2
    exit 2
fi

PACKAGE_PATH=$1

if [ ! -f "$PACKAGE_PATH" ]; then
    echo "Extension package not found: $PACKAGE_PATH" >&2
    exit 1
fi

: "${CWS_ACCESS_TOKEN:?Set CWS_ACCESS_TOKEN in the environment.}"
: "${CWS_PUBLISHER_ID:?Set CWS_PUBLISHER_ID in the environment.}"
: "${CWS_EXTENSION_ID:?Set CWS_EXTENSION_ID in the environment.}"

CWS_ITEM_NAME="publishers/$CWS_PUBLISHER_ID/items/$CWS_EXTENSION_ID"
CWS_UPLOAD_URL="https://chromewebstore.googleapis.com/upload/v2/$CWS_ITEM_NAME:upload"
CWS_FETCH_STATUS_URL="https://chromewebstore.googleapis.com/v2/$CWS_ITEM_NAME:fetchStatus"
CWS_PUBLISH_URL="https://chromewebstore.googleapis.com/v2/$CWS_ITEM_NAME:publish"

json_field() {
    node -e '
const fieldPath = process.argv[1].split(".");
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const json = JSON.parse(input);
  let value = json;
  for (const field of fieldPath) {
    value = value && value[field];
  }
  if (value === undefined || value === null || value === "") {
    process.exit(1);
  }
  console.log(value);
});
' "$1"
}

revision_version() {
    node -e '
const revision = process.argv[1];
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const status = JSON.parse(input);
  const channels = status[revision] && status[revision].distributionChannels;
  const versions = (channels || []).map(channel => channel.crxVersion).filter(Boolean);
  if (versions.length === 0) process.exit(1);
  const compare = (left, right) => {
    const leftParts = left.split(".").map(Number);
    const rightParts = right.split(".").map(Number);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
      const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
      if (difference !== 0) return difference;
    }
    return 0;
  };
  console.log(versions.sort(compare).at(-1));
});
' "$1"
}

compare_versions() {
    node -e '
const [left, right] = process.argv.slice(1);
const leftParts = left.split(".").map(Number);
const rightParts = right.split(".").map(Number);
const length = Math.max(leftParts.length, rightParts.length);
for (let index = 0; index < length; index += 1) {
  const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
  if (difference !== 0) {
    console.log(difference > 0 ? "newer" : "older");
    process.exit(0);
  }
}
console.log("same");
' "$1" "$2"
}

ACCESS_TOKEN=$CWS_ACCESS_TOKEN
PACKAGE_VERSION=$(unzip -p "$PACKAGE_PATH" manifest.json | json_field version)

if ! STATUS_RESPONSE=$(curl -sS --fail-with-body \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    "$CWS_FETCH_STATUS_URL"); then
    echo "Chrome Web Store status request failed:" >&2
    echo "$STATUS_RESPONSE" >&2
    exit 1
fi

PUBLISHED_VERSION=$(printf "%s" "$STATUS_RESPONSE" | revision_version publishedItemRevisionStatus || true)
SUBMITTED_VERSION=$(printf "%s" "$STATUS_RESPONSE" | revision_version submittedItemRevisionStatus || true)

for CURRENT_VERSION in "$SUBMITTED_VERSION" "$PUBLISHED_VERSION"; do
    if [ -z "$CURRENT_VERSION" ]; then
        continue
    fi

    VERSION_COMPARISON=$(compare_versions "$PACKAGE_VERSION" "$CURRENT_VERSION")
    case "$VERSION_COMPARISON" in
        older)
            echo "Package version $PACKAGE_VERSION is older than existing Chrome Web Store version $CURRENT_VERSION." >&2
            exit 1
            ;;
        same)
            if [ "$CURRENT_VERSION" = "$PUBLISHED_VERSION" ]; then
                echo "Chrome Web Store item $CWS_EXTENSION_ID already has published version $PACKAGE_VERSION; skipping."
            else
                echo "Chrome Web Store item $CWS_EXTENSION_ID already has submitted version $PACKAGE_VERSION; skipping."
            fi
            exit 0
            ;;
    esac
done

echo "Uploading $PACKAGE_PATH to Chrome Web Store item $CWS_EXTENSION_ID..."
if ! UPLOAD_RESPONSE=$(curl -sS --fail-with-body -X POST \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/zip" \
    --upload-file "$PACKAGE_PATH" \
    "$CWS_UPLOAD_URL"); then
    echo "Chrome Web Store upload request failed:" >&2
    echo "$UPLOAD_RESPONSE" >&2
    exit 1
fi

UPLOAD_STATE=$(printf "%s" "$UPLOAD_RESPONSE" | json_field uploadState)
echo "Chrome Web Store upload state: $UPLOAD_STATE"

case "$UPLOAD_STATE" in
    SUCCEEDED|UPLOAD_SUCCEEDED)
        ;;
    IN_PROGRESS|UPLOAD_IN_PROGRESS)
        for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
            sleep 10
            STATUS_RESPONSE=$(curl -fsS \
                -H "Authorization: Bearer $ACCESS_TOKEN" \
                "$CWS_FETCH_STATUS_URL")
            STATUS_STATE=$(printf "%s" "$STATUS_RESPONSE" | json_field lastAsyncUploadState || true)
            echo "Chrome Web Store upload poll $attempt: ${STATUS_STATE:-unknown}"

            case "$STATUS_STATE" in
                SUCCEEDED|UPLOAD_SUCCEEDED)
                    break
                    ;;
                FAILED|UPLOAD_FAILED)
                    echo "$STATUS_RESPONSE" >&2
                    exit 1
                    ;;
            esac
        done

        if [ "${STATUS_STATE:-}" != "SUCCEEDED" ] && [ "${STATUS_STATE:-}" != "UPLOAD_SUCCEEDED" ]; then
            echo "Timed out waiting for Chrome Web Store upload processing." >&2
            exit 1
        fi
        ;;
    FAILED|UPLOAD_FAILED)
        echo "$UPLOAD_RESPONSE" >&2
        exit 1
        ;;
    *)
        echo "Unexpected Chrome Web Store upload state: $UPLOAD_STATE" >&2
        echo "$UPLOAD_RESPONSE" >&2
        exit 1
        ;;
esac

PUBLISH_BODY='{"publishType":"DEFAULT_PUBLISH","blockOnWarnings":true}'

echo "Submitting Chrome Web Store item $CWS_EXTENSION_ID for publishing..."
if ! PUBLISH_RESPONSE=$(curl -sS --fail-with-body -X POST \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$PUBLISH_BODY" \
    "$CWS_PUBLISH_URL"); then
    echo "Chrome Web Store publish request failed:" >&2
    echo "$PUBLISH_RESPONSE" >&2
    exit 1
fi

PUBLISH_STATE=$(printf "%s" "$PUBLISH_RESPONSE" | json_field state || true)
echo "Chrome Web Store publish state: ${PUBLISH_STATE:-submitted}"
