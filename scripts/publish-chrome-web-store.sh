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

: "${CWS_CLIENT_ID:?Set CWS_CLIENT_ID in the environment.}"
: "${CWS_CLIENT_SECRET:?Set CWS_CLIENT_SECRET in the environment.}"
: "${CWS_REFRESH_TOKEN:?Set CWS_REFRESH_TOKEN in the environment.}"
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

TOKEN_RESPONSE=$(curl -fsS -X POST "https://oauth2.googleapis.com/token" \
    --data-urlencode "client_id=$CWS_CLIENT_ID" \
    --data-urlencode "client_secret=$CWS_CLIENT_SECRET" \
    --data-urlencode "refresh_token=$CWS_REFRESH_TOKEN" \
    --data-urlencode "grant_type=refresh_token")

ACCESS_TOKEN=$(printf "%s" "$TOKEN_RESPONSE" | json_field access_token)

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
