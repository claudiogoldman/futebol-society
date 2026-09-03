# Android / Google Play

## Architecture

The Android application is implemented as a Trusted Web Activity (TWA) over the existing Futebol Society web application. The web application remains the source of truth for UI and backend behavior.

- Web app: `https://futebol-society-app.vercel.app/`
- Web manifest: `https://futebol-society-app.vercel.app/manifest.webmanifest`
- Android package: `br.com.treinadorideal.futebolsociety`
- Android target required for new Google Play submissions from 2026-08-31: API 36 or higher.

## Current repository preparation

`android/twa-manifest.json` contains the TWA configuration and `.github/workflows/android-twa.yml` can generate the Android project and produce an unsigned AAB artifact.

## Signing

The release AAB must be signed before publication. The signing keystore must not be committed to Git. The production signing process should use a protected keystore and credentials stored as GitHub Actions secrets or handled through Android Studio/Google Play App Signing.

## Digital Asset Links

Before production publication, deploy `assetlinks.json` at:

`https://futebol-society-app.vercel.app/.well-known/assetlinks.json`

The file must contain the SHA-256 certificate fingerprint of the certificate used by the published Android app. The fingerprint cannot be filled in until the production signing certificate is defined.

## Publication sequence

1. Generate/build the AAB.
2. Sign the release bundle.
3. Configure Google Play App Signing.
4. Publish the Digital Asset Links file with the production certificate fingerprint.
5. Upload the AAB to an internal test track.
6. Install and test the Android application on physical devices.
7. Complete Google Play store listing, Data safety, content rating and privacy-policy declarations.
8. Promote the tested release to production.

## Important limitation

The repository changes alone cannot create or publish a Google Play developer account, accept Google Play contractual declarations, or supply the production signing credentials. Those steps require access to the owner's Google Play Console account.
