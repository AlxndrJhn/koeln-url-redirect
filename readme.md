# Köln Ratsinfo Redirect

Redirects slow Stadt Köln file links (`getfile.asp`) and Vorlage pages (`vo0050.asp`) to a faster mirror, wherever they are opened from (e.g. a Google Sheet). If the mirror doesn't respond within 2 seconds, the extension automatically falls back to the original stadt-koeln.de URL.

Click the toolbar icon to enable/disable the extension, or to report a bug / suggest an idea through the mirror's feedback form (`/feedback`), which gets the extension version, its on/off state and the current Ratsinfo tab attached.

## Build

Run `build.sh` (bash, e.g. Git Bash/WSL/Linux) to produce Firefox and Chrome packages in `dist/`:

```sh
./build.sh
```

This copies the shared source files (`background.js`, `popup.*`, `rules.json`) together with the browser-specific `manifest.json` (Firefox) / `manifest.chrome.json` (Chrome) into `dist/firefox` and `dist/chrome`, then zips each into a loadable/installable package. CI (`.github/workflows/build.yml`) runs this on every push/PR and attaches the zips as artifacts, and publishes them to a GitHub release on version tags (`v*`).

## Release

Bump `version` in both manifests, merge, then push a tag (`git tag v1.5.0 && git push origin v1.5.0`). The tag build also uploads to the stores, each only once its repository secrets are set:

- **Firefox** (addons.mozilla.org, listed add-on `koeln-url-redirect@localhost`): `AMO_JWT_ISSUER`, `AMO_JWT_SECRET` from https://addons.mozilla.org/developers/addon/api/key/. The version goes into Mozilla's review and is published once approved.
- **Chrome Web Store**: `CWS_EXTENSION_ID` (from the developer dashboard), `CWS_CLIENT_ID`, `CWS_CLIENT_SECRET` (a Google Cloud OAuth client with the Chrome Web Store API enabled) and `CWS_REFRESH_TOKEN` for that client. The version is uploaded and submitted for review.

# Test Urls

## Files

https://ratsinfo.sessionnet.verwaltung.stadtkoeln.de/getfile.asp?id=1079954&type=do
https://ratsinformation.stadt-koeln.de/getfile.asp?id=1079954&type=do

## Tagesordnung

https://ratsinfo.sessionnet.verwaltung.stadtkoeln.de/si0057.asp?__ksinr=34801
https://ratsinformation.stadt-koeln.de/si0057.asp?__ksinr=34801

## Vorlage

https://ratsinfo.sessionnet.verwaltung.stadtkoeln.de/vo0050.asp?__kvonr=132006
https://ratsinformation.stadt-koeln.de/vo0050.asp?__kvonr=132006
