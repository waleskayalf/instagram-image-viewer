# Instagram Image Viewer – Chrome Extension Plan

## 1. Feasibility

**Yes, this is possible**, and it is a small extension (one content script, one tiny service worker, no popup needed).

What `example_dom.xml` confirms:

- The post "layer" renders an `<article role="presentation">` containing the photo as an `<img>` with a `srcset`.
- The `srcset` lists several widths: `1080w, 720w, 640w, 480w, 320w, 240w`. The `1080w` entry is the largest Instagram ships to the page, so the full URL is already in the DOM and no extra network request or API is needed.
- Below the image, a `<section>` holds the action icons (like, comment, save) as `role="button"` elements with an inline 24x24 `<svg>`. This is where the new button can go so it looks native.

Limits to be aware of:

| Topic | Detail |
|---|---|
| Max resolution | 1080w is the largest in the DOM. The original upload (here 3072x4096 per `aspect-ratio`) is not exposed, so "full HD" is the ceiling of this approach. |
| Fragile selectors | Instagram's class names (`x1n2onr6`, ...) are auto-generated and change often. Selectors must rely on stable things: tag names (`article`, `section`, `img`), `role`, and the presence of `srcset`. |
| Localisation | The UI is localised (the sample is Hungarian: `aria-label="Mentés"`). Never match on label text. |
| Signed URLs | The URLs contain `oe=` (expiry) and `oh=` (signature) params. They work when opened right away, but must not be stored long term. Never edit or strip query params. |
| Terms of use | The extension only reads what the page already loaded and opens it in a tab. Keep it personal-use, with no scraping or bulk download. |

## 2. User experience

1. User opens a post on instagram.com (feed, profile grid modal, or `/p/...` page).
2. A new icon button (e.g. "open in new tab") appears in the action row next to like / comment / save.
3. Click: the best-resolution image of the currently shown photo opens in a **new tab**, next to the current one.
4. Carousel posts: the photo currently visible is the one opened.

## 3. Architecture (Manifest V3)

```
instagram-image-viewer/
  manifest.json
  content.js          # detects posts, injects button, resolves image URL
  content.css         # button styling (inherits currentColor, matches IG icons)
  background.js       # service worker: chrome.tabs.create({ url })
  icons/              # 16/48/128 px
  PLAN.md
```

### manifest.json (key points)

- `manifest_version: 3`
- `content_scripts`: matches `https://www.instagram.com/*`, `run_at: document_idle`, js + css.
- `background.service_worker: background.js`
- **Permissions: none.** `chrome.tabs.create` needs no `tabs` permission when only creating a tab. Host access is granted by the content script `matches`.
- No remote code, no `eval`, no network calls from the extension.

### Why a service worker for opening the tab

A content script cannot use `chrome.tabs`. It sends `{type: "OPEN_IMAGE", url}` through `chrome.runtime.sendMessage`, and the worker calls `chrome.tabs.create({ url, openerTabId, index: sender.tab.index + 1 })`. `window.open` from the content script also works because it runs inside a click gesture, but the worker route gives control over tab position and avoids popup-blocker edge cases.

## 4. Implementation details

### 4.1 Detecting posts (SPA aware)

Instagram is a single-page app, so the layer is created and destroyed without page loads.

- Use one `MutationObserver` on `document.body` (`childList`, `subtree`), debounced with `requestAnimationFrame` or about 100 ms.
- On each tick, scan for `article` elements that contain an `img[srcset]` and do not yet have our button (mark the injected node with `data-iiv="1"` to stay idempotent).
- Disconnect nothing: the observer lives for the page lifetime and the work per tick is a cheap `querySelectorAll`.

### 4.2 Finding the injection point

Within the `article`:

1. Find the action bar: the first `<section>` that contains at least 2 `[role="button"]` elements each holding an `svg` (like / comment / save row).
2. Append our button as a sibling of the last icon group (e.g. at the end of that section) and mirror the existing wrapper markup (`span > div[role=button] > svg`) so spacing and hover behaviour match.
3. **Fallback**: if the action bar cannot be found, overlay a small floating button in the top-right corner of the image container so the feature still works.

The button:
- `<button type="button">` or `div[role=button][tabindex=0]` with `aria-label` set via `chrome.i18n` (English plus Hungarian messages in `_locales`).
- Inline SVG using `fill="currentColor"` (so dark/light themes work), 24x24.
- Handles click and Enter/Space; calls `stopPropagation` and `preventDefault` so it does not trigger Instagram's own handlers (the article has `data-interactable="|click|"`).

### 4.3 Resolving the image URL

```js
function pickBestUrl(img) {
  const srcset = img.getAttribute("srcset");
  if (srcset) {
    // Split only on a comma followed by "http" (Instagram uses no space), so commas inside a URL cannot break parsing.
    const candidates = srcset.split(/,\s*(?=https?:)/).map(s => {
      const [url, w] = s.trim().split(/\s+/);
      return { url, w: parseInt(w, 10) || 0 };
    });
    candidates.sort((a, b) => b.w - a.w);
    if (candidates[0]) return candidates[0].url;
  }
  return img.currentSrc || img.src;
}
```

Notes:
- The `&amp;` seen in the XML is just HTML escaping; `getAttribute` returns real `&`, so no manual decoding is needed.
- Choose the largest `w`, not the first entry, so we do not depend on ordering.
- Fallback chain: largest `srcset` entry, then `currentSrc`, then `src`.

### 4.4 Carousels (multiple photos in one post)

The sample has 6 `<img>` elements (the main photo plus avatars/thumbnails), and carousel posts render several slides at once.

- Candidate images = `img[srcset]` inside the media container of the article, excluding avatars (small `sizes`, inside `header`) and elements outside the media area.
- Pick the one most visible in the viewport: compute the intersection area of `getBoundingClientRect()` with the article's media container and choose the maximum. Cheap, and robust against Instagram reordering slides.
- Do this **at click time**, not at injection time, so it is always correct after the user swipes.

### 4.5 Edge cases

| Case | Behaviour |
|---|---|
| Video / Reel | Out of scope for v1. No `img[srcset]` in the media area means no button is injected (or a disabled state). |
| Layer closed/reopened | Observer re-injects; marker prevents duplicates. |
| Navigating between posts in the layer | Observer tick re-checks; if the button exists but the article was re-rendered, it is re-created. |
| `srcset` missing | Fall back to `currentSrc` / `src`. |
| URL expired | Rare for immediate use. If the new tab shows an error, the user reopens the post (document in the README). |
| Instagram markup change | Selector logic is isolated in one `findActionBar()` and one `findMediaImages()` function so fixes are small. |

## 5. Milestones

1. **Skeleton**: manifest, background worker, content script that logs found articles on instagram.com.
2. **URL extraction**: `pickBestUrl` plus unit test run against `example_dom.xml` (expect the 1080w URL).
3. **Button injection**: action bar detection, styled icon, fallback overlay, idempotence.
4. **Click flow**: message to worker, new tab opens next to the current one.
5. **Carousel support**: viewport-based slide selection.
6. **Polish**: i18n (en, hu), keyboard accessibility, icons, short README.
7. **Manual QA** (see below).

## 6. Test plan

- **Unit** (Node + jsdom, optional): load `example_dom.xml`, assert the picked URL ends with `...&oe=6AEBE9CE` and comes from the `1080w` entry, and that the action bar is found.
- **Manual in Chrome** (`chrome://extensions` > Developer mode > Load unpacked):
  - Single-photo post in the layer from a profile grid.
  - Post on its own page (`/p/<id>/`).
  - Feed view.
  - Carousel: swipe to slide 3, click, and confirm slide 3 opens.
  - Close and reopen the layer several times and confirm exactly one button.
  - Dark and light mode, and Hungarian and English UI.
  - Keyboard: Tab to the button, then Enter.
  - A Reel (no button, no errors in the console).
- **Regression guard**: keep `example_dom.xml` as a fixture; add new fixtures whenever Instagram markup changes.

## 7. Risks and mitigations

- **Instagram DOM changes** (most likely failure): structural selectors plus a floating-button fallback; selector code in two small functions.
- **Chrome Web Store review** (if published): minimal permissions, a clear single purpose, and a privacy statement saying no data is collected.
- **Performance**: a debounced observer and an idempotent marker keep overhead negligible.

## 8. Possible later additions (not in v1)

- Reel / video support (a `<video src>` is usually a blob, which is harder).
- Download button with a clean filename.
- Open in a minimal viewer page (zoom / pan) instead of the raw image URL.
- Keyboard shortcut via `commands` in the manifest.
