document.addEventListener("DOMContentLoaded", () => {
    // --- LOGIQUE DU MENU HAMBURGER (IDENTIQUE AU RESTE DU SITE) ---
    const hamburger = document.getElementById('hamburger');
    const sideMenu = document.getElementById('side-menu');
    const closeBtn = document.getElementById('close-menu');

    hamburger.addEventListener('click', () => {
        sideMenu.classList.add('open');
    });

    closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sideMenu.classList.remove('open');
    });

    // --- RECHERCHE DE PERSONNAGES (LOOK INDEX.HTML) ---
    const searchInput = document.getElementById('search'); // Utilise l'ID "search" pour ton CSS
    const resultsContainer = document.getElementById('characters-results');
    const statusLabel = document.getElementById('loading-status');

    async function searchCharacter() {
        const query = searchInput.value.trim();
        
        // On commence la recherche à partir de 3 caractères
        if (query.length < 3) return;

        statusLabel.innerText = "Recherche en cours...";
        resultsContainer.innerHTML = '';

        try {
            // On récupère 20 personnages triés par popularité
            const response = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(query)}&limit=20&order_by=favorites&sort=desc`);
            const json = await response.json();
            const characters = json.data;

            if (!characters || characters.length === 0) {
                statusLabel.innerText = "Aucun personnage trouvé.";
                return;
            }

            statusLabel.innerText = ``;

            // Création des cartes
            characters.forEach((char, index) => {
                const card = document.createElement('div');
                card.className = 'anime-card'; // Utilise ta classe standard
                
                // Structure de la carte (l'info est vide au début pour être remplie par les détails)
                card.innerHTML = `
                    <img src="${char.images.jpg.image_url}" alt="${char.name}">
                    <div class="anime-info" id="detail-${char.mal_id}">
                        <h3>${char.name}</h3>
                        <p style="font-style: italic; color: #888;">Chargement des détails...</p>
                    </div>
                `;
                resultsContainer.appendChild(card);

                // On appelle les détails complets (Anime + Voix) avec un délai pour Jikan
                setTimeout(() => fetchFullDetails(char.mal_id), index * 400);
            });

        } catch (error) {
            console.error(error);
            statusLabel.innerText = "Erreur de connexion avec l'API.";
        }
    }

    async function fetchFullDetails(id) {
        try {
            const res = await fetch(`https://api.jikan.moe/v4/characters/${id}/full`);
            const data = await res.json();
            const full = data.data;
            const detailDiv = document.getElementById(`detail-${id}`);

            if (!detailDiv) return;

            // Déterminer l'origine (Anime d'abord, sinon Manga)
            let origin = "Non spécifiée";
            if (full.anime && full.anime.length > 0) {
                origin = full.anime[0].anime.title;
            } else if (full.manga && full.manga.length > 0) {
                origin = full.manga[0].manga.title;
            }

            // Trouver la voix japonaise (Seiyuu)
            const voice = full.voices?.find(v => v.language === "Japanese")?.person.name || "Inconnue";

            // Mise à jour de la carte avec les informations finales
            detailDiv.innerHTML = `
                <h3>${full.name}</h3>
                <p><strong>🎬 Origine :</strong> ${origin}</p>
                <p><strong>🎙️ Voix JP :</strong> ${voice}</p>
                <p style="font-size: 11px; color: #aaa; margin-top: 5px;">
                    ${full.about ? full.about.substring(0, 70) + "..." : "Pas de description."}
                </p>
            `;
        } catch (err) {
            console.warn("Impossible de charger les détails pour l'ID : " + id);
        }
    }

    // Gestion de la saisie avec délai (debounce)
    let typingTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(typingTimer);
        typingTimer = setTimeout(searchCharacter, 800);
    });
});
