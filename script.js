document.addEventListener("DOMContentLoaded", () => {
  /////////////////////////////
  // HELPERS
  /////////////////////////////
  
  // TRADUCTEUR AUTOMATIQUE ANGLAIS -> FRANÇAIS
  async function translateToFrench(text) {
    if (!text || text === "Pas de résumé.") return text;
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fr&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      return data[0].map(segment => segment[0]).join('');
    } catch (e) {
      console.error("Erreur de traduction:", e);
      return text;
    }
  }

  const safeJsonParse = (value, fallback) => {
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  const getSettings = () => {
    const defaults = { hideNSFW: true };
    return {
      ...defaults,
      ...safeJsonParse(localStorage.getItem("settings"), defaults),
    };
  };

  const normalize = (text = "") =>
    String(text)
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

  const escapeHtml = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const getItemId = (item) =>
    String(item?.mal_id ?? item?.id ?? item?.title ?? Math.random());

  const getItemTypeLabel = (item) => {
    if (item?.source === "anime") return "Anime";
    if (item?.source === "manga") return "Manga";
    if (item?.source === "webtoon") return "Webtoon";
    return item?.type || "N/A";
  };

  const getGenresText = (item) => {
    const genres = [
      ...(item?.genres || []),
      ...(item?.explicit_genres || []),
      ...(item?.themes || []),
      ...(item?.demographics || []),
    ]
      .map((g) => g?.name)
      .filter(Boolean);

    const unique = [...new Set(genres)];
    return unique.length ? unique.join(" • ") : "N/A";
  };

  const getSynopsis = (item) => {
    if (!item) return "Pas de résumé.";
    if (typeof item.synopsis === "string" && item.synopsis.trim()) return item.synopsis.trim();

    if (item.description && typeof item.description === "string" && item.description.trim()) {
      return item.description.trim();
    }

    if (item.attributes?.description) {
      const desc = item.attributes.description;
      if (typeof desc === "string" && desc.trim()) return desc.trim();
      if (desc?.fr) return desc.fr.trim(); // Priorité au français
      if (desc?.en) return desc.en.trim();
      const firstDesc = Object.values(desc).find((v) => typeof v === "string" && v.trim());
      if (firstDesc) return firstDesc.trim();
    }

    return "Pas de résumé.";
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
      .anime-card{
        cursor:pointer;
        overflow:hidden;
        border-radius:16px;
        background:#17172a;
        box-shadow:0 8px 24px rgba(0,0,0,.14);
        transition:transform .18s ease, box-shadow .18s ease;
        max-width:180px;
      }
      .anime-card:hover{
        transform:translateY(-3px);
        box-shadow:0 12px 30px rgba(0,0,0,.22);
      }
      .anime-card img{
        width:100%;
        aspect-ratio:2 / 3;
        object-fit:cover;
        display:block;
        background:#111;
      }
      .anime-info{
        padding:10px;
      }
      .anime-info h3{
        font-size:13px;
        line-height:1.2;
        margin:0 0 6px;
      }
      .anime-info p{
        font-size:12px;
        margin:3px 0;
        opacity:.92;
      }
      .buttons{
        display:flex;
        gap:6px;
        flex-wrap:wrap;
        margin-top:8px;
      }
      .buttons button{
        border:0;
        border-radius:10px;
        padding:6px 8px;
        font-size:11px;
        cursor:pointer;
      }
      @media (max-width: 700px){
        .anime-card{ max-width: 100%; }
      }
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
    hamburger.addEventListener("click", (e) => {
      e.stopPropagation();
      sideMenu.classList.toggle("open");
    });

    closeBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      sideMenu.classList.remove("open");
    });

    document.addEventListener("click", (e) => {
      if (
        sideMenu.classList.contains("open") &&
        !sideMenu.contains(e.target) &&
        !hamburger.contains(e.target)
      ) {
        sideMenu.classList.remove("open");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") sideMenu.classList.remove("open");
    });
  }

  /////////////////////////////
  // ELEMENTS
  /////////////////////////////
  const airingSection = document.getElementById("airing-section");
  const searchInput = document.getElementById("search");
  const mangaSection = document.getElementById("manga-section");
  const webtoonSection = document.getElementById("webtoon-section");

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
      .kuro-modal-backdrop{
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.72);
        display:none;
        align-items:center;
        justify-content:center;
        padding:18px;
        z-index:20000;
      }
      .kuro-modal-backdrop.open{ display:flex; }
      .kuro-modal{
        width:min(900px,100%);
        max-height:92vh;
        overflow:auto;
        background:#1a1a2e;
        border:1px solid rgba(255,255,255,.08);
        border-radius:18px;
        box-shadow:0 20px 60px rgba(0,0,0,.55);
        color:#fff;
      }
      .kuro-modal-header{
        display:flex;
        justify-content:space-between;
        gap:12px;
        align-items:flex-start;
        padding:16px 16px 0 16px;
      }
      .kuro-modal-title{
        margin:0;
        font-size:22px;
        line-height:1.2;
      }
      .kuro-modal-close{
        border:0;
        background:#2a2a3d;
        color:#fff;
        border-radius:999px;
        padding:8px 12px;
        cursor:pointer;
      }
      .kuro-modal-body{
        display:grid;
        grid-template-columns:220px 1fr;
        gap:16px;
        padding:16px;
      }
      .kuro-modal-cover{
        width:100%;
        border-radius:14px;
        object-fit:cover;
        background:#111;
        min-height:310px;
      }
      .kuro-modal-meta{
        display:grid;
        gap:10px;
      }
      .kuro-pill-row{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
      }
      .kuro-pill{
        display:inline-block;
        background:rgba(0,173,181,.16);
        color:#7ce8ee;
        border:1px solid rgba(0,173,181,.22);
        padding:4px 10px;
        border-radius:999px;
        font-size:12px;
      }
      .kuro-modal-meta p{
        margin:0;
        color:#ddd;
        line-height:1.5;
      }
      .kuro-modal-meta strong{
        color:#fff;
      }
      .kuro-modal-actions{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        margin-top:4px;
      }
      .kuro-modal-actions button,
      .kuro-modal-actions a{
        border:0;
        background:#00adb5;
        color:#fff;
        text-decoration:none;
        border-radius:10px;
        padding:9px 12px;
        cursor:pointer;
      }
      .kuro-trailer{
        margin-top:10px;
        aspect-ratio:16 / 9;
        width:100%;
        border:0;
        border-radius:14px;
        background:#000;
      }
      .kuro-trailer-empty{
        margin-top:10px;
        padding:12px;
        border-radius:12px;
        background:#111827;
        color:#b7b7c9;
      }
      @media (max-width: 760px){
        .kuro-modal-body{ grid-template-columns:1fr; }
        .kuro-modal-cover{ min-height:240px; }
      }
    `;
    document.head.appendChild(style);
  }

  function closeDetailsModal() {
    if (detailsModal) detailsModal.classList.remove("open");
  }

  async function openDetailsModal(item) {
    injectModalStyles();

    if (!detailsModal) {
      detailsModal = document.createElement("div");
      detailsModal.className = "kuro-modal-backdrop";
      detailsModal.innerHTML = `
        <div class="kuro-modal" role="dialog" aria-modal="true" aria-labelledby="kuro-modal-title">
          <div class="kuro-modal-header">
            <h2 class="kuro-modal-title" id="kuro-modal-title"></h2>
            <button class="kuro-modal-close" type="button">✕</button>
          </div>
          <div class="kuro-modal-body">
            <img class="kuro-modal-cover" alt="">
            <div class="kuro-modal-meta"></div>
          </div>
        </div>
      `;
      document.body.appendChild(detailsModal);

      detailsModal.addEventListener("click", (e) => {
        if (e.target === detailsModal) closeDetailsModal();
      });

      detailsModal.querySelector(".kuro-modal-close").addEventListener("click", closeDetailsModal);

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDetailsModal();
      });
    }

    const titleEl = detailsModal.querySelector("#kuro-modal-title");
    const coverEl = detailsModal.querySelector(".kuro-modal-cover");
    const metaEl = detailsModal.querySelector(".kuro-modal-meta");

    const title = item?.title || "Sans titre";
    const type = getItemTypeLabel(item);
    const score = item?.score ?? item?.mean ?? "N/A";
    const genres = getGenresText(item);
    const synopsisRaw = getSynopsis(item);
    const img =
      item?.images?.jpg?.image_url ||
      item?.images?.webp?.large_image_url ||
      item?.cover ||
      item?.image ||
      "https://via.placeholder.com/300x450?text=Kurolist";

    const trailer = getTrailerInfo(item);

    titleEl.textContent = title;
    coverEl.src = img;
    coverEl.alt = title;

    metaEl.innerHTML = `
      <div class="kuro-pill-row">
        <span class="kuro-pill">${escapeHtml(type)}</span>
        <span class="kuro-pill">Note : ${escapeHtml(String(score))}</span>
      </div>
      <p><strong>Genres :</strong> ${escapeHtml(genres)}</p>
      <p><strong>Résumé :</strong> <span id="kuro-synopsis">Traduction en cours... ⏳</span></p>
      <div class="kuro-modal-actions">
        <button type="button" class="add-list-modal">Ma liste</button>
        <button type="button" class="add-fav-modal">Favoris</button>
      </div>
      <div class="trailer-slot"></div>
    `;

    const trailerSlot = metaEl.querySelector(".trailer-slot");
    if (trailer?.embedUrl) {
      trailerSlot.innerHTML = `
        <iframe
          class="kuro-trailer"
          src="${trailer.embedUrl}"
          title="Trailer"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      `;
    } else {
      trailerSlot.innerHTML = `
        <div class="kuro-trailer-empty">Aucun trailer disponible pour cette entrée.</div>
      `;
    }

    metaEl.querySelector(".add-list-modal").addEventListener("click", () => addToMyList(item));
    metaEl.querySelector(".add-fav-modal").addEventListener("click", () => addToFavorites(item));

    detailsModal.classList.add("open");

    // Lancement de la traduction
    const translatedSynopsis = await translateToFrench(synopsisRaw);
    const synopsisEl = detailsModal.querySelector("#kuro-synopsis");
    if (synopsisEl) {
      synopsisEl.textContent = translatedSynopsis;
    }
  }

  /////////////////////////////
  // LISTE / FAVORIS
  /////////////////////////////
  function addToMyList(item) {
    const id = getItemId(item);
    const exists = myAnimeList.some((a) => String(a.mal_id ?? a.id ?? a.title) === id);

    if (!exists) {
      myAnimeList.push({
        ...item,
        mal_id: item?.mal_id ?? item?.id ?? id,
        source: item?.source || item?.type_source || item?.kind || "anime",
        listStatus: "plan",
      });
      localStorage.setItem("myAnimeList", JSON.stringify(myAnimeList));
      alert("Ajouté à ta liste !");
    }
  }

  function addToFavorites(item) {
    const id = getItemId(item);
    const exists = myFavorites.some((a) => String(a.mal_id ?? a.id ?? a.title) === id);

    if (!exists) {
      myFavorites.push({
        ...item,
        mal_id: item?.mal_id ?? item?.id ?? id,
        source: item?.source || item?.type_source || item?.kind || "anime",
      });
      localStorage.setItem("myFavorites", JSON.stringify(myFavorites));
      alert("Ajouté aux favoris !");
    }
  }

  /////////////////////////////
  // CARD
  /////////////////////////////
  function createAnimeCard(item) {
    const settings = getSettings();
    const titleValue = String(item?.title || "");

    if (settings.hideNSFW) {
      const badWords = ["hentai", "ecchi", "sex", "erotic"];
      if (badWords.some((w) => normalize(titleValue).includes(w))) {
        return document.createDocumentFragment();
      }
    }

    const card = document.createElement("div");
    card.className = "anime-card";
    card.dataset.id = getItemId(item);

    const img =
      item?.images?.jpg?.image_url ||
      item?.images?.webp?.large_image_url ||
      item?.cover ||
      "";

    const type = getItemTypeLabel(item);
    const score = item?.score ?? item?.mean ?? "N/A";
    const genres = getGenresText(item);

    card.innerHTML = `
      <img src="${escapeHtml(img || "https://via.placeholder.com/300x450?text=Kurolist")}" alt="${escapeHtml(titleValue)}">
      <div class="anime-info">
        <h3>${escapeHtml(titleValue)}</h3>
        <p>Type: ${escapeHtml(type)}</p>
        <p>Genres: ${escapeHtml(genres)}</p>
        <p>⭐ ${escapeHtml(String(score))}</p>
        <div class="buttons">
          <button class="list-btn" type="button">Ma liste</button>
          <button class="fav-btn" type="button">Favoris</button>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      if (item?.source === "anime" || item?.source === "manga") {
        fetchDetailedItem(item).then(openDetailsModal).catch(() => openDetailsModal(item));
      } else {
        openDetailsModal(item);
      }
    });

    card.querySelector(".list-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      addToMyList(item);
    });

    card.querySelector(".fav-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      addToFavorites(item);
    });

    return card;
  }

  async function fetchDetailedItem(item) {
    const id = item?.mal_id ?? item?.id;
    if (!id) return item;

    try {
      if (item.source === "anime") {
        const res = await fetch(`https://api.jikan.moe/v4/anime/${id}/full`);
        const json = await res.json();
        return {
          ...item,
          ...json.data,
          source: "anime",
          mal_id: json.data?.mal_id ?? id,
        };
      }

      if (item.source === "manga") {
        const res = await fetch(`https://api.jikan.moe/v4/manga/${id}/full`);
        const json = await res.json();
        return {
          ...item,
          ...json.data,
          source: "manga",
          mal_id: json.data?.mal_id ?? id,
        };
      }

      return item;
    } catch {
      return item;
    }
  }

  /////////////////////////////
  // FETCH JIKAN
  /////////////////////////////
  async function fetchJikan(query) {
    try {
      const [animeRes, mangaRes] = await Promise.all([
        fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=25`),
        fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(query)}&limit=25`),
      ]);

      const animeData = await animeRes.json();
      const mangaData = await mangaRes.json();

      return [
        ...(animeData.data || []).map((i) => ({ ...i, source: "anime" })),
        ...(mangaData.data || []).map((i) => ({ ...i, source: "manga" })),
      ];
    } catch {
      return [];
    }
  }

  /////////////////////////////
  // FETCH WEBTOON
  /////////////////////////////
  /////////////////////////////
// FETCH WEBTOON
/////////////////////////////
async function fetchWebtoon(query) {
  try {
    // Ajout des backticks (`) indispensables pour que ${query} fonctionne
    const res = await fetch(
      `https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=20&includes[]=cover_art`
    );
    
    if (!res.ok) throw new Error("Erreur avec l'API MangaDex");
    const data = await res.json();

    if (!data.data) return [];  

    return data.data.map((i) => {  
      const attrs = i.attributes || {};  
      const titleObj = attrs.title || {};  
      const title = titleObj.en || Object.values(titleObj)[0] || "No title";  

      let image = "https://via.placeholder.com/300x450?text=Kurolist";  
      const cover = i.relationships?.find((r) => r.type === "cover_art");  
      if (cover?.attributes?.fileName) {  
        image = `https://uploads.mangadex.org/covers/${i.id}/${cover.attributes.fileName}.512.jpg`;  
      }  

      const description = attrs.description || {};  
      // Sécurisation au cas où description n'est pas un objet
      const synopsis =  
        description.fr || 
        description.en ||  
        (typeof description === 'object' && Object.values(description).find((v) => typeof v === "string" && v.trim())) ||  
        "Pas de résumé.";  

      const tags =  
        (attrs.tags || [])  
          .map((t) => t?.attributes?.name?.en || (t?.attributes?.name && Object.values(t.attributes.name)[0]))  
          .filter(Boolean) || [];  

      return {  
        id: i.id,  
        mal_id: i.id,  
        source: "webtoon",  
        title,  
        type: "Webtoon",  
        score: attrs.rating || attrs.score || 0,  
        synopsis,  
        genres: tags.map((name) => ({ name })),  
        images: { jpg: { image_url: image } },  
      };  
    });  
  } catch (e) {
    console.error("Erreur de chargement Webtoon (recherche):", e);
    return [];  
  }
}


  /////////////////////////////
  // LOAD DATA
  /////////////////////////////
  async function loadData(query) {
    if (!query) {
      const random = ["a", "love", "one", "the", "star"];
      const randomQuery = random[Math.floor(Math.random() * random.length)];
      const [jikan, webtoon] = await Promise.all([fetchJikan(randomQuery), fetchWebtoon(randomQuery)]);
      return [...jikan, ...webtoon];
    }

    const [jikan, webtoon] = await Promise.all([fetchJikan(query), fetchWebtoon(query)]);
    return [...jikan, ...webtoon];
  }

  /////////////////////////////
  // SCORE
  /////////////////////////////
  function getScore(item, query) {
    const title = normalize(item.title);
    const q = normalize(query);

    let score = 0;

    if (title === q) score += 1000;
    if (title.startsWith(q)) score += 700;
    if (title.includes(q)) score += 300;

    q.split(" ").forEach((word) => {
      if (word && title.includes(word)) score += 150;
    });

    score += (Number(item.score) || 0) * 10;
    return score;
  }

  /////////////////////////////
  // SEARCH
  /////////////////////////////
  async function search() {
    if (!searchInput || !airingSection) return;

    const query = normalize(searchInput.value.trim());
    const settings = getSettings();
    const types = Array.from(document.querySelectorAll(".type-filter"))
      .filter((v) => v.checked)
      .map((v) => v.value.toLowerCase());

    airingSection.innerHTML = "Chargement...";

    let data = await loadData(query);

    if (types.length) {
      data = data.filter((i) => types.includes(i.source));
    }

    if (query) {
      const words = query.split(/\s+/);
      data = data.filter((item) => {
        const title = normalize(item.title);
        return words.every((word) => title.includes(word));
      });

      data.sort((a, b) => getScore(b, query) - getScore(a, query));
    } else if (settings.hideNSFW) {
      data = data.filter(
        (item) =>
          !["hentai", "ecchi", "sex", "erotic"].some((w) => normalize(item.title).includes(w))
      );
    }

    airingSection.innerHTML = "";

    if (!data.length) {
      airingSection.innerHTML = "<p>un problème est survenu réessaye 😢</p>";
      return;
    }

    data.slice(0, 120).forEach((item) => {
      const card = createAnimeCard(item);
      if (card instanceof DocumentFragment) return;
      airingSection.appendChild(card);
    });
  }

  /////////////////////////////
  // FETCH SECTIONS
  /////////////////////////////
  async function fetchAiringAnime() {
    if (!airingSection) return;
    const settings = getSettings();
    const sfwParam = settings.hideNSFW ? "&sfw" : "";

    try {
      const res = await fetch(`https://api.jikan.moe/v4/seasons/now?limit=20${sfwParam}`);
      const data = await res.json();
      airingSection.innerHTML = "";
      (data.data || []).forEach((anime) =>
        airingSection.appendChild(createAnimeCard({ ...anime, source: "anime" }))
      );
    } catch {
      airingSection.innerHTML = "<p>Erreur.</p>";
    }
  }

  async function fetchAiringManga() {
    if (!mangaSection) return;
    try {
      const res = await fetch("https://api.jikan.moe/v4/top/manga?filter=publishing&limit=20");
      const data = await res.json();
      mangaSection.innerHTML = "";
      (data.data || []).forEach((manga) =>
        mangaSection.appendChild(createAnimeCard({ ...manga, source: "manga" }))
      );
    } catch {
      mangaSection.innerHTML = "<p>Erreur.</p>";
    }
  }

  async function fetchAiringWebtoons() {
  if (!webtoonSection) return;

  webtoonSection.innerHTML = "Chargement...";

  // 🔥 requêtes qui marchent vraiment
  const queries = ["solo", "love", "tower", "hero"];

  let allResults = [];

  for (let q of queries) {
    const res = await fetchWebtoon(q);
    allResults = [...allResults, ...res];
  }

  // enlever les doublons
  const unique = [];
  const ids = new Set();

  for (let item of allResults) {
    if (!ids.has(item.id)) {
      ids.add(item.id);
      unique.push(item);
    }
  }

  webtoonSection.innerHTML = "";

  if (!unique.length) {
    webtoonSection.innerHTML = "<p>Impossible de charger les webtoons 😢</p>";
    return;
  }

  unique.slice(0, 20).forEach((webtoon) => {
    webtoonSection.appendChild(createAnimeCard(webtoon));
  });
}

  /////////////////////////////
  // EVENTS
  /////////////////////////////
  if (searchInput) {
    let timeout;
    searchInput.addEventListener("input", () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const query = searchInput.value.trim();

        if (query.length < 2) {
          document.body.classList.remove("search-mode");
          if (mangaSection) mangaSection.style.display = "";
          if (webtoonSection) webtoonSection.style.display = "";
          fetchAiringAnime();
          fetchAiringManga();
          fetchAiringWebtoons();
          return;
        }

        document.body.classList.add("search-mode");
        if (mangaSection) mangaSection.style.display = "none";
        if (webtoonSection) webtoonSection.style.display = "none";
        search();
      }, 350);
    });
  }

  const typeFilters = document.querySelectorAll(".type-filter");
  typeFilters.forEach((cb) => cb.addEventListener("change", search));

  /////////////////////////////
  // INIT
  /////////////////////////////
  injectCardStyles();
  fetchAiringAnime();
  fetchAiringManga();
  fetchAiringWebtoons();
});
