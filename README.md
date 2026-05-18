# Cookie Editor

Cookie Editor is a Chrome Manifest V3 extension for viewing, creating, editing,
deleting, importing, exporting, and clearing cookies from the current tab.

Copyright (C) 2026 Trần Đăng Khoa

- Facebook: https://www.facebook.com/100026315003067
- Website: https://trandangkhoatechnology.github.io/

## Features

- View cookies for the active HTTP/HTTPS tab.
- Add, edit, delete, and clear cookies.
- Import and export cookies as JSON, header string, or Netscape format.
- Optional encrypted import/export.
- Optional context menu actions for copying or removing cookies.
- Optional browser data clearing through the `browsingData` permission.
- Side panel UI for Chrome 114 and newer.

## Development

```bash
npm install
npm run dev
```

## Build The Extension

```bash
npm run build:extension
```

The production extension is written to `dist/`.
The build also prepares the project root so Chrome can load `D:\Cookie_Editor`
directly during local development.

To load it in Chrome:

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the project root folder, for example `D:\Cookie_Editor`.

## Configuration

The extension uses `https://trandangkhoatechnology.github.io/` by default for
external links. If you run your own account, share-link, or upgrade API, create
a `.env` file:

```bash
VITE_WEBSITE="http://localhost:3000"
```

## Scripts

- `npm run dev`: start Vite development mode.
- `npm run build`: build the extension.
- `npm run build:extension`: build the extension.
- `npm test`: run Vitest.
"# Cookie-Editor-Extention" 
