# Pokédex — suivis privés

Le module est disponible dans la navigation normale. Les suivis sont un champ privé `pokedex` du compte : cache local isolé par utilisateur, synchronisation Firebase et sauvegardes complètes version 5. Les sauvegardes 1 à 4 restent lisibles et initialisent un Pokédex vide. Le partage public et l’export de conseils n’incluent pas les suivis. La preview conserve son stockage distinct et ne contacte pas Firebase. L’écran Mes Pokédex contient seulement les suivis créés et nommés. Plusieurs suivis peuvent utiliser le même catalogue HOME ou jeu/DLC, avec des progressions indépendantes.

La création utilise une modale partagée avec le cycle de focus/clavier du site. Le catalogue se choisit dans une grille de vignettes recherchable. Le crayon de chaque suivi permet de le renommer sans changer son catalogue ou ses cases, ou de le supprimer après confirmation. Les icônes sont communes à la grille, à la liste et à l’en-tête. Les jeux DS utilisent leurs icônes de lancement natives de 32 pixels, affichées sans interpolation. Rubis, Saphir, Émeraude, Rouge Feu et Vert Feuille utilisent les jaquettes françaises de Poképédia, avec un cadrage CSS retirant la bande Game Boy Advance à gauche. Les fichiers sources ne sont pas modifiés.

Rouge Feu et Vert Feuille possèdent leur propre modèle de suivi, fondé sur le catalogue régional Kanto (151 espèces), sans réutiliser la progression des versions Rouge/Bleu/Jaune.

Les grands compteurs affichent le nombre total obtenu (à ranger + rangés), sans sous-texte. La légende présente les effectifs des trois états en badges gris, jaune et vert. Les compteurs de génération suivent le même calcul et les barres conservent leurs segments par état.

Le menu de chaque boîte applique À ranger, Rangé ou À obtenir uniquement à ses emplacements occupés, en une seule écriture. Les boîtes shiny utilisent un seul préfixe S (par exemple S 0001–0030), une étoile dans leur titre et un rappel sur l’icône HOME shiny.

## Catalogue

`pokedex-data.js` est généré par `node scripts/build-pokedex.cjs`, à partir d’une révision identifiée des CSV publics de PokéAPI. Les noms français, générations et numéros régionaux proviennent de ces CSV. Pour une actualisation, changer la révision dans le générateur et relancer celui-ci. Le générateur accepte aussi `POKEDEX_SOURCE_DIR` pour lire un dossier de CSV déjà téléchargés.

Le national ajoute les espèces par numéro national. Les formes régionales permanentes Alola, Galar, Hisui et Paldea occupent ensuite leurs propres boîtes ; les formes de combat temporaires et les costumes sont exclus. Les formes régionales propres à la région d’un jeu sont utilisées pour son illustration ; un catalogue de jeu reste un suivi par espèce, pas un inventaire exhaustif de toutes ses formes. Les icônes disponibles sont servies par Poképédia, avec un pictogramme de repli.

La progression utilise les identifiants stables des espèces et formes dans chaque suivi, et non les positions dans les boîtes. Actualiser le catalogue ne recrée pas les suivis. Les générations sont calculées depuis les espèces. Un nouveau catalogue nécessite son intitulé français et, si nécessaire, ses règles de formes et son icône dans le module.

Kalos est présenté comme un catalogue complet de 457 espèces. Les trois index officiels Centre, Côtes et Montagnes sont concaténés dans cet ordre, sans doublons ; les numéros affichés sont des positions continues de rangement pour ce catalogue regroupé. Soleil/Lune et Ultra-Soleil/Ultra-Lune proposent leurs catalogues Alola complets, sans catalogues d’îles dans la création.

Les progressions déjà renseignées dans les anciennes previews sont reprises dans des suivis nommés sans écrire dans les clés d’origine ; les sous-Dex de Kalos et d’Alola sont regroupés par espèce en gardant le statut le plus avancé. Les catalogues jamais renseignés ne créent pas de suivi. La reprise des anciennes clés de maquette est réservée à la preview, uniquement si son snapshot ne contient pas encore de champ pokedex ; une restauration vide ne relance pas cette reprise. Ces clés ne sont jamais lues pour un compte normal. Le cache privé utilise une clé dédiée par compte et ses écritures sont atomiques. Une erreur de chargement cloud bloque toute modification. Aucun achat ou jeu réel de la collection n’est utilisé.

Sources : [PokéAPI](https://github.com/PokeAPI/pokeapi), [visuels HOME](https://github.com/PokeAPI/sprites), [icônes Poképédia](https://www.pokepedia.fr/Cat%C3%A9gorie:Ic%C3%B4ne_de_jeu_dans_Pok%C3%A9mon_HOME).

Vérification : `node tests/pokedex.cjs` dans l’environnement navigateur décrit par `AGENTS.md`.

## Sessions et validation

`JTDData.normalizePokedex` valide les identifiants, noms, catalogues et états, sans dépendre du catalogue graphique courant. Le Pokédex est chargé, sauvegardé et restauré avec les autres données privées. Les limites de taille Firestore sont vérifiées avant une écriture. Un changement de compte ferme les modales, annule les confirmations et vide les anciennes vues. Les actions différées vérifient la génération de session et la révision de la vue.

`tests/pokedex-account.cjs` couvre l’interface hors preview avec des modules Firebase entièrement simulés et aucun accès réseau au backend : changement de compte, chargement vide, sauvegarde cloud, restauration et confirmation périmée. `tests/data.test.cjs` couvre le schéma et les sessions cloud ; `tests/pokedex.cjs` couvre les interactions et la reprise de la maquette dans le stockage sandbox.
