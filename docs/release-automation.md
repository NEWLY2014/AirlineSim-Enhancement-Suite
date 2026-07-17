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

The Chrome Web Store extension ID is public and is set in the workflow as `hbbgjkgglkddalmgfnhgeinmfkobgdke`.

## Release flow

1. Update `package.json`, `extension/manifest.json`, and `extension/manifest.json` `version_name` to the same version.
2. Commit and push the version change.
3. Create and push a matching tag:

   ```sh
   git tag v0.8.8
   git push origin v0.8.8
   ```

The `Release extension` workflow validates that the tag matches the manifest version, packages the extension with `npm run package`, creates a GitHub Release with the zip attached, uploads the same zip to Chrome Web Store, and submits it for publishing.

If you run the workflow manually from GitHub Actions, run it from `main` and enter the existing version tag, such as `v0.8.8`, in the `release_tag` input.

Chrome Web Store publishing still goes through Google's normal review process. The workflow submits the item for review; the update appears in the store after approval.
