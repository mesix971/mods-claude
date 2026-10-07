# Changelog

## publication

- **2026-10-06** — Les mods s'installent depuis une marketplace
  (`.claude-plugin/marketplace.json`) : `claude plugin marketplace add
  mesix971/mods-claude`. README écrit pour le public, bande-annonce animée en
  tête, film publié sur GitHub Pages (`docs/`).

## présentation

- **2026-10-06** — Film « Adopte un Clawd » (`promo/`) :
  - nouvelle scène sur les jauges de quotas ;
  - mise en page refaite pour qu'aucun texte ne chevauche l'interface, à
    toutes les largeurs ;
  - format portrait sur mobile ;
  - généré depuis le code des mods.

## clawd

- **0.3.0** — 2026-10-06 — Plus vivant :
  - au repos, une vraie balade chorégraphiée sur sa petite scène : il marche,
    regarde autour, saute, s'assoit en balançant les pattes, fait coucou,
    revient, fait une pirouette ;
  - au travail, il fait des allers-retours avec des cartons ;
  - mouvements plus amples (danse, fête, sauts) ;
  - quand il écrit, la patte tient et suit le crayon ;
  - un mini-Clawd par sous-agent, qui mime ce que fait son agent (carton,
    loupe, écriture, marteau), avec Clawd en chef de chantier.
- **0.2.0** — 2026-10-06 — Intégration propre :
  - fond transparent (plus de cadre blanc) ;
  - taille du Clawd natif de l'app, placé à droite du bandeau ;
  - contour fin et ombre au sol qui suivent le thème clair ou sombre ;
  - plus aucun texte ;
  - boutons ♥ et 🎲 visibles seulement au survol.
- **0.1.0** — 2026-10-06 — Première version : Clawd en pixel art au-dessus du
  prompt (vue de face et de profil relevées sur les captures), 38 scènes
  animées image par image. Au repos, il enchaîne 19 activités tirées au sort
  (café, jonglage, pêche, guitare, corde à sauter, lecture, papillon,
  arrosage, yoyo, méditation…). Il réagit aussi à la session : écrit, loupe,
  marteau, tests, push, install sur le tel, mini-copain pour les agents,
  fête, nuage triste, alerte, vertige, dodo, rappel nocturne. Boutons ♥
  (compteur de caresses gardé entre les sessions) et 🎲 (nouvelle activité).

## atelier

- **0.3.1** — 2026-10-07 — Jauges à jour :
  - le bouton ↻ relit aussi les quotas ;
  - mise à jour automatique chaque minute et dès l'ouverture de session ;
  - une fenêtre dont l'heure de reset est passée affiche 0 % au lieu de
    l'ancien pourcentage.
- **0.3.0** — 2026-10-06 — Prêt pour tout le monde :
  - adb et le JBR d'Android Studio sont détectés tout seuls (Windows,
    macOS, Linux) au lieu de chemins codés en dur ;
  - un JBR d'Android Studio cassé est remplacé quel que soit son dossier ;
  - `JAVA_HOME` n'est ajouté que s'il manque vraiment ;
  - tests anonymisés.
- **0.2.0** — 2026-10-06 — Quotas et contexte en jauges :
  - couleur selon le niveau, barre qui pulse en critique ;
  - trait du temps écoulé, avec passage à l'ambre si le rythme fait tomber
    la limite avant le reset ;
  - heure du reset (avec le jour pour la fenêtre de 7 j) quand ça devient
    serré ;
  - en terminal, version en blocs ▰▱.
- **0.1.2** — 2026-10-06 — Ce que les autres mods dessinent (Clawd) se place
  à droite des lignes du bandeau au lieu d'en dessous.
- **0.1.1** — 2026-10-06 — Le bandeau s'empile au lieu de remplacer : ce que
  dessinent les autres mods au-dessus du prompt (Clawd) reste visible.
- **0.1.0** — 2026-10-03 — Première version : bandeau projet (APK / tel / git /
  quotas), boutons Installer, Lancer et Commit + push, garde-fous Bash et
  PowerShell (JBR, JAVA_HOME, commandes destructrices, secrets, commit non
  demandé, attentes bloquantes, bash WSL), rappel français, commandes `/tel`
  et `/atelier`.
