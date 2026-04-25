document.addEventListener("DOMContentLoaded", () => {
  
    const toggle = document.getElementById("nsfw-toggle");
    const sideMenu = document.getElementById('side-menu');
    const hamburger = document.getElementById('hamburger');
    const closeBtn = document.getElementById('close-menu');

    // --- GESTION DU MENU (pour éviter le bug de blocage) ---
    if (hamburger && sideMenu) {
        hamburger.onclick = () => sideMenu.classList.add('open');
        closeBtn.onclick = () => sideMenu.classList.remove('open');
    }

    // --- GESTION DES RÉGLAGES ---
    // Valeur par défaut = hideNSFW: true
    let settings = JSON.parse(localStorage.getItem("settings")) || {
        hideNSFW: true
    };
    
    // Appliquer l'état visuel du switch au chargement
    if (toggle) {
        toggle.checked = settings.hideNSFW;
        
        toggle.addEventListener("change", () => {
            settings.hideNSFW = toggle.checked;
            localStorage.setItem("settings", JSON.stringify(settings));
            console.log("Paramètres mis à jour : hideNSFW =", settings.hideNSFW);
        });
    }
});
