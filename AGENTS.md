# AGENTS.md — REGAL

## Projet et communication

- Dépôt principal : `rhypp11/REGAL`, branche principale : `main`.
- REGAL est un site personnel de gestion de collection, wishlist, arrivages et cimetière (à vendre / vendus).
- Répondre à Rom en français, simplement. Expliquer le résultat, les vérifications et les limites réelles.
- Lire le code actuel et les changements récents avant de modifier. Le dépôt fait foi pour l'implémentation ; ne pas supposer disposer de l'historique des conversations.
- Une demande d'audit seule n'autorise pas les modifications. Une demande de correction ou d'implémentation autorise le travail sur une branche et la création d'une PR.

## Livraison obligatoire

1. Partir de la version actuelle de `main` et créer une branche dédiée. Préserver le travail existant et vérifier les PR ouvertes si elles touchent les mêmes fichiers.
2. Implémenter puis exécuter les vérifications adaptées au changement.
3. Ouvrir une PR avec un titre concret et une description du comportement obtenu et des validations.
4. Attendre le workflow Firebase Hosting Preview. Vérifier son succès et récupérer l'URL réelle du déploiement dans ses résultats ; ne jamais deviner l'URL.
5. Fournir à Rom le lien de la PR et la preview sandbox pour validation. En cas d'échec, diagnostiquer et corriger ; signaler tout blocage restant sans annoncer une preview prête.
6. Merger uniquement après un « go » ou une instruction explicite de fusion de Rom pour cette PR. L'autorisation de créer le changement ne vaut pas autorisation de fusionner.

Utiliser la connexion GitHub disponible pour lire et modifier le dépôt. Un checkout local peut servir à l'édition et aux tests. Conserver le workflow GitHub/Firebase existant ; ne pas migrer l'hébergement ou réécrire le pipeline sans demande.

## Sandbox et données

- Toute preview doit être isolée des données de production : aucune connexion au compte de Rom, aucune lecture ou écriture de sa collection, aucun partage de données réelles.
- Préserver `window.JTD_PREVIEW_MODE`, les gardes de `firebase.js` et le stockage sandbox distinct. Un canal Hosting séparé ne suffit pas à isoler Firestore.
- Pour les tests locaux, utiliser `tests/sandbox.cjs` qui force le mode preview et, lorsque pertinent, bloque les requêtes externes. Une simple page servie sur localhost ne garantit pas l'isolation.
- Le workflow déploie les PR vers la cible `pr-preview`, sur le site `jtd-sandbox-rhypp11`. Ne pas remplacer cette cible par le site de production.
- Utiliser des données fictives pour les tests, captures et fixtures. Ne pas mettre de sauvegarde personnelle, identifiant de connexion ou secret dans le dépôt.
- Préserver l'isolation du stockage par compte, les gardes de session et le blocage des écritures après un échec de chargement cloud. Une collection cloud vide reste une donnée valide.
- Préserver les sauvegardes compatibles, les validations et le rollback des écritures locales. Ne pas déclencher de migration destructive ou d'opération sur la production sans demande explicite.

## Repères dans le code

Site statique, sans `package.json` ni étape de build applicative à ce jour :
- `index.html` : structure, modales et chargement des scripts.
- `app.js` / `styles.css` : vues principales, interactions et responsive.
- `jtd-data.js` : normalisation, sauvegardes, transferts, stockage par compte et sessions.
- `firebase.js` / `firestore.rules` : authentification, synchronisation et partage.
- `cemetery.js` / `cemetery.css` : ventes et cimetière.
- `cemetery-import.js` / `cemetery-import.css` : import additif avec aperçu.
- `theme.js` / `lifecycle.js` : thèmes et actualisation.
- `tests/` et `.github/workflows/firebase-hosting-preview.yml` : vérifications existantes et déploiement sandbox.

Préserver l'ordre de chargement et les interfaces partagées entre scripts. Réutiliser les fonctions de validation, de persistance et de transfert plutôt que les dupliquer.

## Choix produit à préserver

- La collection propose Physique (par défaut) et Numérique ; recliquer le format actif désélectionne les deux et affiche Tout, sans bouton dédié. Wishlist, arrivages et ventes restent réservés au physique. Les statistiques de l’accueil couvrent les jeux physiques et numériques, avec les contenus additionnels comptés séparément. Le numérique concerne les achats consoles, avec compte et devise facultatifs ; aucun import Steam.
- Les DLC numériques se rattachent explicitement à un jeu de la même plateforme ; une mise à niveau Switch 2 peut aussi se rattacher à son jeu Switch. Les contenus sont regroupés sous le jeu numérique de la même plateforme, mais restent visibles si le jeu associé est physique, sur un autre support ou hors collection. Conserver les achats, comptes et prix indépendamment des regroupements visuels.
- Les formats sont des onglets compacts dans le volet ; les comptes se choisissent dans une liste repliable avec pseudo et avatar facultatif. Le bandeau rappelle la sélection. Les contenus gardent le fond normal des cartes et une étiquette DLC ou Mise à niveau. Les anciennes valeurs en_cours restent préservées mais sont affichées avec À faire ; ce choix n’est plus proposé.
- Interface en français, sobre et lisible, cohérente en thèmes clair et sombre.
- Images des jeux horizontales. Sur mobile, les cartes utilisent la largeur disponible ; les modales doivent défiler et leurs actions rester accessibles sans chevauchement.
- Wishlist et arrivages restent séparés en onglets sur mobile. Vérifier aussi le menu, les tiroirs, les dates et les listes longues.
- Sur les cartes de collection : éditions et titre, puis plateforme et statut de complétion, puis informations d'achat. Préserver la lisibilité du titre et les choix actuels de logo.
- Conserver le tri chronologique des dates complètes et partielles et le regroupement des éléments sans date.
- Préserver les transferts entre listes et leur persistance après rechargement.
- Cimetière : collection → à vendre (retour possible), lieu/canal et prix estimé, puis prix réellement encaissé pour marquer vendu.
- Import du cimetière : ajouter sans écraser la collection ; laisser choisir les correspondances dans l'aperçu. Réutiliser les alias de plateformes (NSW = Nintendo Switch, PSV = PlayStation Vita, etc.), les lots et le traitement du hardware existants.
- Les compteurs de collection ne doivent pas inclure les éléments vendus ou à vendre.
- Ne pas réintroduire des boutons sur chaque carte, des compteurs décoratifs ou des étapes supplémentaires sans besoin explicite.

Ces repères décrivent les choix actuels ; une nouvelle instruction explicite de Rom peut les faire évoluer.

## Vérification et maintenance

- Privilégier les changements ciblés et simples. Lors d'un nettoyage, supprimer les restes devenus inutiles plutôt qu'empiler des overrides CSS ou des chemins de compatibilité non justifiés.
- Ne pas introduire de framework, dépendance ou refonte d'architecture pour une correction locale.
- Vérifier la syntaxe des scripts modifiés avec `node --check <fichier.js>`.
- Pour les données, la persistance, Firebase ou les sauvegardes : `node --test tests/data.test.cjs`.
- Pour les interactions : `node tests/browser.cjs` et les suites concernées (`workflow.cjs`, `cemetery.cjs`, `cemetery-import.cjs`).
- Pour le visuel : `node tests/collection-layout.cjs` et/ou `node tests/theme-smoke.cjs`. Vérifier mobile (320/390 px) et desktop (1440 px), clair et sombre, ainsi que la console.
- Les suites navigateur utilisent Playwright et Chromium. Reprendre la préparation et les variables du workflow existant : `NODE_PATH`, `JTD_CHROME` ; `theme-smoke.cjs` utilise `CHROME_PATH` et un serveur sur le port 8765.
- `tests/css-regression.cjs` compare avec le CSS de base via `JTD_BASELINE_CSS` : pertinent pour un nettoyage censé préserver le rendu.
- Adapter les tests au risque : pas de nouveau test pour une simple modification documentaire ; ajouter une régression utile pour un bug de données ou de comportement.
- Lire le workflow pour les commandes et versions exactes. Ne pas prétendre avoir exécuté un test indisponible ; préciser les vérifications effectuées et celles prises en charge par la CI.
