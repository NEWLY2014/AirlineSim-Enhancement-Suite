# AES User Manual

[Project overview](../README.md) · [User manual](user-manual.md) · [Developer manual](developer-manual.md)

Installation and pricing guidance for AirlineSim Enhancement Suite users.

## Installation

Supported platforms: Chromium-based browsers (Chrome, Edge, etc.).

### Recommended: Install from Chrome Web Store

Install AES directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/airlinesim-enhancement-su/hbbgjkgglkddalmgfnhgeinmfkobgdke).

1. Open the [Chrome Web Store listing](https://chromewebstore.google.com/detail/airlinesim-enhancement-su/hbbgjkgglkddalmgfnhgeinmfkobgdke).
2. Click `Add to Chrome`.
3. Confirm the installation in your browser.
4. Open AirlineSim and AES will load automatically on supported pages.

### Manual Installation

If you want to test a local build or install AES manually, use the unpacked extension flow below. This guide is based on [racsofp’s guide](https://forums.airlinesim.aero/t/manual-installation-of-the-ase-airlinesim-enhancement-suite-chrome-extension/24671).

1. Download the current version from the [releases](https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/releases) page.
   The file you look for has the format `AES-vX.X.X.zip`, where `X` is replaced with numbers.
2. Unzip the archive.
3. Open your browser's extensions page.
    - Chrome: [chrome://extensions](chrome://extensions)
    - Edge: [edge://extensions](edge://extensions)
4. Enable `Developer mode`.
5. Click `Load unpacked`.
6. Select the extracted folder that contains `manifest.json`.

The extension should now be added and ready to use.

## Pricing settings

In AES Settings → Inventory Pricing, choose **Step rules** or **Control-point pricing**
as the global pricing mode for all compartments. Each compartment retains its own
rules and price limits. Existing settings retain step rules until
the new mode is explicitly selected and saved. Edit the load and adjustment points
in the table; the preview updates immediately. The 0% and 100% endpoints stay in
place, interior points can be added or removed, and duplicate loads are rejected.
The initial example curve is editable, not an optimized pricing recommendation.

Adjustments are **percentage points of the game's default price**, interpolated
linearly using the unrounded capacity-weighted load. For default price `D`, actual
current price `P` and interpolated adjustment `a`, the target is `P + D × a / 100`.
Only the final ticket price is rounded to the nearest integer (positive `.5` rounds
up). The existing percentage limits become integer bounds with `ceil(D × min / 100)`
and `floor(D × max / 100)`; targets are clamped to that range. No-op prices are not
submitted, and an empty integer range produces no recommendation.

Current-price recommendations and old-price references retain their existing
separation and submission safeguards. This mode changes interpolation and rounding;
it does not introduce a new demand model or change which flights are sampled.

Both pricing modes have a live preview beside the rule editor (below it on narrow
screens). Step rules draw horizontal segments with dashed jumps; control points
draw interpolated lines. Invalid or incomplete drafts hide the chart until corrected.
Step-rule loads retain their existing integer rounding and first-match behavior at
shared boundaries. Price limits and the save action sit below the editor; switching
compartments or modes preserves local rule drafts without applying prices.

## Additional feature guide

Marcipanas wrote [a guide](https://docs.google.com/document/d/1hzMHb3hTBXSZNtuDKoBuvx1HP9CgB7wVYR59yDYympg/) on how to use the extension’s features.

## Privacy

AES stores extension settings and extracted AirlineSim gameplay data locally in the browser. See [the privacy policy](../PRIVACY.md) for details.
