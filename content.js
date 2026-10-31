(() => {
  const MARKER = "iiv-button";
  const MIN_MEDIA_WIDTH = 150;
  const ICON_SVG =
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14 3h7v7"/><path d="M21 3l-9 9"/>' +
    '<path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/></svg>';

  // Picks the widest candidate from a srcset, falling back to currentSrc / src.
  function pickBestUrl(img) {
    const srcset = img.getAttribute("srcset");
    if (srcset) {
      const candidates = srcset
        .split(/,\s*(?=https?:)/)
        .map((entry) => {
          const [url, descriptor] = entry.trim().split(/\s+/);
          return { url, w: parseInt(descriptor, 10) || 0 };
        })
        .filter((c) => c.url);
      candidates.sort((a, b) => b.w - a.w);
      if (candidates.length) return candidates[0].url;
    }
    return img.currentSrc || img.src;
  }

  function findMediaImages(article) {
    // Carousel slides may have a plain src without srcset; the size filter drops avatars.
    return [...article.querySelectorAll("img")].filter((img) => {
      if (img.closest("header") || !(img.getAttribute("srcset") || img.src)) return false;
      return img.getBoundingClientRect().width >= MIN_MEDIA_WIDTH;
    });
  }

  // The like / comment / save row: a section with several icon buttons.
  function findActionBar(article) {
    return (
      [...article.querySelectorAll("section")].find((section) => {
        const buttons = [...section.querySelectorAll('[role="button"]')].filter((b) =>
          b.querySelector("svg")
        );
        return buttons.length >= 2;
      }) || null
    );
  }

  function visibleArea(el) {
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    return w * h;
  }

  // Evaluated at click time so it follows carousel swipes.
  function currentImage(article) {
    const images = findMediaImages(article);
    let best = null;
    let bestArea = -1;
    for (const img of images) {
      const area = visibleArea(img);
      if (area > bestArea) {
        best = img;
        bestArea = area;
      }
    }
    return best;
  }

  function createButton(article) {
    const label = chrome.i18n.getMessage("openImage");
    const button = document.createElement("button");
    button.type = "button";
    button.className = MARKER;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = ICON_SVG;

    const open = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const img = currentImage(article);
      const url = img && pickBestUrl(img);
      if (url) chrome.runtime.sendMessage({ type: "OPEN_IMAGE", url });
    };
    button.addEventListener("click", open);
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") open(event);
    });
    return button;
  }

  function inject(article) {
    const existing = article.querySelector(`.${MARKER}`);
    const bar = findActionBar(article);
    if (existing) {
      // The action bar may render after the image; move a fallback button into it.
      if (!bar || !existing.classList.contains("iiv-floating")) return;
      existing.remove();
    }
    const images = findMediaImages(article);
    if (!images.length) return;

    const button = createButton(article);
    if (bar) {
      bar.appendChild(button);
      return;
    }

    const host = images[0].parentElement;
    if (!host) return;
    host.classList.add("iiv-floating-host");
    button.classList.add("iiv-floating");
    host.appendChild(button);
  }

  let scheduled = false;
  function scan() {
    scheduled = false;
    document.querySelectorAll("article").forEach(inject);
  }

  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(scan, 100);
  }).observe(document.body, { childList: true, subtree: true });

  scan();
})();
