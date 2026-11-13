---
title: Install & platforms
description: Supported platforms, download options, and upgrade notes for BaiShou.
---

## Which platforms are supported

| Platform | Status |
|----------|--------|
| Windows | Official installer |
| Android | Official APK |
| Linux | Build from source yourself; no official prebuilt package |
| iOS / macOS | No official client yet |

Two places to download from:

- The download button on the website, [foxletters.com](/)
- GitHub Releases: https://github.com/foxletters-hq/BaiShou-Next/releases

## Windows

1. Download the latest desktop installer from the website or from Releases.
2. Follow the installer wizard and launch the app.
3. If the system blocks an unknown app, allow the install when prompted (your local security policy has the final say).

## Android

1. Download and install the latest APK.
2. If you get an “unknown sources” warning, allow that source in system settings and try again.
3. When the package name matches the legacy Flutter BaiShou, you can upgrade in place. If you still have old data afterward, follow the [migration guide](/en/docs/migrate/from-legacy/).

:::caution[Storage permission]
If you want your data in an external directory that lines up with desktop (`BaiShou_Root`), Android may need an “All files access” style permission. Vendors (Xiaomi, Huawei, realme, and so on) all name that setting differently — see [Workspaces & data location](/en/docs/configure/workspace/).
:::

## Version notes

The current repository is https://github.com/foxletters-hq/BaiShou-Next. The old Flutter repository is no longer maintained; new features and releases only happen in BaiShou-Next.

Desktop and mobile version numbers don’t necessarily move in lockstep (desktop 1.x and mobile 1.x each go their own way). The latest Release for each platform is what counts.

After install, go through [First launch](/en/docs/getting-started/first-launch/), then [Chat in ten minutes](/en/docs/getting-started/quick-start/) to set up models and RAG.
