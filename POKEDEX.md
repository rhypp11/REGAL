# Pokédex — preview interactive

Le module reste réservé à `IS_PREVIEW_MODE`. Il n’est ni synchronisé avec Firebase, ni intégré aux sauvegardes utilisateur. L’écran Mes Pokédex contient seulement les suivis créés et nommés. Plusieurs suivis peuvent utiliser le même catalogue HOME ou jeu/DLC, avec des progressions indépendantes.

La création utilise une modale partagée avec le cycle de focus/clavier du site. Le catalogue se choisit dans une grille de vignettes recherchable. Le crayon de chaque suivi permet de le renommer sans changer son catalogue ou ses cases, ou de le supprimer après confirmation. Les icônes sont communes à la grille, à la liste et à l’en-tête ; les jeux anciens sans icône disponible utilisent leur Pokémon emblématique.

Les grands compteurs affichent le nombre total obtenu (à ranger + rangés), sans sous-texte. La légende présente les effectifs des trois états en badges gris, jaune et vert. Les compteurs de génération suivent le même calcul et les barres conservent leurs segments par état.

## Catalogue

`pokedex-data.js` est généré par `node scripts/build-pokedex.cjs`, à partir d’une révision identifiée des CSV publics de PokéAPI. Les noms français, générations et numéros régionaux proviennent de ces CSV. Pour une actualisation, changer la révision dans le générateur et relancer celui-ci. Le générateur accepte aussi `POKEDEX_SOURCE_DIR` pour lire un dossier de CSV déjà téléchargés.

Le national ajoute les espèces par numéro national. Les formes régionales permanentes Alola, Galar, Hisui et Paldea occupent ensuite leurs propres boîtes ; les formes de combat temporaires et les costumes sont exclus. Les formes régionales propres à la région d’un jeu sont utilisées pour son illustration ; un catalogue de jeu reste un suivi par espèce, pas un inventaire exhaustif de toutes ses formes. Les icônes disponibles sont servies par Poképédia, avec un pictogramme de repli.

La progression utilise les identifiants stables des espèces et formes dans chaque suivi, et non les positions dans les boîtes. Actualiser le catalogue ne recrée pas les suivis. Les générations sont calculées depuis les espèces. Un nouveau catalogue nécessite son intitulé français et, si nécessaire, ses règles de formes et son icône dans le module.

Kalos est présenté comme un catalogue complet de 457 espèces. Les trois index officiels Centre, Côtes et Montagnes sont concaténés dans cet ordre, sans doublons ; les numéros affichés sont des positions continues de rangement pour ce catalogue regroupé. Soleil/Lune et Ultra-Soleil/Ultra-Lune proposent leurs catalogues Alola complets, sans catalogues d’îles dans la création.

Les progressions déjà renseignées dans les anciennes previews sont reprises dans des suivis nommés sans écrire dans les clés d’origine ; les sous-Dex de Kalos et d’Alola sont regroupés par espèce en gardant le statut le plus avancé. Les catalogues jamais renseignés ne créent pas de suivi. Le nouveau stockage est atomique sous une clé dédiée ; une erreur de lecture bloque les écritures pour préserver les données. Aucun achat ou jeu réel de la collection n’est utilisé.

Sources : [PokéAPI](https://github.com/PokeAPI/pokeapi), [visuels HOME](https://github.com/PokeAPI/sprites), [icônes Poképédia](https://www.pokepedia.fr/Cat%C3%A9gorie:Ic%C3%B4ne_de_jeu_dans_Pok%C3%A9mon_HOME).

Vérification : `node tests/pokedex.cjs` dans l’environnement navigateur décrit par `AGENTS.md`.
