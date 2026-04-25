(() => {
  const STORAGE_DEFAULTS = {
    myAnimeList: [],
    myFavorites: [],
    settings: { hideNSFW: true },
  };

  const NSFW_KEYWORDS = ["hentai", "ecchi", "sex", "erotic"];

  const safeJsonParse = (value, fallback) => {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  const getJson = (key, fallback = STORAGE_DEFAULTS[key] ?? null) =>
    safeJsonParse(localStorage.getItem(key), fallback);

  const setJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

  const normalize = (value = "") =>
    String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const debounce = (fn, delay = 300) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const getSettings = () => ({
    ...STORAGE_DEFAULTS.settings,
    ...getJson("settings", STORAGE_DEFAULTS.settings),
  });

  const isHiddenContent = (title, settings = getSettings()) => {
    if (!settings.hideNSFW) return false;
    const normalized = normalize(title);
    return NSFW_KEYWORDS.some((keyword) => normalized.includes(keyword));
  };

  const setupSideMenu = () => {
    const hamburger = document.getElementById("hamburger");
    const sideMenu = document.getElementById("side-menu");
    const closeBtn = document.getElementById("close-menu");

    if (!hamburger || !sideMenu || sideMenu.dataset.kuroReady === "1") return;
    sideMenu.dataset.kuroReady = "1";

    const openMenu = () => sideMenu.classList.add("open");
    const closeMenu = () => sideMenu.classList.remove("open");

    hamburger.addEventListener("click", (event) => {
      event.stopPropagation();
      sideMenu.classList.toggle("open");
    });

    closeBtn?.addEventListener("click", (event) => {
      event.preventDefault();
      closeMenu();
    });

    document.addEventListener("click", (event) => {
      if (
        sideMenu.classList.contains("open") &&
        !sideMenu.contains(event.target) &&
        !hamburger.contains(event.target)
      ) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  };

  const dedupeById = (items) => {
    const seen = new Set();
    return items.filter((item) => {
      const key = `${item.source || "item"}-${item.mal_id ?? item.id ?? item.title ?? Math.random()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const createMediaCardBase = (item) => {
    const card = document.createElement("article");
    card.className = "anime-card";

    const img = document.createElement("img");
    img.src = item.images?.jpg?.image_url || item.cover || item.image || "https://via.placeholder.com/300x450?text=Kurolist";
    img.alt = item.title || "Visuel";
    img.loading = "lazy";
    img.decoding = "async";

    const info = document.createElement("div");
    info.className = "anime-info";

    const title = document.createElement("h3");
    title.textContent = item.title || "Sans titre";

    info.appendChild(title);
    card.append(img, info);

    return { card, info, img, title };
  };

  const appendMeta = (parent, label, value) => {
    const p = document.createElement("p");
    if (label) {
      const strong = document.createElement("strong");
      strong.textContent = `${label} `;
      p.appendChild(strong);
      p.appendChild(document.createTextNode(value ?? "N/A"));
    } else {
      p.textContent = value ?? "N/A";
    }
    parent.appendChild(p);
    return p;
  };

  window.Kuro = {
    getJson,
    setJson,
    normalize,
    debounce,
    getSettings,
    isHiddenContent,
    setupSideMenu,
    dedupeById,
    createMediaCardBase,
    appendMeta,
  };
})();
