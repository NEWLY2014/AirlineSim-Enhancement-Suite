# Release Automation

This repository publishes releases from version tags.

## Required GitHub secrets

Add these repository secrets before cutting the first automated release:

- `CWS_SERVICE_ACCOUNT_KEY`: JSON key for the Chrome Web Store service account.
- `CWS_PUBLISHER_ID`: Publisher ID from the Chrome Web Store Developer Dashboard.

The workflow authenticates as `uploader@airlinesim-enhancement-suite.iam.gserviceaccount.com`.
Add this service account to the Publisher's `Account` page in the Chrome Web Store
Developer Dashboard. The service account also needs `roles/iam.serviceAccountTokenCreator`
on itself so GitHub Actions can mint the short-lived access token.

The Chrome Web Store extension IDs are public and are set in the workflow:

- Beta: `jhkbhhgoielpdhdhkpahkifijocaaobn`
- Stable: `hbbgjkgglkddalmgfnhgeinmfkobgdke`

## Release flow

1. Choose a channel and set the version metadata:

   - Beta: `extension/manifest.json` `version` is `0.8.8`, while `version_name` and `package.json` `version` are `0.8.8-beta`.
   - Stable: `extension/manifest.json` `version`, `version_name`, and `package.json` `version` are all `0.8.8`.

2. Commit and push the version change.
3. Create and push the matching tag:

   ```sh
   # Beta: uploads only to the trusted-tester beta listing.
   git tag v0.8.8-beta
   git push origin v0.8.8-beta

   # Stable: uploads to both CWS listings and creates a GitHub Release.
   git tag v0.8.8
   git push origin v0.8.8
   ```

The `Release extension` workflow packages the extension with `npm run package` and then follows the selected channel:

- Beta tags upload and submit only to the Chrome Web Store beta listing. Its existing trusted-tester visibility is retained.
- Stable tags upload and submit to the beta listing and the stable listing, then create or update the GitHub Release with the same zip. If the beta listing already has the same `manifest.version` from an earlier beta build, the workflow treats that listing as already covered and skips its duplicate upload.

If you run the workflow manually from GitHub Actions, run it from `main` and enter the existing version tag, such as `v0.8.8`, in the `release_tag` input.

Chrome Web Store publishing still goes through Google's normal review process. The workflow submits the item for review; the update appears in the store after approval.
