# Changelog

## publication

- **2026-10-06** — Les mods s'installent depuis une marketplace
  (`.claude-plugin/marketplace.json`) : `claude plugin marketplace add
  mesix971/mods-claude`. README écrit pour le public, bande-annonce animée en
  tête, film publié sur GitHub Pages (`docs/`).

## présentation

- **2026-10-08** — Film et bande-annonce régénérés : la boucle des trois
  cartons, et la bulle au-dessus de Clawd dans la scène du boulot. Textes du
  film et du README mis à jour.
- **2026-10-07** — Film et bande-annonce régénérés avec les nouveaux cartons.
  Dans la bande-annonce, la scène est décalée vers la droite pour que la pile
  de cartons ne touche pas le texte des jauges.
- **2026-10-06** — Film « Adopte un Clawd » (`promo/`) :
  - nouvelle scène sur les jauges de quotas ;
  - mise en page refaite pour qu'aucun texte ne chevauche l'interface, à
    toutes les largeurs ;
  - format portrait sur mobile ;
  - généré depuis le code des mods.

## clawd

- **0.4.1** — 2026-10-08 — On voit tout :
  - bulles plus grosses (une fois et demie, toute la hauteur libre au-dessus
    de sa tête) et bordées de gris, pour bien les voir aussi sur un thème
    clair ;
  - il retient où en est son déménagement, même après un rechargement du
    mod ou dans une nouvelle session : il finit ses allers-retours au lieu
    de toujours recommencer par l'aller ;
  - boucle un peu plus rapide (39 s au lieu de 48) : le retour commence au
    bout de 19 s.
- **0.4.0** — 2026-10-08 — Une boucle sans couture, et des bulles :
  - une vraie boucle : trois cartons en pyramide chez lui, qu'il apporte un
    par un de l'autre côté (le dernier hissé sur les deux autres), puis
    qu'il rapporte un par un, et ainsi de suite ;
  - des gestes qui s'enchaînent : il se retourne image par image (profil,
    trois quarts, face) avec le carton qui le suit au lieu de sauter, et
    soulève ou pose en quatre temps ;
  - au travail, les petites réactions (loupe, crayon, ?!, note, cœur)
    s'affichent en bulle au-dessus de sa tête, sans l'interrompre ; les
    grosses (build, tests, push, install, fête, nuage…) gardent leur scène ;
  - après une grosse réaction, il reprend là où il en était au lieu de tout
    recommencer : ses cartons restent où il les a laissés.
- **0.3.1** — 2026-10-07 — De vrais cartons :
  - carton de déménagement vu de trois quarts : couleur kraft, dessus
    éclairé, côté à l'ombre, scotch sur les rabats, étiquette ;
  - il le soulève en s'accroupissant, le tient à deux pinces devant lui et le
    porte plus lentement (le carton cahote à chaque pas) ;
  - il le pose à côté de la pile déjà livrée, souffle, puis repart en
    chercher un autre ;
  - les mini-Clawds portent leur carton devant eux.
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
