document.addEventListener("DOMContentLoaded", () => {
    
    /////////////////////////////    
    // MENU HAMBURGER    
    /////////////////////////////    
    const hamburger = document.getElementById('hamburger');
    const sideMenu = document.getElementById('side-menu');
    const closeBtn = document.getElementById('close-menu');
    
    if (hamburger && sideMenu) {
        
        hamburger.addEventListener('click', () => {
            sideMenu.classList.toggle('open');
        });
        
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                sideMenu.classList.remove('open');
            });
        }
        
        document.addEventListener('click', (e) => {
            if (
                sideMenu.classList.contains('open') &&
                !sideMenu.contains(e.target) &&
                !hamburger.contains(e.target)
            ) {
                sideMenu.classList.remove('open');
            }
        });
    }
    
    /////////////////////////////    
    // ELEMENTS    
    /////////////////////////////    
    const mylistSection = document.getElementById('mylist-section');
    const searchInput = document.getElementById('search');
    
    /////////////////////////////    
    // DATA    
    /////////////////////////////    
    let myAnimeList = JSON.parse(localStorage.getItem('myAnimeList')) || [];
    
    const STATUS = {
        watching: "En cours",
        completed: "Terminé",
        paused: "En pause",
        dropped: "Abandonné",
        plan: "À voir"
    };
    
    /////////////////////////////    
    // NORMALISATION (ANTI ACCENTS)    
    /////////////////////////////    
    function normalizeText(text) {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }
    
    /////////////////////////////    
    // FIX DATA    
    /////////////////////////////    
    myAnimeList = myAnimeList.map(anime => {
        if (!anime.listStatus) anime.listStatus = "plan";
        return anime;
    });
    
    /////////////////////////////    
    // SAVE    
    /////////////////////////////    
    function save() {
        localStorage.setItem('myAnimeList', JSON.stringify(myAnimeList));
    }
    
    /////////////////////////////    
    // REMOVE    
    /////////////////////////////    
    function removeFromMyList(mal_id) {
        myAnimeList = myAnimeList.filter(a => a.mal_id !== mal_id);
        save();
        displayMyList();
    }
    
    /////////////////////////////    
    // CHANGE STATUS    
    /////////////////////////////    
    function changeStatus(mal_id, newStatus) {
        const anime = myAnimeList.find(a => a.mal_id === mal_id);
        if (anime) {
            anime.listStatus = newStatus;
            save();
            displayMyList();
        }
    }
    
    /////////////////////////////    
    // FILTER    
    /////////////////////////////    
    let currentFilter = 'all';
    
    function setFilter(filter) {
        currentFilter = filter;
        displayMyList();
        
        document.querySelectorAll('#filter-buttons button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
    }
    
    /////////////////////////////    
    // SEARCH AMÉLIORÉE 🔥    
    /////////////////////////////    
    function searchInList() {
        const query = normalizeText(searchInput.value.trim());
        
        if (!query) {
            displayMyList();
            return;
        }
        
        const words = query.split(/\s+/); // multi mots    
        
        const filtered = myAnimeList.filter(anime => {
            
            const title = normalizeText(anime.title || "");
            const type = normalizeText(anime.type || "");
            const score = String(anime.score || "");
            
            return words.every(word =>
                title.includes(word) ||
                type.includes(word) ||
                score.includes(word)
            );
        });
        
        displayMyList(filtered);
    }
    
    /////////////////////////////    
    // DISPLAY    
    /////////////////////////////    
    function displayMyList(filteredList = null) {
        
        const list = filteredList || myAnimeList;
        
        mylistSection.innerHTML = '';
        
        if (list.length === 0) {
            mylistSection.innerHTML = '<p>Aucun anime trouvé.</p>';
            return;
        }
        
        list.forEach(item => {
            
            if (currentFilter !== 'all' && item.listStatus !== currentFilter) return;
            
            const imgUrl = item.images?.jpg?.image_url || '';
            
            const card = document.createElement('div');
            card.className = 'anime-card';
            
            card.innerHTML = `    
            <img src="${imgUrl}">    
            <div class="anime-info">    
                <h3>${item.title}</h3>    
                <p>Type: ${item.type || 'N/A'}</p>    
                <p>Note: ${item.score || 'N/A'}</p>    

                <select>    
                    ${Object.keys(STATUS).map(s =>    
            `<option value="${s}" ${s === item.listStatus ? "selected" : ""}>${STATUS[s]}</option>`    
        ).join('')}    
                </select>    

                <button>Supprimer</button>    
            </div>    
        `;
            
            card.querySelector('select').addEventListener('change', (e) => {
                changeStatus(item.mal_id, e.target.value);
            });
            
            card.querySelector('button').addEventListener('click', () => {
                removeFromMyList(item.mal_id);
            });
            
            mylistSection.appendChild(card);
        });
    }
    
    /////////////////////////////    
    // EVENTS    
    /////////////////////////////    
    if (searchInput) {
        let timeout;
        
        searchInput.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(searchInList, 300);
        });
    }
    
    document.querySelectorAll('#filter-buttons button').forEach(btn => {
        btn.addEventListener('click', () => {
            setFilter(btn.dataset.filter);
        });
    });
    
    /////////////////////////////    
    // INIT    
    /////////////////////////////    
    displayMyList();
    
});
