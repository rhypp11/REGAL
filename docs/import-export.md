# Sauvegardes, export JSON et imports

## Sauvegarde complète et restauration

Le JSON v5 conserve les quatre listes, le journal (avis et liens compris), le profil et les réglages des plateformes. Les sauvegardes v1 à v4, les anciens objets de données et les anciennes listes de jeux restent acceptés. Une restauration remplace les données ; les listes absentes d'un ancien fichier sont vidées. Le lien de partage et la connexion du compte ne sont pas restaurés depuis un fichier.

Le fichier est validé avant confirmation. Une sauvegarde avec un identifiant d'exemplaire répété et référencé par le journal est refusée pour éviter de rattacher l'historique au mauvais exemplaire. Le même plafond conservateur de 900 000 octets est vérifié avant la restauration, les écritures du journal et les imports du cimetière. Les écritures locales précèdent le remplacement des données en mémoire ; un échec laisse les données actuelles intactes. La synchronisation cloud reste asynchrone et son état reste visible.

## Export JSON pour partager les données

L'export pour les conseils est distinct d'une sauvegarde complète et ne peut pas être restauré. Il inclut les listes et le journal avec les avis, les identifiants d'exemplaires, les liens `collectionId` et les identifiants de lots de vente `saleId`. Les relations permettent de distinguer exemplaires, parcours, replays et historique d'exemplaires supprimés. Le fichier n'inclut ni images, ni profil, ni données d'acquisition, ni jeton de partage. Le partage public existant continue d'exclure le journal.

Le menu propose « Exporter mes données » avec la mention JSON, utilisable notamment dans ChatGPT. Les boutons de création/copie et de désactivation du lien public ont été retirés du menu ; les données de partage existantes ne sont pas modifiées par cette évolution d'interface.

## Import additif du cimetière

CSV, TSV et JSON (dont les sauvegardes v5) sont acceptés. « Gain » est le prix encaissé ; « Valeur » est une estimation. Les lots et données matérielles existants restent conservés.

L'aperçu propose les correspondances par titre normalisé et alias de plateforme, puis par proximité de titre. Tous les exemplaires de la collection et du cimetière sont recherchables, même si le titre ou la plateforme diffèrent. Chaque candidat affiche son emplacement, ses informations distinctives et sa référence. Plusieurs candidats exacts ne sont jamais départagés automatiquement.

Les correspondances à vérifier apparaissent en tête avec un badge « À revoir » et un encadré accentué. Le nombre de cas restant à traiter se met à jour après chaque choix ; les lignes vérifiées restent à leur place et affichent « Choix validé ». Les autres lignes sont repliées par défaut lorsqu'il y a des correspondances à traiter, et restent consultables.

- **Transférer** : choisir explicitement un exemplaire actif ; son identifiant est conservé, ainsi que son historique dans le journal.
- **Ajouter un exemplaire distinct** : créer une nouvelle entrée au cimetière, sans lien ni retrait d'un autre exemplaire.
- **Ignorer** : conserver les données actuelles.

Un unique exemplaire exact déjà au cimetière et une répétition dans le fichier sont ignorés par défaut. Un exemplaire ne peut être transféré deux fois dans le même import. Si les listes changent pendant l'aperçu, les décisions doivent être revérifiées. Les autres listes et le journal ne sont pas remplacés par un import de ventes.

## Import additif du journal Sheets

L’import accepte les CSV/TSV des onglets personnels du journal et un JSON préparé depuis Sheets. Seules les lignes terminées sont prises en compte : les blocs latéraux En cours, backlog et sorties sont exclus. Le CSV ne transporte pas les notes de cellules ; un avertissement conseille le JSON préparé pour conserver les avis. Aucune connexion Google n’est nécessaire dans JTD.

Les notes par critère sont conservées en texte dans l’avis. Les dates conservent leur précision (année, mois ou jour). Les extensions demandent leur jeu de base. Le symbole 🔁 indique un replay, dont le support et l’accès restent à préciser.

La fenêtre donne toute la hauteur à la liste sur mobile et davantage de largeur sur ordinateur. Les cas à vérifier apparaissent en tête, avec une explication pour chaque choix. Le bouton « Revoir » mène au premier cas incomplet ; « Importer » indique le nombre de parcours ajoutés. Si tout est ignoré, « Fermer sans importer » ferme l’aperçu sans écrire de données. Chaque parcours peut être ajouté sans lien, lié explicitement à un exemplaire actif, à vendre ou vendu, ou ignoré. Aucun exemplaire physique n’est créé. L’aperçu annonce les changements de statut de collection ; un parcours numérique lié peut donner « Terminé ailleurs ».

Les parcours identiques et les réimports de la même ligne sont ignorés par défaut, même après correction du titre dans JTD. Les dates partielles qui recouvrent un parcours existant demandent une décision : ignorer ou ajouter un parcours distinct. Il est toujours possible de conserver un véritable replay. L’import ajoute des parcours sans remplacer le journal existant. Les choix sont revérifiés si les données changent ; un changement de compte bloque l’application.

La sauvegarde v5 conserve les dates partielles et la provenance des imports. Les anciennes sauvegardes restent acceptées.
## Vérification et livraison

Les suites `import-export.test.cjs` et `import-export.cjs` couvrent les relations exportées, les ambiguïtés, les exemplaires vendus, les changements pendant l'aperçu, le refus des fichiers trop volumineux et le rollback. Les scénarios navigateur utilisent uniquement des données fictives, le mode sandbox et le blocage des requêtes externes. Le workflow Firebase Preview conserve le site et le stockage sandbox existants. La fusion nécessite le « go » de Rom après validation de la preview.


