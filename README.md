# AirlineSim Enhancement Suite

The AirlineSim Enhancement Suite (AES) offers a set of tools to help CEOs build their airlines.

## Features

- Aircraft profitability calculator
- A route analyzer which shows load factors for routes
- A salary adjuster that uses the country average as a base
- Competitor monitoring software
- See your route overview across with some analytics for the whole network.
- Automatically update prices to optimal levels.
- Automatically save historical load data.
- Customize most of the settings to fit your airline needs.

Marcipanas wrote [a guide](https://docs.google.com/document/d/1hzMHb3hTBXSZNtuDKoBuvx1HP9CgB7wVYR59yDYympg/) on how to use the extension’s features.

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
6. Select the unzipped `extension` folder.

The extension should now be added and ready to use.

## Privacy

AES stores extension settings and extracted AirlineSim gameplay data locally in the browser. See [PRIVACY.md](PRIVACY.md) for details.

## History

Marcipanas is the original developer of this extension.
It seems they ceased development sometime in 2020.
The community has published some updates in the meantime, but no continued development has happened since.

Sources: the [original forum thread](https://forums.airlinesim.aero/t/introducing-airlinesim-enhancement-suite-beta/21684).

## Developer Features

These features make developing for AES easier.

### Notifications

AES comes with its own notification API. This uses AS’ notification style and location. The AES notification API consists of two components: `Notifications` and `Notification`.

#### Usage

Notifications should only be used as a response to an action by the user; don’t add notifications on a page load.

#### Initiate the `Notifications`:

To start using the notification API create a new `Notifications`:

```
const notifications = new Notifications()
```

#### Add a new notification

To add a notification:

```
notifications.add("The settings have been updated")
```

By default, a new notification comes with the success styling (a checkmark icon and a green background). The style can be changed by passing an option object:

```
notifications.new("Failed to save data", {type: "warning"})
```

The possible values for `type` are:
- `"success"`
- `"warning"`
- `"error"`

## Credits

- Marcipanas for the original development
- racsofp for their update and installation documentation
- Robert73 for the updated manifest file
- Zoë Bijl for the continued development, and Robert Fridolin for the assistance
- NEWLY2014 for the continued development
