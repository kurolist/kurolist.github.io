document.addEventListener("DOMContentLoaded", () => {

const weeklySection = document.getElementById('weekly-planning');    

const days = [    
    "monday", "tuesday", "wednesday", "thursday",    
    "friday", "saturday", "sunday"    
];    

const daysFR = {    
    monday: "Lundi",    
    tuesday: "Mardi",    
    wednesday: "Mercredi",    
    thursday: "Jeudi",    
    friday: "Vendredi",    
    saturday: "Samedi",    
    sunday: "Dimanche"    
};    

const usedAnime = new Set();    

/////////////////////////////    
// 🔥 CHECK CACHE (1 SEMAINE)    
/////////////////////////////    

function isCacheValid() {    
    const savedTime = localStorage.getItem("planning_time");    

    if (!savedTime) return false;    

    const now = Date.now();    
    const diff = now - parseInt(savedTime);    

    const oneWeek = 7 * 24 * 60 * 60 * 1000;    

    return diff < oneWeek;    
}    

/////////////////////////////    
// 🔥 DISPLAY    
/////////////////////////////    

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

/////////////////////////////    
// 🔥 FETCH + SAVE    
/////////////////////////////    

async function fetchWeeklySchedule() {    

weeklySection.innerHTML = "<p>Chargement...</p>";    
usedAnime.clear();    

const query = `    
query ($page: Int) {    
  Page(page: $page, perPage: 100) {    
    media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {    
      id    
      title {    
        romaji    
      }    
      coverImage {    
        large    
      }    
      airingSchedule {    
        nodes {    
          airingAt    
        }    
      }    
    }    
  }    
}`;    

const res = await fetch("https://graphql.anilist.co", {    
    method: "POST",    
    headers: {    
        "Content-Type": "application/json"    
    },    
    body: JSON.stringify({    
        query,    
        variables: { page: 1 }    
    })    
});    

const data = await res.json();    
const animes = data.data.Page.media;    

const allData = [];    

// 🔥 On prépare les jours    
const mapDays = {    
    0: "sunday",    
    1: "monday",    
    2: "tuesday",    
    3: "wednesday",    
    4: "thursday",    
    5: "friday",    
    6: "saturday"    
};    

// 🔥 initialisation des jours    
days.forEach(day => {    
    allData.push({    
        day,    
        animes: []    
    });    
});    

animes.forEach(anime => {    

    if (usedAnime.has(anime.id)) return;    

    usedAnime.add(anime.id);    

    let dayFound = null;    

    const schedule = anime.airingSchedule?.nodes?.[0];    

    if (schedule) {    
        const date = new Date(schedule.airingAt * 1000);    
        const jsDay = date.getDay();    
        dayFound = mapDays[jsDay];    
    }    

    // 🔥 SI PAS DE JOUR → on met dans lundi (fallback)    
    if (!dayFound) dayFound = "monday";    

    const targetDay = allData.find(d => d.day === dayFound);    

    if (targetDay.animes.length < 40) {    
        targetDay.animes.push({    
            title: anime.title.romaji,    
            img: anime.coverImage.large    
        });    
    }    
});    

// 🔥 remplissage si jours vides    
allData.forEach(day => {    

    if (day.animes.length === 0) {    

        const fallback = animes.slice(0, 20).map(a => ({    
            title: a.title.romaji,    
            img: a.coverImage.large    
        }));    

        day.animes = fallback;    
    }    
});    

// 💾 SAVE    
localStorage.setItem("planning_data", JSON.stringify(allData));    
localStorage.setItem("planning_time", Date.now());    

displayPlanning(allData);

}

/////////////////////////////    
// 🔥 INIT    
/////////////////////////////    

const savedData = localStorage.getItem("planning_data");    

if (isCacheValid() && savedData) {    
    console.log("📦 Chargement depuis cache");    
    displayPlanning(JSON.parse(savedData));    
} else {    
    console.log("🌐 Requête API");    
    fetchWeeklySchedule();    
}

});
