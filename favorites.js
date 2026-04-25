document.addEventListener("DOMContentLoaded", () => {
    
    const favoritesSection = document.getElementById('favorites-section');
    const searchInput = document.getElementById('search');
    
    let myFavorites = JSON.parse(localStorage.getItem('myFavorites')) || [];
    
    // 🔥 NORMALISATION (recherche propre)
    function normalizeText(text) {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }
    
    // ❌ supprimer favori
    function removeFromFavorites(mal_id) {
        myFavorites = myFavorites.filter(a => a.mal_id !== mal_id);
        localStorage.setItem('myFavorites', JSON.stringify(myFavorites));
        displayFavorites();
    }
    
    // 🔎 recherche
    function searchFavorites() {
        const query = normalizeText(searchInput.value.trim());
        
        if (!query) {
            displayFavorites();
            return;
        }
        
        const words = query.split(/\s+/);
        
        const filtered = myFavorites.filter(anime => {
            const title = normalizeText(anime.title || "");
            const type = normalizeText(anime.type || "");
            const score = String(anime.score || "");
            
            return words.every(word =>
                title.includes(word) ||
                type.includes(word) ||
                score.includes(word)
            );
        });
        
        displayFavorites(filtered);
    }
    
    // 📺 affichage
    function displayFavorites(list = myFavorites) {
        favoritesSection.innerHTML = '';
        
        if (list.length === 0) {
            favoritesSection.innerHTML = '<p>Aucun favori trouvé.</p>';
            return;
        }
        
        list.forEach(item => {
            const card = document.createElement('div');
            card.className = 'anime-card';
            
            const imgUrl = item.images?.jpg?.image_url || '';
            
            card.innerHTML = `
            <img src="${imgUrl}" alt="${item.title}">
            <div class="anime-info">
                <h3>${item.title}</h3>
                <p>Type: ${item.type || 'N/A'}</p>
                <p>Note: ${item.score || 'N/A'}</p>
                <button>Supprimer</button>
            </div>
        `;
            
            card.querySelector('button').addEventListener('click', () => {
                removeFromFavorites(item.mal_id);
            });
            
            favoritesSection.appendChild(card);
        });
    }
    
    // 🔎 event search
    if (searchInput) {
        let timeout;
        
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(searchFavorites, 250);
        });
    }
    
    // init
    displayFavorites();
    
});
