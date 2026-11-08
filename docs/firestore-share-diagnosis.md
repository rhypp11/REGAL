# Liens Firestore et ChatGPT

## Constat du 8 novembre 2026

Le lien REST fourni par Rom répond en HTTP 200, avec `application/json; charset=UTF-8` et 833 769 caractères. Le document contient les quatre listes publiques et les métadonnées de publication. Son contenu personnel n'est pas reproduit dans ce diagnostic ni dans les fixtures.

L'outil web de ChatGPT échoue à ouvrir cette même URL. Ce résultat distingue une réponse Firestore valide d'une ressource effectivement lisible par l'outil web. Il ne prouve pas la cause interne de son refus. La taille de la réponse et le format JSON typé de Firestore sont des contraintes possibles ; aucun test ne permet ici de les désigner comme cause certaine. Ce n'est pas un problème CORS démontré, ni une erreur d'authentification sur la requête HTTP testée.

## Solution disponible

Dans le menu du profil : **Partage → Exporter pour ChatGPT**, puis joindre le fichier JSON téléchargé au message. Le fichier est un instantané : renouveler l'export après une modification de la collection. Aucun lien public n'est nécessaire pour ce transfert.

Cette fonction existait déjà sur `main`. Le changement précise son intitulé et indique explicitement de joindre le fichier. Les boutons du lien REST étaient déjà retirés du menu. Les anciens documents publics ne sont ni révoqués ni modifiés par cette correction.

L'export réutilise `JTDData.createChatGPTPayload` : il conserve les relations utiles entre jeux, contenus et ventes, et exclut notamment images, profil, comptes numériques, acquisitions privées, journal, Pokédex et jeton de partage. Il ne remplace pas une sauvegarde complète.

## Limite d'un lien vivant

Une page statique qui récupère le document uniquement en JavaScript ne garantit pas sa lecture par ChatGPT. Un lien vivant plus compatible demanderait un service qui renvoie directement du HTML ou du texte compact, éventuellement paginé. Il faudrait alors prévoir validation du jeton, révocation, absence de listing, limites de taille et de débit, et isolation complète de la preview. Aucun service ni changement des règles Firestore n'est introduit pour cette clarification.

## Isolation et vérifications

Le test du lien fourni est une lecture ponctuelle de production. Il n'est exécuté ni dans la preview ni dans la CI. La preview garde ses données fictives, son stockage distinct et les gardes Firebase existantes. Aucun document personnel ou jeton réel n'est ajouté au dépôt.

Les suites existantes `tests/import-export.test.cjs` et `tests/import-export.cjs` vérifient l'export et les exclusions. `tests/data.test.cjs` vérifie aussi les sessions, les gardes cloud et les partages existants.
