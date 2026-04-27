document.addEventListener("DOMContentLoaded", () => {
    const weeklySection = document.getElementById('weekly-planning');    
    const mangaSection = document.getElementById('manga-planning');
    const btnAnime = document.getElementById('btn-anime');
    const btnManga = document.getElementById('btn-manga');

    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];    
    const daysFR = {    
        monday: "Lundi", tuesday: "Mardi", wednesday: "Mercredi",    
        thursday: "Jeudi", friday: "Vendredi", saturday: "Samedi", sunday: "Dimanche"    
    };    

    const mapDays = { 0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday", 6: "saturday" };

    // --- GESTION DES ONGLETS ---
    btnAnime.addEventListener('click', () => {
        btnAnime.classList.add('active');
        btnManga.classList.remove('active');
        weeklySection.style.display = 'block';
        mangaSection.style.display = 'none';
    });

    btnManga.addEventListener('click', () => {
        btnManga.classList.add('active');
        btnAnime.classList.remove('active');
        weeklySection.style.display = 'none';
        mangaSection.style.display = 'block';
        if (!mangaSection.innerHTML || mangaSection.innerHTML.includes("Chargement")) initManga();
    });

    function isCacheValid(storageKey) {    
        const savedTime = localStorage.getItem(storageKey);    
        if (!savedTime) return false;    
        return (Date.now() - parseInt(savedTime)) < (7 * 24 * 60 * 60 * 1000);    
    }    

    // --- LOGIQUE ANIME (SORTIES DE LA SEMAINE) ---
    async function fetchAnimeSchedule() {    
        weeklySection.innerHTML = "<p>Chargement des sorties de la semaine...</p>";    
        
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)));
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const query = `    
        query ($start: Int, $end: Int) {
          Page(page: 1, perPage: 100) {
            airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
              airingAt
              episode
              media {
                id
                title { romaji }
                coverImage { large }
              }
            }
          }
        }`;

        const variables = { 
            start: Math.floor(startOfWeek.getTime() / 1000), 
            end: Math.floor(endOfWeek.getTime() / 1000) 
        };

        try {
            const res = await fetch("https://graphql.anilist.co", {    
                method: "POST",    
                headers: { "Content-Type": "application/json" },    
                body: JSON.stringify({ query, variables })    
            });    

            const data = await res.json();    
            const schedules = data.data.Page.airingSchedules;    
            const allData = days.map(day => ({ day, animes: [] }));    
            const usedAnime = new Set();

            schedules.forEach(s => {    
                if (!s.media || usedAnime.has(s.media.id)) return;    
                usedAnime.add(s.media.id);    

                const dayFound = mapDays[new Date(s.airingAt * 1000).getDay()];    
                const targetDay = allData.find(d => d.day === dayFound);    
                if (targetDay) {    
                    targetDay.animes.push({ 
                        title: s.media.title.romaji, 
                        img: s.media.coverImage.large,
                        ep: s.episode
                    });    
                }    
            });    

            localStorage.setItem("planning_anime_data", JSON.stringify(allData));    
            localStorage.setItem("planning_anime_time", Date.now());    
            displayAnimePlanning(allData);
        } catch (e) { console.error(e); }
    }

    function displayAnimePlanning(data) {    
        const grid = document.createElement('div');    
        grid.className = 'calendar-grid';    
        data.forEach(dayData => {    
            const column = document.createElement('div');    
            column.className = 'day-column';    
            column.innerHTML = `<h2>${daysFR[dayData.day]}</h2>`;    
            dayData.animes.forEach(anime => {    
                const card = document.createElement('div');    
                card.className = 'calendar-card';    
                card.innerHTML = `<img src="${anime.img}"><p>${anime.title}</p><span>. ${anime.ep}</span>`;    
                column.appendChild(card);    
            });    
            grid.appendChild(column);    
        });    
        weeklySection.innerHTML = '';    
        weeklySection.appendChild(grid);    
    }

    // --- LOGIQUE MANGA ---
    async function fetchMangaSchedule() {
        mangaSection.innerHTML = "<p>Chargement des mangas populaires...</p>";
        const query = `query { Page(page: 1, perPage: 50) { media(type: MANGA, status: RELEASING, sort: POPULARITY_DESC) { title { romaji } coverImage { large } } } }`;
        try {
            const res = await fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
            const data = await res.json();
            const mangas = data.data.Page.media;
            localStorage.setItem("planning_manga_data", JSON.stringify(mangas));
            localStorage.setItem("planning_manga_time", Date.now());
            displayMangaPlanning(mangas);
        } catch (e) { console.error(e); }
    }

    function displayMangaPlanning(mangas) {
        mangaSection.innerHTML = '<div class="calendar-grid"></div>';
        const grid = mangaSection.querySelector('.calendar-grid');
        mangas.forEach(m => {
            const card = document.createElement('div');
            card.className = 'calendar-card';
            card.innerHTML = `<img src="${m.coverImage.large}"><p>${m.title.romaji}</p>`;
            grid.appendChild(card);
        });
    }

    function initAnime() {
        const saved = localStorage.getItem("planning_anime_data");
        if (isCacheValid("planning_anime_time") && saved) displayAnimePlanning(JSON.parse(saved));
        else fetchAnimeSchedule();
    }

    function initManga() {
        const saved = localStorage.getItem("planning_manga_data");
        if (isCacheValid("planning_manga_time") && saved) displayMangaPlanning(JSON.parse(saved));
        else fetchMangaSchedule();
    }

    initAnime();
});
