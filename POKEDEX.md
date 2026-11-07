# Pokédex — preview interactive

Le module reste réservé à `IS_PREVIEW_MODE`. Il n’est ni synchronisé avec Firebase, ni intégré aux sauvegardes utilisateur. La progression locale est distincte pour HOME normal, HOME shiny et chaque catalogue de jeu/DLC.

## Catalogue

`pokedex-data.js` est généré par `node scripts/build-pokedex.cjs`, à partir d’une révision identifiée des CSV publics de PokéAPI. Les noms français, générations et numéros régionaux proviennent de ces CSV. Pour une actualisation, changer la révision dans le générateur et relancer celui-ci. Le générateur accepte aussi `POKEDEX_SOURCE_DIR` pour lire un dossier de CSV déjà téléchargés.

Le national ajoute les espèces par numéro national. Les formes régionales permanentes Alola, Galar, Hisui et Paldea occupent ensuite leurs propres boîtes ; les formes de combat temporaires et les costumes sont exclus. Les formes régionales propres à la région d’un jeu sont utilisées pour son illustration ; un catalogue de jeu reste un suivi par espèce, pas un inventaire exhaustif de toutes ses formes. Les icônes disponibles sont servies par Poképédia, avec un pictogramme de repli.

La progression utilise les identifiants stables des espèces et formes, et non les positions dans les boîtes. Actualiser le catalogue ne recrée pas les suivis. Les générations sont calculées depuis les espèces. Un nouveau catalogue nécessite son intitulé français et, si nécessaire, ses règles de formes et son icône dans le module.

La progression Kanto de la première maquette est reprise sans écrire dans sa clé d’origine. Les autres suivis commencent vides. Aucun achat ou jeu réel de la collection n’est utilisé.

Sources : [PokéAPI](https://github.com/PokeAPI/pokeapi), [visuels HOME](https://github.com/PokeAPI/sprites), [icônes Poképédia](https://www.pokepedia.fr/Cat%C3%A9gorie:Ic%C3%B4ne_de_jeu_dans_Pok%C3%A9mon_HOME).

Vérification : `node tests/pokedex.cjs` dans l’environnement navigateur décrit par `AGENTS.md`.
