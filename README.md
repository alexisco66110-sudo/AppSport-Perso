# Élan

PWA iPhone de suivi du poids et du sport. Aucune dépendance ni compilation : ce sont des fichiers statiques.

- Lancer en local : `python -m http.server 5173`, puis ouvrir http://localhost:5173
- Mettre en ligne : publier le dossier sur un hébergement HTTPS (GitHub Pages, par exemple).
- Installer : ouvrir l'URL dans Safari sur l'iPhone, puis Partager > « Sur l'écran d'accueil ».
- Publier une mise à jour : changer `VERSION` dans `sw.js`, sinon l'iPhone garde l'ancienne version en cache.
- Régénérer les icônes : `node tools/make-icons.mjs`

Le service worker est désactivé sur localhost, sauf avec `?sw=1`.
Les données restent dans l'IndexedDB de l'appareil. Elles ne sont jamais envoyées ailleurs.
