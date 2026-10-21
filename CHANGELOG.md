# Changelog

## publication

- **2026-10-06** — Les mods s'installent depuis une marketplace
  (`.claude-plugin/marketplace.json`) : `claude plugin marketplace add
  mesix971/mods-claude`. README écrit pour le public, bande-annonce animée en
  tête, film publié sur GitHub Pages (`docs/`).

## présentation

- **2026-10-11** — Film et bande-annonce : dans le chapitre « Sous-agents »,
  chaque mini-Clawd a la couleur de son modèle (Haiku, Sonnet, Fable).
- **2026-10-08** — Film : nouveau chapitre « Compactage ».
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

- **0.6.0** — 2026-10-11 — Chaque mini-Clawd prend la couleur du modèle de son
  sous-agent (pistache pour Haiku, abricot pour Sonnet, terracotta pour Opus,
  corail pour Fable), même quand il n'utilise pas celui de la conversation.
  Sans modèle connu, il garde la couleur de Clawd. En terminal, chaque mini
  devient un ▪ à sa couleur.
- **0.5.0** — 2026-10-08 — De nouvelles réactions :
  - compactage : quand la conversation se compacte (`/compact` ou
    automatiquement), il saute sur une pile de feuilles pour la tasser, et
    elle rebondit à chaque fois, tant que ça dure. Ensuite, il montre le
    petit paquet ficelé qu'il en a fait, et pourra de nouveau avoir le vertige ;
  - permission : quand Claude attend ta réponse, il lève la patte et tape du
    pied, un petit cadenas à côté, jusqu'à ce que l'action soit faite. Les
    commandes qui durent (build, tests…) gardent leur scène ;
  - question : il brandit une pancarte « ? » tant que tu n'as pas répondu ;
  - installation de dépendances (`flutter pub get`, `npm install`,
    `pip install`…) : il déballe un carton et lance ce qu'il y trouve ;
  - sa couleur suit le modèle : Haiku en vert pistache, Sonnet en abricot
    pâle, Opus dans le terracotta d'origine, Fable en corail vif.
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

- **0.10.0** — 2026-10-22 — Bouton 🆕 « Nouvelle conversation » sur la bande :
  il lance `/suite` si elle existe (une session neuve avec une note de
  passation), sinon `/clear`. Il clignote, avec la taille du contexte, quand
  celui-ci dépasse 250 k tokens ou 75 % de la fenêtre.
- **0.9.3** — 2026-10-21 — Bande vide ou masquée : atelier publie une bande
  partagée sans élément (et non plus rien), dès l'ouverture, et pose lui-même
  le numéro de Clawd sur toute la largeur. Avant, depuis la 0.9.1, un numéro
  joué bande vide ne couvrait que le coin de Clawd. Un build interrompu
  (Échap) se lit dans le texte de l'erreur : « interrompu », et non plus un
  échec.
- **0.9.2** — 2026-10-21 — Un commit ne demande plus ton accord, même non
  demandé : il se défait facilement. Seul un push non demandé le demande
  encore. Les secrets restent bloqués au commit comme au push.
- **0.9.1** — 2026-10-21 — Ce que dessine un autre mod sous la bande (Clawd)
  reste toujours au même endroit de l'arbre, bande vide, pleine ou masquée.
  Avant, l'apparition de la première ligne (une pastille de conseil, les
  quotas) le déplaçait : l'app recréait son image et son animation en cours
  repartait d'un vieux point (ses cartons sautaient, sa bulle ne le suivait
  plus).
- **0.9.0** — 2026-10-18 — La bande partagée donne aussi le dessin de chaque
  élément (`dessin`, le SVG d'atelier à l'identique, sans son infobulle) :
  un mod qui joue avec la bande promène une copie exacte de l'original. Ni le
  nom des étapes ni la mission des sous-agents n'y figurent ; l'orbe en cours
  (~24 Ko) n'en a pas.
  Les dessins du bandeau sont posés à 17 px de haut : l'app les réduisait
  (une ligne de texte fait ~17,2 px), et les places publiées glissaient de
  4 % vers la droite. Ce que Clawd emprunte est dit dans le texte alternatif.
  La puce 💡 du conseil de modèle est publiée elle aussi (`conseil`).
- **0.8.0** — 2026-10-18 — Le conseil de modèle : à chaque demande que tu tapes, Haiku
  la lit (avec le projet, le plan, le build, les sous-agents et les quotas) et
  dit quel modèle et quel effort suffisent pour la suite. Une puce « 💡 Sonnet · Moyen »
  après la conso, seulement quand ce n'est pas ce qui tourne, la raison au
  survol ; c'est toi qui changes. Les efforts sont nommés comme dans le
  sélecteur de l'app (Faible, Moyen, Élevé, Extra, Max). Aussi :
  - ↻ et « Masquer » passent au bout de la ligne git : sur celle des quotas,
    ils la faisaient passer à la ligne ;
  - le numéro de Clawd est posé à la largeur de la bande.
- **0.7.0** — 2026-10-18 — Au survol d'un quota qui file trop vite (la barre
  dépasse le trait) : la pause sans Claude pour revenir dans le rythme, et
  jusqu'à quelle heure (le temps que le trait rattrape la barre).
- **0.6.0** — 2026-10-17 — La bande partagée, pour que Clawd joue avec :
  - atelier publie ce qu'il dessine et où (son état `atelier.scene`) : les
    jauges, la conso, chaque pastille, avec sa place en px et sa ligne ;
  - ce que Clawd tient en ce moment (son état `clawd.emprunts`) n'est plus
    dessiné : la place reste vide jusqu'à ce qu'il le rende, ou jusqu'à
    l'échéance de l'emprunt (un Clawd planté ne cache rien longtemps) ;
  - son numéro (son état `clawd.grandeScene`, un dessin qu'il prépare) est
    posé par-dessus toute la bande : c'est la rangée d'atelier qui la couvre ;
  - le dessin et la bande partagée suivent le même plan (`scene.ts`).
- **0.5.0** — 2026-10-17 — Le bandeau en dit plus :
  - la conso du tour en direct, après les jauges : ses tokens et ce qu'il
    coûterait au tarif de l'API, en euros (d'après `/cost`, sinon estimé avec
    les tarifs du 17/10/2026 et le taux BCE du 16/10/2026). Le survol donne le
    détail et le total de la session. Elle passe à l'ambre quand chaque
    réponse relit plus de 400 k tokens, avec le conseil d'ouvrir une
    conversation neuve ;
  - la projection des quotas au survol des jauges : à ce rythme, 100 % vers
    telle heure avant le reset, ou « tu tiens » ;
  - le minuteur des étapes : au survol, depuis quand une étape avance, en
    combien de temps elle s'est faite ;
  - le build en pastille, dans la ligne Android : l'orbe pendant un
    `gradlew` ou un `flutter build`, même en tâche de fond, puis une coche
    avec sa durée, ou une croix rouge avec la tâche qui a échoué et sa
    première erreur au survol ;
  - les sous-agents en pastilles, à la couleur de leur modèle (comme les
    mini-Clawds), avec leur mission et leur durée au survol ;
  - le sonar : chaque fois qu'un sous-agent lance un outil, sa pastille émet
    une onde, et son survol dit le dernier outil lancé (jetons, mots de passe
    et clés d'API aux formats courants masqués) ;
  - « Masquer » dit comment faire revenir le bandeau : `/atelier` ;
  - les pastilles finies (verdict d'un build, même une croix rouge,
    sous-agents, liste de tâches faite) s'en vont 5 minutes après que tout est
    fini, au lieu de rester là indéfiniment.
- **0.4.1** — 2026-10-17 — Pastilles plus justes, et plus vivantes :
  - elles se cochent quand Claude a fini : s'il clôt son travail sans rien te
    laisser en suspens mais a oublié de cocher ses dernières étapes, le plan
    s'affiche quand même fini ; s'il te pose une question, les étapes
    restantes restent ouvertes, elles t'attendent ;
  - l'étape en cours devient l'orbe « breathing » de
    [thinking-orbs](https://github.com/Jakubantalik/thinking-orbs) (Jakub
    Antalik, licence MIT) : un anneau de points qui respire, porté en SVG
    animé sans script, immobile quand Claude ne travaille pas.
- **0.4.0** — 2026-10-16 — La liste de tâches de Claude en pastilles, sous les
  jauges :
  - un rond par étape : en pointillé tant qu'elle attend, qui tourne pendant
    qu'elle avance, coché en vert une fois faite ;
  - le nom de l'étape s'affiche au survol de sa pastille ;
  - elle suit la liste de l'app desktop, les tâches de Claude Code (`TaskCreate`,
    `TaskUpdate`, `TaskList`) et `TodoWrite` ; la liste d'un sous-agent ne remplace pas celle
    de la session ;
  - un plan entièrement fait laisse la place au suivant dès ton message
    suivant ; en terminal, des ◌ ◐ ✔.
- **0.3.2** — 2026-10-08 — Version calculée bien lue :
  - quand le script Gradle calcule la version (`versionName = maVariable`), le
    bandeau la lit dans `version.properties` ou `gradle.properties` (`versionName`,
    ou `versionMajor` / `versionMinor` / `versionPatch`) ;
  - les commentaires du script sont ignorés : un exemple comme
    `// versionName = "$major.$minor.$patch"` ne s'affiche plus à la place de la
    version ;
  - une montée de version dans `version.properties` compte aussi pour l'alerte
    « CHANGELOG pas touché ».
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
