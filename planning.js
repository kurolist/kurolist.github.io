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
        
        // On charge les mangas seulement si la section est vide
        if (!mangaSection.innerHTML || mangaSection.innerHTML.includes("Chargement")) {
            initManga();
        }
    });

    // --- CACHE ---
    function isCacheValid(storageKey) {    
        const savedTime = localStorage.getItem(storageKey);    
        if (!savedTime) return false;    
        const oneWeek = 7 * 24 * 60 * 60 * 1000;    
        return (Date.now() - parseInt(savedTime)) < oneWeek;    
    }    

    // --- LOGIQUE ANIME (VERSION ORIGINALE) ---
    function displayPlanning(data) {    
        const grid = document.createElement('div');    
        grid.className = 'calendar-grid';    

        data.forEach(dayData => {    
            const column = document.createElement('div');    
            column.className = 'day-column';    
            column.innerHTML = `<h2>${daysFR[dayData.day]}</h2>`;    

            dayData.animes.forEach(anime => {    
                const card = document.createElement('div');    
                card.className = 'calendar-card';    
                card.innerHTML = `    
                    <img src="${anime.img}">    
                    <p>${anime.title}</p>    
                `;    
                column.appendChild(card);    
            });    
            grid.appendChild(column);    
        });    

        weeklySection.innerHTML = '';    
        weeklySection.appendChild(grid);    
    }    

    async function fetchWeeklySchedule() {    
        weeklySection.innerHTML = "<p>Chargement...</p>";    
        const usedAnime = new Set();    

        const query = `    
        query ($page: Int) {    
          Page(page: $page, perPage: 100) {    
            media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {    
              id    
              title { romaji }    
              coverImage { large }    
              airingSchedule { nodes { airingAt } }    
            }    
          }    
        }`;    

        try {
            const res = await fetch("https://graphql.anilist.co", {    
                method: "POST",    
                headers: { "Content-Type": "application/json" },    
                body: JSON.stringify({ query, variables: { page: 1 } })    
            });    

            const data = await res.json();    
            const animes = data.data.Page.media;    
            const allData = days.map(day => ({ day, animes: [] }));    

            animes.forEach(anime => {    
                if (usedAnime.has(anime.id)) return;    
                usedAnime.add(anime.id);    

                let dayFound = "monday"; // Fallback par défaut
                const schedule = anime.airingSchedule?.nodes?.[0];    

                if (schedule) {    
                    dayFound = mapDays[new Date(schedule.airingAt * 1000).getDay()];    
                }    

                const targetDay = allData.find(d => d.day === dayFound);    
                if (targetDay.animes.length < 40) {    
                    targetDay.animes.push({ title: anime.title.romaji, img: anime.coverImage.large });    
                }    
            });    

            // Remplissage si jours vides (ton ancienne logique)
            allData.forEach(day => {    
                if (day.animes.length === 0) {    
                    day.animes = animes.slice(0, 20).map(a => ({ title: a.title.romaji, img: a.coverImage.large }));    
                }    
            });    

            localStorage.setItem("planning_data", JSON.stringify(allData));    
            localStorage.setItem("planning_time", Date.now());    
            displayPlanning(allData);

        } catch (error) {
            console.error(error);
            weeklySection.innerHTML = "<p>Erreur de chargement.</p>";
        }
    }

    // --- LOGIQUE MANGA ---
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

    async function fetchMangaSchedule() {
        mangaSection.innerHTML = "<p>Chargement des mangas...</p>";
        const query = `query { Page(page: 1, perPage: 50) { media(type: MANGA, status: RELEASING, sort: POPULARITY_DESC) { title { romaji } coverImage { large } } } }`;
        try {
            const res = await fetch("https://graphql.anilist.co", { 
                method: "POST", 
                headers: { "Content-Type": "application/json" }, 
                body: JSON.stringify({ query }) 
            });
            const data = await res.json();
            const mangas = data.data.Page.media;
            localStorage.setItem("manga_data", JSON.stringify(mangas));
            localStorage.setItem("manga_time", Date.now());
            displayMangaPlanning(mangas);
        } catch (e) { console.error(e); }
    }

    // --- INITIALISATION ---
    function initAnime() {
        const savedData = localStorage.getItem("planning_data");    
        if (isCacheValid("planning_time") && savedData) {    
            displayPlanning(JSON.parse(savedData));    
        } else {    
            fetchWeeklySchedule();    
        }
    }

    function initManga() {
        const savedData = localStorage.getItem("manga_data");
        if (isCacheValid("manga_time") && savedData) {
            displayMangaPlanning(JSON.parse(savedData));
        } else {
            fetchMangaSchedule();
        }
    }

    // Lancement par défaut sur les animes
    initAnime();
});
