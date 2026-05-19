(() => {
  const STORAGE_KEY = 'newtab_config_v1';
  const RING_STORAGE_KEY = 'newtab_ring_config';
  const DEFAULTS = {
    links: [],
    placeholder: 'search the nest…'
  };
  const RING_DEFAULTS = {
    hue: 0,
    isMonochrome: true,
    intensity: 0.8
  };
  let orbitRadius = { x: 550, y: 340 };

  const SITE_ALIASES = {
    google:'google.com', gmail:'mail.google.com', youtube:'youtube.com',
    maps:'maps.google.com', drive:'drive.google.com', docs:'docs.google.com',
    gemini:'gemini.google.com', translate:'translate.google.com',
    facebook:'facebook.com', instagram:'instagram.com', whatsapp:'whatsapp.com',
    messenger:'messenger.com', threads:'threads.net',
    twitter:'twitter.com', x:'x.com', tiktok:'tiktok.com',
    snapchat:'snapchat.com', pinterest:'pinterest.com', reddit:'reddit.com',
    linkedin:'linkedin.com', tumblr:'tumblr.com',
    netflix:'netflix.com', spotify:'spotify.com', twitch:'twitch.tv',
    amazon:'amazon.com', ebay:'ebay.com', etsy:'etsy.com', paypal:'paypal.com',
    github:'github.com', gitlab:'gitlab.com', stackoverflow:'stackoverflow.com',
    discord:'discord.com', slack:'slack.com', telegram:'telegram.org',
    signal:'signal.org', zoom:'zoom.us', teams:'teams.microsoft.com',
    notion:'notion.so', figma:'figma.com', dropbox:'dropbox.com',
    wikipedia:'wikipedia.org', medium:'medium.com', substack:'substack.com',
    chatgpt:'chatgpt.com', openai:'openai.com', claude:'claude.ai',
    perplexity:'perplexity.ai', anthropic:'anthropic.com',
    microsoft:'microsoft.com', apple:'apple.com', adobe:'adobe.com',
    canva:'canva.com', dribbble:'dribbble.com', behance:'behance.net',
    trello:'trello.com', jira:'atlassian.net', vercel:'vercel.com',
    netlify:'netlify.com', airbnb:'airbnb.com', booking:'booking.com',
    duolingo:'duolingo.com', coursera:'coursera.org', udemy:'udemy.com',
  };

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    const row = Array.from({length: n + 1}, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      let prev = row[0]; row[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = row[j];
        row[j] = a[i-1] === b[j-1] ? prev : 1 + Math.min(prev, row[j], row[j-1]);
        prev = tmp;
      }
    }
    return row[n];
  }

  function fuzzyMatchSite(word) {
    if (SITE_ALIASES[word]) return SITE_ALIASES[word];
    const threshold = word.length <= 4 ? 0 : word.length <= 7 ? 1 : 2;
    if (!threshold) return null;
    let best = null, bestDist = Infinity;
    for (const key of Object.keys(SITE_ALIASES)) {
      const d = levenshtein(word, key);
      if (d < bestDist) { bestDist = d; best = key; }
    }
    return bestDist <= threshold ? SITE_ALIASES[best] : null;
  }

  function getOrbitRadius() {
    const x = Math.min(550, Math.round(window.innerWidth * 0.38));
    return { x, y: Math.round(x * (340 / 550)) };
  }

  function applyOrbitRadius(r) {
    orbitRadius = r;
    document.documentElement.style.setProperty('--orbit-rx', r.x);
    document.documentElement.style.setProperty('--orbit-ry', r.y);
  }

  const searchInput = document.getElementById('searchInput');
  const orbit = document.getElementById('orbit');
  const gearBtn = document.getElementById('gearBtn');
  const modal = document.getElementById('settingsModal');
  const settingsForm = document.getElementById('settingsForm');
  const resetBtn = document.getElementById('resetBtn');
  const hueRing = document.getElementById('hueRing');
  const hueHandle = document.getElementById('hueHandle');
  const monochromeToggle = document.getElementById('monochromeToggle');
  const intensitySlider = document.getElementById('intensity');
  const colorReadout = document.getElementById('colorReadout');

  let state = null;
  let ringState = null;
  let placeholderSpan = null;

  // ===== STORAGE =====

  function loadFromStorage(key, defaults) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { ...defaults };
  }

  function loadState() { return loadFromStorage(STORAGE_KEY, DEFAULTS); }
  function saveState(s) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); state = s; }
  function resetState() { saveState({ ...DEFAULTS }); }

  function loadRingState() { return loadFromStorage(RING_STORAGE_KEY, RING_DEFAULTS); }
  function saveRingState(rs) { localStorage.setItem(RING_STORAGE_KEY, JSON.stringify(rs)); ringState = rs; }

  // ===== RING COLOR SYSTEM =====

  function deriveColorsFromHue(h, intensity, isMonochrome) {
    if (isMonochrome) {
      return { h: 0, s: 0, light: 70, dark: 10, bg: 5 };
    }
    return {
      h,
      s: Math.min(35 + intensity * 15, 50),
      light: 68 + intensity * 4,
      dark: 8 + intensity * 4,
      bg: 4 + intensity * 2
    };
  }

  function setRingHue(h, intensity, isMonochrome) {
    const colors = deriveColorsFromHue(h, intensity, isMonochrome);
    const root = document.documentElement;
    root.style.setProperty('--ring-h', colors.h);
    root.style.setProperty('--ring-s', `${colors.s}%`);
    root.style.setProperty('--ring-light', `${colors.light}%`);
    root.style.setProperty('--ring-dark', `${colors.dark}%`);
    root.style.setProperty('--ring-bg', `${colors.bg}%`);
    root.style.setProperty('--ring-intensity', Math.max(0.5, intensity));
    root.style.setProperty('--ring-blur', `${60 + intensity * 20}px`);
  }

  function updateHueHandle(hue) {
    const angle = (hue * Math.PI) / 180;
    const cx = 120, cy = 70;
    const rx = cx * 0.52, ry = cy * 0.52;
    hueHandle.style.left = `${cx + rx * Math.cos(angle - Math.PI / 2)}px`;
    hueHandle.style.top = `${cy + ry * Math.sin(angle - Math.PI / 2)}px`;
  }

  function updateColorReadout() {
    colorReadout.textContent = `Hue: ${Math.round(ringState.hue)}° • ${ringState.isMonochrome ? 'Monochrome' : 'Color'}`;
  }

  function applyRingState() {
    setRingHue(ringState.hue, ringState.intensity, ringState.isMonochrome);
    updateHueHandle(ringState.hue);
    updateColorReadout();
    monochromeToggle.classList.toggle('active', !ringState.isMonochrome);
    monochromeToggle.setAttribute('aria-checked', !ringState.isMonochrome);
    hueRing.classList.toggle('monochrome', ringState.isMonochrome);
    intensitySlider.value = Math.round(ringState.intensity * 100);
    hueRing.setAttribute('aria-valuenow', Math.round(ringState.hue));
  }

  function handleHueRingInteraction(e) {
    if (ringState.isMonochrome) return;
    const rect = hueRing.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX) - (rect.left + rect.width / 2);
    const y = (e.clientY ?? e.touches?.[0]?.clientY) - (rect.top + rect.height / 2);
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    ringState.hue = angle;
    applyRingState();
  }

  let isDraggingHue = false;

  hueRing.addEventListener('mousedown', (e) => {
    if (ringState.isMonochrome) return;
    isDraggingHue = true;
    handleHueRingInteraction(e);
  });
  document.addEventListener('mousemove', (e) => {
    if (isDraggingHue) { e.preventDefault(); handleHueRingInteraction(e); }
  });
  document.addEventListener('mouseup', () => {
    if (isDraggingHue) { isDraggingHue = false; saveRingState(ringState); }
  });
  hueRing.addEventListener('touchstart', (e) => {
    if (ringState.isMonochrome) return;
    isDraggingHue = true;
    handleHueRingInteraction(e);
  });
  document.addEventListener('touchmove', (e) => {
    if (isDraggingHue) { e.preventDefault(); handleHueRingInteraction(e); }
  }, { passive: false });
  document.addEventListener('touchend', () => {
    if (isDraggingHue) { isDraggingHue = false; saveRingState(ringState); }
  });

  hueRing.addEventListener('keydown', (e) => {
    if (ringState.isMonochrome) return;
    let change = 0;
    if (e.key === 'ArrowLeft') change = -1;
    else if (e.key === 'ArrowRight') change = 1;
    if (e.shiftKey) change *= 10;
    if (change !== 0) {
      e.preventDefault();
      ringState.hue = (ringState.hue + change + 360) % 360;
      applyRingState();
      saveRingState(ringState);
    }
  });

  monochromeToggle.addEventListener('click', () => {
    ringState.isMonochrome = !ringState.isMonochrome;
    applyRingState();
    saveRingState(ringState);
  });
  monochromeToggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); monochromeToggle.click(); }
  });
  intensitySlider.addEventListener('input', (e) => {
    ringState.intensity = parseInt(e.target.value) / 100;
    applyRingState();
  });
  intensitySlider.addEventListener('change', () => { saveRingState(ringState); });

  // ===== END RING COLOR SYSTEM =====

  async function createDottedLogo(faviconUrl, element) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    let blobUrl = null;

    try {
      const res = await fetch(faviconUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return;

      const blob = await res.blob();
      blobUrl = URL.createObjectURL(blob);

      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        img.src = blobUrl;
      });

      const size = 64;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const padding = 2;
      ctx.drawImage(img, padding, padding, size - padding * 2, size - padding * 2);
      const data = ctx.getImageData(0, 0, size, size).data;

      const spacing = 3.5;
      const dots = [];
      let count = 0;
      for (let y = 0; y < size; y += spacing) {
        for (let x = 0; x < size; x += spacing) {
          const i = (Math.floor(y) * size + Math.floor(x)) * 4;
          if (data[i + 3] / 255 > 0.3 && (data[i] + data[i + 1] + data[i + 2]) / 3 < 200) {
            dots.push({ cx: x + spacing / 2, cy: y + spacing / 2 });
            count++;
          }
        }
      }

      if (count > 10) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.padding = '2px';
        const ns = 'http://www.w3.org/2000/svg';
        dots.forEach(({ cx, cy }) => {
          const circle = document.createElementNS(ns, 'circle');
          circle.setAttribute('cx', cx);
          circle.setAttribute('cy', cy);
          circle.setAttribute('r', '1');
          circle.setAttribute('fill', '#969798');
          svg.appendChild(circle);
        });
        element.replaceChildren(svg);
      }
    } catch (e) {
      clearTimeout(timeout);
    } finally {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    }
  }

  function normalizeUrl(v) {
    v = (v || '').trim();
    if (!v) return '';
    // Strip any protocol including malformed ones (htps:/, htp://, etc.)
    let bare = v.replace(/^[a-z]+:\/?\/?/i, '').replace(/^www\./i, '').trim();
    if (!bare) return '';
    const slashIdx = bare.indexOf('/');
    const host = (slashIdx === -1 ? bare : bare.slice(0, slashIdx)).toLowerCase();
    const path = slashIdx === -1 ? '' : bare.slice(slashIdx);
    let cleanHost;
    if (!host.includes('.')) {
      // Single word: try fuzzy match against known sites, fall back to .com
      cleanHost = fuzzyMatchSite(host) || (host + '.com');
    } else {
      cleanHost = host;
    }
    return 'https://' + cleanHost + path;
  }

  function getHostname(href) {
    try { return href ? new URL(href).hostname.replace('www.', '') : ''; } catch (e) { return ''; }
  }

  function getCoreName(hostname) {
    const parts = hostname.replace(/^www\./i, '').split('.');
    return parts[0] || hostname;
  }

  function getFaviconUrl(href) {
    try { return href ? `https://icons.duckduckgo.com/ip3/${new URL(href).hostname}.ico` : ''; } catch (e) { return ''; }
  }

  function positionElementOnCircle(el, index, total) {
    if (window.innerWidth <= 520) {
      const linkSize = Math.max(40, Math.min(56, Math.round(window.innerWidth * 0.10)));
      const edgePad = 12; // screen edge → circle edge
      const firstCenter = edgePad + linkSize / 2;
      const lastCenter = window.innerWidth - edgePad - linkSize / 2;
      const perRow = Math.min(4, Math.max(1, Math.floor((window.innerWidth - 2 * edgePad + 18) / (linkSize + 18))));
      const spacing = perRow > 1 ? (lastCenter - firstCenter) / (perRow - 1) : 0;
      const gap = spacing - linkSize;

      const row = Math.floor(index / perRow);
      const col = index % perRow;
      const totalRows = Math.ceil(total / perRow);
      const rowCount = row === totalRows - 1 ? total - row * perRow : perRow;

      const searchRect = searchInput.getBoundingClientRect();
      const orbitRect = orbit.getBoundingClientRect();

      let screenCenterX;
      if (rowCount >= perRow) {
        // Full row: spread from edge to edge
        screenCenterX = firstCenter + col * spacing;
      } else if (rowCount === 1) {
        // Single link: dead center
        screenCenterX = window.innerWidth / 2;
      } else {
        // Partial last row: center using same gap
        const rowWidth = rowCount * linkSize + (rowCount - 1) * gap;
        screenCenterX = (window.innerWidth - rowWidth) / 2 + col * (linkSize + gap) + linkSize / 2;
      }

      const linkCenterX = screenCenterX - orbitRect.left;
      const linkCenterY = (searchRect.bottom - orbitRect.top) + 44 + row * (linkSize + 48) + linkSize / 2;

      el.style.left = `${linkCenterX}px`;
      el.style.top = `${linkCenterY}px`;
      el.style.transform = 'translate(-50%,-50%)';
      return;
    }
    const angle = (Math.PI * 2 / total) * index - Math.PI / 2;
    el.style.left = `calc(50% + ${Math.cos(angle) * orbitRadius.x}px)`;
    el.style.top = `calc(50% + ${Math.sin(angle) * orbitRadius.y}px)`;
    el.style.transform = 'translate(-50%,-50%)';
  }

  let dragState = null;

  function startDrag(e, srcIdx) {
    const linkEls = Array.from(orbit.querySelectorAll('.orbit-link')).filter(el => el.style.display !== 'none');
    const srcEl = linkEls[srcIdx];
    const srcRect = srcEl.getBoundingClientRect();

    const origStyles = linkEls.map(el => ({ left: el.style.left, top: el.style.top }));
    const centers = linkEls.map(el => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    const ghost = srcEl.cloneNode(true);
    ghost.style.cssText = `position:fixed;width:${srcRect.width}px;height:${srcRect.height}px;` +
      `left:${srcRect.left}px;top:${srcRect.top}px;transform:none;pointer-events:none;` +
      `z-index:9999;transition:none;margin:0;opacity:1;animation:none;`;
    document.body.appendChild(ghost);

    srcEl.style.visibility = 'hidden';
    srcEl.style.pointerEvents = 'none';

    dragState = {
      srcIdx, srcEl, ghost, linkEls, origStyles,
      centers, srcCenter: centers[srcIdx],
      w: srcRect.width, h: srcRect.height,
      pendingSwap: null, moved: false,
      startX: e.clientX, startY: e.clientY
    };

    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    document.addEventListener('pointercancel', onDragEnd);
  }

  function onDragMove(e) {
    if (!dragState) return;
    const { ghost, centers, srcCenter, srcIdx, linkEls, origStyles, w, h } = dragState;

    if (!dragState.moved) {
      if (Math.hypot(e.clientX - dragState.startX, e.clientY - dragState.startY) < 6) return;
      dragState.moved = true;
    }

    ghost.style.left = `${e.clientX - w / 2}px`;
    ghost.style.top = `${e.clientY - h / 2}px`;

    let bestIdx = null;
    let bestDist = Infinity;
    for (let i = 0; i < linkEls.length; i++) {
      if (i === srcIdx) continue;
      const tgt = centers[i];
      const dSrcTgt = Math.hypot(tgt.x - srcCenter.x, tgt.y - srcCenter.y);
      const dCurTgt = Math.hypot(e.clientX - tgt.x, e.clientY - tgt.y);
      if (dCurTgt < dSrcTgt / 2 && dCurTgt < bestDist) {
        bestDist = dCurTgt;
        bestIdx = i;
      }
    }

    if (bestIdx !== dragState.pendingSwap) {
      if (dragState.pendingSwap !== null) {
        const prev = linkEls[dragState.pendingSwap];
        prev.style.transition = 'left 0.22s ease, top 0.22s ease';
        prev.style.left = origStyles[dragState.pendingSwap].left;
        prev.style.top = origStyles[dragState.pendingSwap].top;
      }
      dragState.pendingSwap = bestIdx;
      if (bestIdx !== null) {
        const tgt = linkEls[bestIdx];
        tgt.style.transition = 'left 0.22s ease, top 0.22s ease';
        tgt.style.left = origStyles[srcIdx].left;
        tgt.style.top = origStyles[srcIdx].top;
      }
    }
  }

  function onDragEnd(e) {
    if (!dragState) return;
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
    document.removeEventListener('pointercancel', onDragEnd);

    const { srcIdx, srcEl, ghost, linkEls, origStyles, pendingSwap, moved } = dragState;
    dragState = null;
    ghost.remove();

    if (!moved) {
      srcEl.style.visibility = '';
      srcEl.style.pointerEvents = '';
      window.location.href = srcEl.href;
      return;
    }

    if (pendingSwap !== null) {
      srcEl.style.pointerEvents = '';
      setTimeout(() => {
        linkEls.forEach(el => {
          el.style.transition = '';
          el.style.visibility = '';
          el.style.pointerEvents = '';
        });
        const links = [...state.links];
        [links[srcIdx], links[pendingSwap]] = [links[pendingSwap], links[srcIdx]];
        saveState({ ...state, links });
        renderLinks();
      }, 240);
    } else {
      srcEl.style.visibility = '';
      srcEl.style.pointerEvents = '';
    }
  }

  function renderLinks() {
    const linkEls = orbit.querySelectorAll('.orbit-link');
    linkEls.forEach(el => {
      el.style.display = 'none';
      el.style.visibility = '';
      el.style.transition = '';
      el.style.pointerEvents = '';
    });

    const activeLinks = state.links.filter(url => url?.trim());
    activeLinks.forEach((url, idx) => {
      const el = linkEls[idx];
      if (!el) return;
      const hostname = getHostname(url) || `Link ${idx + 1}`;
      el.style.display = 'inline-flex';
      el.href = url;
      el.setAttribute('aria-label', hostname);
      el.dataset.label = getCoreName(hostname);
      el.dataset.index = idx;
      el.draggable = false;
      el.innerHTML = '';

      const letterSpan = document.createElement('span');
      letterSpan.textContent = hostname[0].toUpperCase();
      letterSpan.style.cssText = "font-family:'Doto',sans-serif;font-variation-settings:'ROND' 100;font-weight:700;font-size:clamp(20px,2.5vw,32px)";
      el.appendChild(letterSpan);

      createDottedLogo(getFaviconUrl(url), el);
      positionElementOnCircle(el, idx, activeLinks.length);

    });

    setTabOrder();
  }

  function setTabOrder() {
    searchInput.tabIndex = 1;
    const links = Array.from(orbit.querySelectorAll('.orbit-link'));
    links.forEach((el, idx) => { el.tabIndex = 2 + idx; });
    gearBtn.tabIndex = 2 + links.length;
  }

  function openModal() {
    populateSettingsForm();
    modal.setAttribute('aria-hidden', 'false');
    modal.querySelector('.modal-panel')?.focus();
  }
  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    gearBtn.focus();
  }

  function wireUrlInput(input) {
    input.addEventListener('blur', (e) => {
      const raw = e.target.value.trim();
      if (!raw) return;
      e.target.value = normalizeUrl(raw);
    });
  }

  function populateSettingsForm() {
    const linksGrid = document.querySelector('.links-grid');
    linksGrid.innerHTML = '';

    state.links.forEach((url, i) => {
      const row = document.createElement('div');
      row.className = 'link-row';
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.linkIndex = i;
      input.value = url || '';
      input.placeholder = 'Link';
      input.autocomplete = 'off';
      input.setAttribute('autocapitalize', 'none');
      input.spellcheck = false;
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove';
      removeBtn.dataset.index = i;
      removeBtn.setAttribute('aria-label', 'Remove link');
      removeBtn.textContent = '×';
      row.appendChild(input);
      row.appendChild(removeBtn);
      linksGrid.appendChild(row);
      wireUrlInput(input);
    });

    if (state.links.length < 10) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn-add';
      addBtn.textContent = '+';
      addBtn.onclick = addNewLink;
      linksGrid.appendChild(addBtn);
    }

    const ph = document.getElementById('placeholder');
    if (ph) ph.value = state.placeholder || '';
  }

  function addNewLink() {
    if (state.links.length < 10) { state.links.push(''); populateSettingsForm(); }
  }

  function removeLink(index) {
    state.links.splice(index, 1);
    populateSettingsForm();
  }

  function handleSave(e) {
    e.preventDefault();
    const newLinks = [];
    document.querySelectorAll('[data-link-index]').forEach(input => {
      const url = input.value.trim();
      if (url) newLinks.push(normalizeUrl(url));
    });
    saveState({ links: newLinks, placeholder: document.getElementById('placeholder').value.trim() || DEFAULTS.placeholder });
    closeModal();
    hydrate();
  }

  function handleReset(e) {
    e.preventDefault();
    if (!confirm('Reset to defaults?')) return;
    resetState();
    ringState = { ...RING_DEFAULTS };
    saveRingState(ringState);
    applyRingState();
    populateSettingsForm();
    hydrate();
  }

  function createPlaceholderEffect() {
    searchInput.setAttribute('placeholder', '');
    const wrapper = searchInput.parentElement;
    wrapper.querySelector('.custom-placeholder-wrapper')?.remove();

    const fullText = state?.placeholder || DEFAULTS.placeholder;
    const text = (window.innerWidth <= 520 && fullText === DEFAULTS.placeholder)
      ? 'search nest…'
      : fullText;
    placeholderSpan = document.createElement('div');
    placeholderSpan.className = 'custom-placeholder-wrapper';

    text.split('').forEach(char => {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = char === ' ' ? ' ' : char;
      placeholderSpan.appendChild(span);
    });

    wrapper.appendChild(placeholderSpan);

    // Lock each char's width at max weight so font-weight changes never shift spacing
    document.fonts.ready.then(() => {
      const chars = placeholderSpan.querySelectorAll('.char');
      chars.forEach(char => { char.style.fontWeight = '900'; });
      placeholderSpan.offsetWidth; // force reflow to measure at max weight
      chars.forEach(char => {
        char.style.width = `${char.getBoundingClientRect().width}px`;
        char.style.fontWeight = '';
      });
      placeholderSpan._chars = Array.from(chars);
    });
  }

  function updateRingCy() {
    const rect = searchInput.getBoundingClientRect();
    const cy = rect.top + rect.height / 2;
    document.documentElement.style.setProperty('--ring-cy', `${cy}px`);
  }

  function hydrate() {
    state = loadState();
    searchInput.placeholder = state.placeholder || DEFAULTS.placeholder;
    renderLinks();
    createPlaceholderEffect();
    requestAnimationFrame(updateRingCy);
  }

  let resizeTO = null;
  function onResize() {
    clearTimeout(resizeTO);
    resizeTO = setTimeout(() => { applyOrbitRadius(getOrbitRadius()); renderLinks(); createPlaceholderEffect(); updateRingCy(); }, 80);
  }

  function init() {
    ringState = loadRingState();
    applyRingState();
    applyOrbitRadius(getOrbitRadius());
    state = loadState();

    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const query = searchInput.value.trim();
        if (query) window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(query);
        return false;
      }
    }, true);

    orbit.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const link = e.target.closest('.orbit-link');
      if (!link) return;
      const idx = parseInt(link.dataset.index);
      if (isNaN(idx)) return;
      e.preventDefault();
      startDrag(e, idx);
    });

    gearBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openModal(); });
    resetBtn.addEventListener('click', handleReset);
    settingsForm.addEventListener('submit', handleSave);

    const placeholderInput = document.getElementById('placeholder');
    if (placeholderInput) {
      let hasCleared = false;
      placeholderInput.addEventListener('focus', function() { if (!hasCleared) { this.value = ''; hasCleared = true; } });
      placeholderInput.addEventListener('blur', function() { hasCleared = false; });
    }

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove')) removeLink(parseInt(e.target.dataset.index));
    });

    modal.addEventListener('click', (ev) => { if (ev.target === modal) closeModal(); });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
    });

    // Attached once — references placeholderSpan by closure so no leak across hydrate calls
    searchInput.addEventListener('mousemove', (e) => {
      if (!placeholderSpan || searchInput.value !== '') return;
      const chars = placeholderSpan._chars;
      if (!chars?.length) return;
      const maxDistance = 90;
      chars.forEach(char => {
        const r = char.getBoundingClientRect();
        const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
        const ratio = Math.min(dist / maxDistance, 1);
        char.style.fontWeight = Math.round(900 - ratio * 200);
        char.style.webkitTextStroke = `${(0.6 + (1 - ratio) * 1.6).toFixed(2)}px #969798`;
        char.style.paintOrder = 'stroke fill';
      });
    });

    searchInput.addEventListener('mouseleave', () => {
      placeholderSpan?._chars?.forEach(char => {
        char.style.fontWeight = '';
        char.style.webkitTextStroke = '';
        char.style.paintOrder = '';
      });
    });

    searchInput.addEventListener('input', () => {
      if (placeholderSpan) placeholderSpan.style.display = searchInput.value !== '' ? 'none' : 'flex';
    });

    window.addEventListener('resize', onResize);
    hydrate();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
