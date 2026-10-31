# Instagram Image Viewer

A small Chrome extension that adds an **"Open image in new tab"** button to Instagram posts. One click opens the full-size photo (up to the 1080px version Instagram loads into the page) in a new browser tab, right next to the current one.

## Features

- Adds a button next to the like / comment / save icons in the post view (feed, profile grid pop-up, and `/p/...` pages).
- Opens the largest image available in the page (the widest entry of the image's `srcset`).
- Works with carousel posts: the slide you are currently looking at is the one that opens.
- Falls back to a small round button in the image corner if Instagram changes the action bar layout.
- Matches Instagram's icon style and supports keyboard use (Tab, then Enter or Space).
- English and Hungarian tooltip text.
- No special permissions, no data collection, no network requests of its own.

## Installation (unpacked)

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. Open [instagram.com](https://www.instagram.com/).

After changing any file, click the refresh icon on the extension's card and reload the Instagram tab.

## Usage

1. Open a post on instagram.com.
2. Click the new button at the end of the like / comment / save row.
3. The image opens in a new tab. Save it from there with right-click, then "Save image as...".

## How it works

- `content.js` watches the page for post `<article>` elements, since Instagram is a single-page app. It adds the button and, at click time, picks the most visible image in the post and its widest `srcset` URL.
- `background.js` (service worker) receives the URL and opens it with `chrome.tabs.create`. Only `https` URLs are accepted.
- `content.css` styles the button; `_locales/` holds the tooltip text.

## Limitations

- 1080px is the largest size Instagram puts in the page. The original upload is not available this way.
- Videos and Reels are not supported.
- Instagram's markup changes often. The extension avoids generated class names and label text, but a redesign can still break it. If the button disappears, open an issue with the markup of the post's `<article>` element.
- Image URLs are signed and expire after a while. Open the image soon after clicking, and reopen the post if a link has expired.

## Development

There is no build step. The extension is plain JavaScript (Manifest V3).

`example_dom.xml` is an anonymized snippet of Instagram's post markup, kept as a reference fixture for the selectors and the `srcset` format. `PLAN.md` holds the original design notes.

## Disclaimer

This is an unofficial project and is not affiliated with Instagram or Meta. It only reads what the page has already loaded. Respect the copyright and privacy of the people whose photos you view, and Instagram's terms of use.
