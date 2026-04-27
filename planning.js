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

    /////////////////////////////    
    // 🔥 GESTION DES ONGLETS
    /////////////////////////////  

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
        
        // Charger les mangas uniquement si on clique sur l'onglet
        if (!mangaSection.innerHTML) {
            initManga();
        }
    });

    /////////////////////////////    
    // 🔥 CACHE (1 SEMAINE)    
    /////////////////////////////    

    function isCacheValid(storageKey) {    
        const savedTime = localStorage.getItem(storageKey);    
        if (!savedTime) return false;    
        const diff = Date.now() - parseInt(savedTime);    
        const oneWeek = 7 * 24 * 60 * 60 * 1000;    
        return diff < oneWeek;    
    }    

    /////////////////////////////    
    // 🔥 ANIMES : AFFICHAGE & FETCH (OPTIMISÉ)
    /////////////////////////////    

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
                // Ajout de l'affichage du numéro de l'épisode pour plus de détails
                card.innerHTML = `    
                    <img src="${anime.img}" alt="${anime.title}">    
                    <p><strong>${anime.title}</strong></p>    
                    <p style="font-size: 0.8em; color: gray;">Épisode ${anime.episode}</p>
                `;    
                column.appendChild(card);    
            });    

            grid.appendChild(column);    
        });    

        weeklySection.innerHTML = '';    
        weeklySection.appendChild(grid);    
    }    

    async function fetchAnimeSchedule() {    
        weeklySection.innerHTML = "<p>Chargement du planning de la semaine...</p>";    
        
        // Calcul des timestamps pour la semaine en cours (Lundi à Dimanche)
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay() + 1));
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const startTime = Math.floor(startOfWeek.getTime() / 1000);
        const endTime = Math.floor(endOfWeek.getTime() / 1000);

        // Nouvelle requête GraphQL ciblant directement les sorties (AiringSchedules)
        const query = `    
        query ($start: Int, $end: Int) {
          Page(page: 1, perPage: 150) {
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

        const variables = { start: startTime, end: endTime };

        try {
            const res = await fetch("https://graphql.anilist.co", {    
                method: "POST",    
                headers: { "Content-Type": "application/json" },    
                body: JSON.stringify({ query, variables })    
            });    

            const data = await res.json();    
            const schedules = data.data.Page.airingSchedules;    
            const allData = days.map(day => ({ day, animes: [] }));    

            const mapDays = { 0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday", 6: "saturday" };    
            const usedAnime = new Set(); // Pour éviter les doublons si un anime a 2 épisodes la même semaine

            schedules.forEach(schedule => {    
                if (!schedule.media) return;
                
                const animeId = schedule.media.id;
                if (usedAnime.has(animeId)) return;    
                usedAnime.add(animeId);    

                const date = new Date(schedule.airingAt * 1000);    
                const dayFound = mapDays[date.getDay()];    

                const targetDay = allData.find(d => d.day === dayFound);    
                if (targetDay) {    
                    targetDay.animes.push({ 
                        title: schedule.media.title.romaji, 
                        img: schedule.media.coverImage.large,
                        episode: schedule.episode
                    });    
                }    
            });    

            localStorage.setItem("planning_anime_data", JSON.stringify(allData));    
            localStorage.setItem("planning_anime_time", Date.now());    
            displayAnimePlanning(allData);

        } catch (error) {
            weeklySection.innerHTML = "<p>Erreur lors du chargement du planning.</p>";
            console.error(error);
        }
    }

    /////////////////////////////    
    // 🔥 MANGAS : AFFICHAGE & FETCH
    /////////////////////////////

    function displayMangaPlanning(mangas) {
        const grid = document.createElement('div');    
        grid.className = 'manga-grid'; // Assure-toi d'avoir cette classe dans ton style.css pour afficher en grille

        mangas.forEach(manga => {
            const card = document.createElement('div');    
            card.className = 'calendar-card';    
            card.innerHTML = `    
                <img src="${manga.coverImage.large}" alt="${manga.title.romaji}">    
                <p>${manga.title.romaji}</p>    
            `;    
            grid.appendChild(card);
        });

        mangaSection.innerHTML = '<h2></h2>';
        mangaSection.appendChild(grid);
    }

    async function fetchMangaSchedule() {
        mangaSection.innerHTML = "<p>Chargement des mangas...</p>";

        const query = `    
        query {    
          Page(page: 1, perPage: 50) {    
            media(type: MANGA, status: RELEASING, sort: POPULARITY_DESC) {    
              id    
              title { romaji }    
              coverImage { large }    
            }    
          }    
        }`;

        try {
            const res = await fetch("https://graphql.anilist.co", {    
                method: "POST",    
                headers: { "Content-Type": "application/json" },    
                body: JSON.stringify({ query })    
            });    

            const data = await res.json();    
            const mangas = data.data.Page.media;    

            localStorage.setItem("planning_manga_data", JSON.stringify(mangas));    
            localStorage.setItem("planning_manga_time", Date.now());    
            displayMangaPlanning(mangas);
        } catch (error) {
            mangaSection.innerHTML = "<p>Erreur lors du chargement des mangas.</p>";
            console.error(error);
        }
    }

    /////////////////////////////    
    // 🔥 INITIALISATION    
    /////////////////////////////    

    function initAnime() {
        const savedData = localStorage.getItem("planning_anime_data");    
        if (isCacheValid("planning_anime_time") && savedData) {    
            displayAnimePlanning(JSON.parse(savedData));    
        } else {    
            fetchAnimeSchedule();    
        }
    }

    function initManga() {
        const savedData = localStorage.getItem("planning_manga_data");    
        if (isCacheValid("planning_manga_time") && savedData) {    
            displayMangaPlanning(JSON.parse(savedData));    
        } else {    
            fetchMangaSchedule();    
        }
    }

    // Au chargement de la page, on charge les animes par défaut
    initAnime();

});
