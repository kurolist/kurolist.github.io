document.addEventListener("DOMContentLoaded", () => {
  /////////////////////////////
  // HELPERS
  /////////////////////////////
  async function translateToFrench(text) {
    if (!text || text === "Pas de résumé.") return text;
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fr&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      return data[0].map(segment => segment[0]).join('');
    } catch (e) { return text; }
  }

  const safeJsonParse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback; } catch { return fallback; } };
  
  // On récupère les réglages (hideNSFW est true par défaut)
  const getSettings = () => { 
    const defaults = { hideNSFW: true }; 
    return { ...defaults, ...safeJsonParse(localStorage.getItem("settings"), defaults) }; 
  };

  const normalize = (text = "") => String(text).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const debounce = (fn, delay = 300) => { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; };
  const escapeHtml = (value = "") => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const getItemId = (item) => String(item?.mal_id ?? item?.id ?? item?.title ?? Math.random());

  const getItemTypeLabel = (item) => {
    if (item?.source === "anime") return "Anime";
    if (item?.source === "manga") return "Manga";
    if (item?.source === "webtoon") return "Webtoon";
    return item?.type || "N/A";
  };

  const getGenresText = (item) => {
    const genres = [ ...(item?.genres || []), ...(item?.explicit_genres || []), ...(item?.themes || []), ...(item?.demographics || []) ]
      .map((g) => g?.name).filter(Boolean);
    const unique = [...new Set(genres)];
    return unique.length ? unique.join(" • ") : "N/A";
  };

  const getSynopsis = (item) => {
    if (!item) return "Pas de résumé.";
    let d = item.synopsis || item.description || item.attributes?.description;
    if (typeof d === "object") return d.fr || d.en || "Pas de résumé.";
    return d || "Pas de résumé.";
  };

  const getTrailerInfo = (item) => {
    const trailer = item?.trailer || item?.attributes?.trailer || null;
    const youtubeId = trailer?.youtube_id || null;
    const embedUrl = trailer?.embed_url || (youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : null);
    return { youtubeId, embedUrl };
  };

  function injectCardStyles() {
    if (document.getElementById("kuro-card-style")) return;
    const style = document.createElement("style");
    style.id = "kuro-card-style";
    style.textContent = `
      .anime-card{ cursor:pointer; overflow:hidden; border-radius:16px; background:#17172a; box-shadow:0 8px 24px rgba(0,0,0,.14); transition:transform .18s ease, box-shadow .18s ease; max-width:180px; }
      .anime-card:hover{ transform:translateY(-3px); box-shadow:0 12px 30px rgba(0,0,0,.22); }
      .anime-card img{ width:100%; aspect-ratio:2 / 3; object-fit:cover; display:block; background:#111; }
      .anime-info{ padding:10px; }
      .anime-info h3{ font-size:13px; line-height:1.2; margin:0 0 6px; }
      .anime-info p{ font-size:12px; margin:3px 0; opacity:.92; }
      .buttons{ display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
      .buttons button{ border:0; border-radius:10px; padding:6px 8px; font-size:11px; cursor:pointer; background: #2a2a3d; color: #fff; }
      .kuro-select { background: #1a1a2e; color: #fff; border: 1px solid #333; border-radius: 8px; padding: 5px; font-size: 12px; cursor: pointer; }
      @media (max-width: 700px){ .anime-card{ max-width: 100%; } }
    `;
    document.head.appendChild(style);
  }

  /////////////////////////////
  // MENU HAMBURGER
  /////////////////////////////
  const hamburger = document.getElementById("hamburger");
  const sideMenu = document.getElementById("side-menu");
  const closeBtn = document.getElementById("close-menu");

  if (hamburger && sideMenu) {
    hamburger.addEventListener("click", (e) => { e.stopPropagation(); sideMenu.classList.toggle("open"); });
    closeBtn?.addEventListener("click", (e) => { e.preventDefault(); sideMenu.classList.remove("open"); });
  }

  /////////////////////////////
  // ELEMENTS
  /////////////////////////////
  const searchInput = document.getElementById("catalogue-search");
  const resultsContainer = document.getElementById("catalogue-results");
  const typeFilters = document.querySelectorAll(".type-filter");
  const genreFilter = document.getElementById("genre-filter");
  const scoreFilter = document.getElementById("score-filter");
  const sortFilter = document.getElementById("sort-filter");

  let myAnimeList = safeJsonParse(localStorage.getItem("myAnimeList"), []);
  let myFavorites = safeJsonParse(localStorage.getItem("myFavorites"), []);

  /////////////////////////////
  // MODAL
  /////////////////////////////
  let detailsModal = null;
  function injectModalStyles() {
    if (document.getElementById("kuro-details-style")) return;
    const style = document.createElement("style");
    style.id = "kuro-details-style";
    style.textContent = `
      .kuro-modal-backdrop{ position:fixed; inset:0; background:rgba(0,0,0,.72); display:none; align-items:center; justify-content:center; padding:18px; z-index:20000; }
      .kuro-modal-backdrop.open{ display:flex; }
      .kuro-modal{ width:min(900px,100%); max-height:92vh; overflow:auto; background:#1a1a2e; border:1px solid rgba(255,255,255,.08); border-radius:18px; box-shadow:0 20px 60px rgba(0,0,0,.55); color:#fff; }
      .kuro-modal-header{ display:flex; justify-content:space-between; gap:12px; align-items:flex-start; padding:16px 16px 0 16px; }
      .kuro-modal-title{ margin:0; font-size:22px; line-height:1.2; }
      .kuro-modal-close{ border:0; background:#2a2a3d; color:#fff; border-radius:999px; padding:8px 12px; cursor:pointer; }
      .kuro-modal-body{ display:grid; grid-template-columns:220px 1fr; gap:16px; padding:16px; }
      .kuro-modal-cover{ width:100%; border-radius:14px; object-fit:cover; background:#111; min-height:310px; }
      .kuro-modal-meta{ display:grid; gap:10px; }
      .kuro-pill-row{ display:flex; flex-wrap:wrap; gap:8px; }
      .kuro-pill{ display:inline-block; background:rgba(0,173,181,.16); color:#7ce8ee; border:1px solid rgba(0,173,181,.22); padding:4px 10px; border-radius:999px; font-size:12px; }
      .kuro-modal-actions{ display:flex; flex-wrap:wrap; gap:10px; margin-top:4px; }
      .kuro-modal-actions button{ border:0; background:#00adb5; color:#fff; border-radius:10px; padding:9px 12px; cursor:pointer; }
      .kuro-trailer{ margin-top:10px; aspect-ratio:16 / 9; width:100%; border:0; border-radius:14px; background:#000; }
      @media (max-width: 760px){ .kuro-modal-body{ grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function closeDetailsModal() { if (detailsModal) detailsModal.classList.remove("open"); }

  async function openDetailsModal(item) {
    injectModalStyles();
    if (!detailsModal) {
      detailsModal = document.createElement("div");
      detailsModal.className = "kuro-modal-backdrop";
      detailsModal.innerHTML = `<div class="kuro-modal"><div class="kuro-modal-header"><h2 class="kuro-modal-title" id="kuro-modal-title"></h2><button class="kuro-modal-close">✕</button></div><div class="kuro-modal-body"><img class="kuro-modal-cover" alt=""><div class="kuro-modal-meta"></div></div></div>`;
      document.body.appendChild(detailsModal);
      detailsModal.onclick = (e) => { if(e.target === detailsModal) closeDetailsModal(); };
      detailsModal.querySelector(".kuro-modal-close").onclick = closeDetailsModal;
    }
    const titleEl = detailsModal.querySelector("#kuro-modal-title");
    const coverEl = detailsModal.querySelector(".kuro-modal-cover");
    const metaEl = detailsModal.querySelector(".kuro-modal-meta");
    const trailer = getTrailerInfo(item);

    titleEl.textContent = item?.title || "Sans titre";
    coverEl.src = item?.images?.jpg?.image_url || item?.cover || "https://via.placeholder.com/300x450";
    
    metaEl.innerHTML = `
      <div class="kuro-pill-row">
        <span class="kuro-pill">${escapeHtml(getItemTypeLabel(item))}</span>
        <span class="kuro-pill">Note : ${escapeHtml(String(item?.score ?? item?.mean ?? "N/A"))}</span>
      </div>
      <p><strong>Genres :</strong> ${escapeHtml(getGenresText(item))}</p>
      <p><strong>Résumé :</strong> <span id="kuro-synopsis">Traduction... ⏳</span></p>
      <div class="kuro-modal-actions">
        <button type="button" class="add-list-modal">Ma liste</button>
        <button type="button" class="add-fav-modal">Favoris</button>
      </div>
      <div class="trailer-slot"></div>
    `;

    const trailerSlot = metaEl.querySelector(".trailer-slot");
    if (trailer?.embedUrl) trailerSlot.innerHTML = `<iframe class="kuro-trailer" src="${trailer.embedUrl}" allowfullscreen></iframe>`;
    else trailerSlot.innerHTML = `<div class="kuro-trailer-empty" style="color:#aaa; font-size:12px; margin-top:10px;">Aucun trailer disponible.</div>`;

    metaEl.querySelector(".add-list-modal").onclick = () => addToMyList(item);
    metaEl.querySelector(".add-fav-modal").onclick = () => addToFavorites(item);

    detailsModal.classList.add("open");
    const trans = await translateToFrench(getSynopsis(item));
    if (detailsModal.querySelector("#kuro-synopsis")) detailsModal.querySelector("#kuro-synopsis").textContent = trans;
  }

  /////////////////////////////
  // LISTE / FAVORIS
  /////////////////////////////
  function addToMyList(item) {
    const id = getItemId(item);
    if (!myAnimeList.some((a) => getItemId(a) === id)) {
      myAnimeList.push({ ...item, mal_id: id, listStatus: "plan" });
      localStorage.setItem("myAnimeList", JSON.stringify(myAnimeList));
      alert("Ajouté !");
    }
  }

  function addToFavorites(item) {
    const id = getItemId(item);
    if (!myFavorites.some((a) => getItemId(a) === id)) {
      myFavorites.push({ ...item, mal_id: id });
      localStorage.setItem("myFavorites", JSON.stringify(myFavorites));
      alert("Favori ajouté !");
    }
  }

  /////////////////////////////
  // FETCH
  /////////////////////////////
  async function fetchJikan(query, types = []) {
    const wantsAnime = types.length === 0 || types.includes("anime");
    const wantsManga = types.length === 0 || types.includes("manga");
    const requests = [];
    try {
      if (query) {
        if (wantsAnime) requests.push(fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=25`).then(r => r.json()));
        if (wantsManga) requests.push(fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=25`).then(r => r.json()));
      } else {
        if (wantsAnime) requests.push(fetch(`https://api.jikan.moe/v4/top/anime?limit=25`).then(r => r.json()));
        if (wantsManga) requests.push(fetch(`https://api.jikan.moe/v4/top/manga?limit=25`).then(r => r.json()));
      }
      const results = await Promise.all(requests);
      let finalData = [];
      if (wantsAnime && results[0]) finalData.push(...(results[0].data || []).map(i => ({ ...i, source: "anime" })));
      const mIdx = wantsAnime ? 1 : 0;
      if (wantsManga && results[mIdx]) finalData.push(...(results[mIdx].data || []).map(i => ({ ...i, source: "manga" })));
      return finalData;
    } catch { return []; }
  }

  async function fetchWebtoon(query, types = []) {
    if (types.length > 0 && !types.includes("webtoon")) return [];
    try {
      const url = query ? `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=25&includes[]=cover_art` : `https://api.mangadex.org/manga?limit=25&includes[]=cover_art&order[followedCount]=desc`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.data) return [];
      return data.data.map((i) => {
        const cover = i.relationships?.find((r) => r.type === "cover_art")?.attributes?.fileName;
        return {
          id: i.id, mal_id: i.id, source: "webtoon", title: i.attributes.title.en || Object.values(i.attributes.title)[0],
          type: "Webtoon", score: 0, synopsis: i.attributes.description.fr || i.attributes.description.en || "Pas de résumé.",
          genres: i.attributes.tags.map(t => ({ name: t.attributes.name.en })),
          images: { jpg: { image_url: cover ? `https://uploads.mangadex.org/covers/${i.id}/${cover}.512.jpg` : "" } }
        };
      });
    } catch { return []; }
  }

  async function loadData(query, types) {
    const [jikan, webtoon] = await Promise.all([ fetchJikan(query, types), fetchWebtoon(query, types) ]);
    return [...jikan, ...webtoon];
  }

  /////////////////////////////
  // SEARCH (AVEC LE FILTRE NSFW RÉPARÉ)
  /////////////////////////////
  async function search() {
    if (!searchInput || !resultsContainer) return;
    const query = normalize(searchInput.value.trim());
    const types = Array.from(typeFilters).filter((v) => v.checked).map((v) => v.value.toLowerCase());

    resultsContainer.innerHTML = "<p style='text-align:center; padding:20px; width:100%; color:#b7b7c9;'>Chargement... ⏳</p>";

    let data = await loadData(query, types);

    // --- 1. FILTRE NSFW (SÉCURITÉ) ---
    const settings = getSettings();
    if (settings.hideNSFW) {
      data = data.filter(item => {
        const genres = getGenresText(item).toLowerCase();
        const title = normalize(item.title);
        const rating = String(item.rating || "").toLowerCase();
        
        // On bloque si le genre ou le titre contient des mots-clés adultes
        const isAdult = genres.includes("hentai") || 
                        genres.includes("ecchi") || 
                        genres.includes("erotica") || 
                        rating.includes("hentai") ||
                        title.includes("hentai");
        return !isAdult;
      });
    }

    // --- 2. FILTRE PAR GENRE ---
    const selectedGenre = genreFilter.value.toLowerCase();
    if (selectedGenre) {
      data = data.filter(item => getGenresText(item).toLowerCase().includes(selectedGenre));
    }

    // --- 3. FILTRE PAR SCORE ---
    const minScore = parseFloat(scoreFilter.value) || 0;
    if (minScore > 0) {
      data = data.filter(item => (item.score || item.mean || 0) >= minScore);
    }

    // --- 4. LOGIQUE DE RECHERCHE TEXTUELLE ---
    if (query) {
      const words = query.split(/\s+/);
      data = data.filter((item) => words.every((word) => normalize(item.title).includes(word)));
    }

    // --- 5. TRI ---
    const sortVal = sortFilter.value;
    data.sort((a, b) => {
      if (sortVal === "score") return (b.score || b.mean || 0) - (a.score || a.mean || 0);
      if (sortVal === "title") return a.title.localeCompare(b.title);
      return 0;
    });

    resultsContainer.innerHTML = "";
    if (!data.length) {
      resultsContainer.innerHTML = "<p style='text-align:center; width:100%; color:#b7b7c9;'>Aucun résultat trouvé 😢</p>";
      return;
    }

    data.slice(0, 100).forEach((item) => {
      const card = createCard(item);
      resultsContainer.appendChild(card);
    });
  }

  function createCard(item) {
    const card = document.createElement("div");
    card.className = "anime-card";
    const img = item?.images?.jpg?.image_url || item?.cover || "";
    card.innerHTML = `
      <img src="${escapeHtml(img || "https://via.placeholder.com/300x450")}" alt="${escapeHtml(item.title)}">
      <div class="anime-info">
        <h3>${escapeHtml(item.title)}</h3>
        <p>Type: ${escapeHtml(getItemTypeLabel(item))}</p>
        <p>⭐ ${escapeHtml(String(item.score || item.mean || "N/A"))}</p>
        <div class="buttons">
          <button class="list-btn">Ma liste</button>
          <button class="fav-btn">Favoris</button>
        </div>
      </div>
    `;
    card.onclick = () => {
        if (item?.source === "anime" || item?.source === "manga") fetchDetailedItem(item).then(openDetailsModal).catch(() => openDetailsModal(item));
        else openDetailsModal(item);
    };
    card.querySelector(".list-btn").onclick = (e) => { e.stopPropagation(); addToMyList(item); };
    card.querySelector(".fav-btn").onclick = (e) => { e.stopPropagation(); addToFavorites(item); };
    return card;
  }

  async function fetchDetailedItem(item) {
    const id = item?.mal_id ?? item?.id;
    try {
      const res = await fetch(`https://api.jikan.moe/v4/${item.source}/${id}/full`);
      const json = await res.json();
      return { ...item, ...json.data };
    } catch { return item; }
  }

  const debouncedSearch = debounce(search, 300);
  searchInput?.addEventListener("input", debouncedSearch);
  typeFilters.forEach((cb) => cb.addEventListener("change", search));
  genreFilter.addEventListener("change", search);
  scoreFilter.addEventListener("input", debouncedSearch);
  sortFilter.addEventListener("change", search);

  injectCardStyles();
  search();
});
