# Sauvegardes, export ChatGPT et imports

## Sauvegarde complète et restauration

Le JSON v4 conserve les quatre listes, une archive passive des anciennes données du journal (si présentes), le profil et les réglages des plateformes. Les sauvegardes v1 à v3, les anciens objets de données et les anciennes listes de jeux restent acceptés. Une restauration remplace les données ; les listes absentes d'un ancien fichier sont vidées. Le lien de partage et la connexion du compte ne sont pas restaurés depuis un fichier.

Le fichier est validé avant confirmation. Le même plafond conservateur de 900 000 octets est vérifié avant la restauration et les imports du cimetière. Les écritures locales précèdent le remplacement des données en mémoire ; un échec laisse les données actuelles intactes. La synchronisation cloud reste asynchrone et son état reste visible.

## Export pour ChatGPT

L'export pour les conseils est distinct d'une sauvegarde complète et ne peut pas être restauré. Il inclut les quatre listes, les identifiants d’exemplaires et les identifiants de lots de vente `saleId`. L’archive du journal et ses anciens liens sont exclus. Le fichier n'inclut ni images, ni profil, ni données d'acquisition, ni jeton de partage. Le partage public existant continue d'exclure le journal.

Le menu conserve « Exporter pour ChatGPT » pour transmettre le fichier à ChatGPT. Les boutons de création/copie et de désactivation du lien public ont été retirés du menu ; les données de partage existantes ne sont pas modifiées par cette évolution d'interface.

## Import additif du cimetière

CSV, TSV et JSON (dont les sauvegardes v4) sont acceptés. « Gain » est le prix encaissé ; « Valeur » est une estimation. Les lots et données matérielles existants restent conservés.

L'aperçu propose les correspondances par titre normalisé et alias de plateforme, puis par proximité de titre. Tous les exemplaires de la collection et du cimetière sont recherchables, même si le titre ou la plateforme diffèrent. Chaque candidat affiche son emplacement, ses informations distinctives et sa référence. Plusieurs candidats exacts ne sont jamais départagés automatiquement.

Les correspondances à vérifier apparaissent en tête avec un badge « À revoir » et un encadré accentué. Le nombre de cas restant à traiter se met à jour après chaque choix ; les lignes vérifiées restent à leur place et affichent « Choix validé ». Les autres lignes sont repliées par défaut lorsqu'il y a des correspondances à traiter, et restent consultables.

- **Transférer** : choisir explicitement un exemplaire actif ; son identifiant est conservé.
- **Ajouter un exemplaire distinct** : créer une nouvelle entrée au cimetière, sans lien ni retrait d'un autre exemplaire.
- **Ignorer** : conserver les données actuelles.

Un unique exemplaire exact déjà au cimetière et une répétition dans le fichier sont ignorés par défaut. Un exemplaire ne peut être transféré deux fois dans le même import. Si les listes changent pendant l'aperçu, les décisions doivent être revérifiées. Les autres listes et le journal ne sont pas remplacés par un import de ventes.

## Retrait du journal (issue #50, partie 1)

La page, les modales, les liens avec la collection et les ressources du journal sont retirés. Aucun import du journal n’est proposé. Les statuts déjà enregistrés des jeux sont conservés et redeviennent modifiables directement ; aucune ancienne entrée ne les recalcule. Les anciens liens `collectionId` et `journalPreviousStatus` ne sont plus interprétés.

Les données historiques restent privées et passives dans le champ `journal` des sauvegardes v4 et du document cloud, ainsi que dans l’ancienne clé locale par compte. Ce maintien évite leur effacement lors de la synchronisation habituelle et permet de conserver les anciennes sauvegardes sans perte. Ce n’est pas une migration : aucun accès ni nettoyage des données de production n’est lancé. L’isolation par compte, le stockage sandbox, la validation de taille et le rollback local restent en place. Une restauration explicite conserve les données archivées du fichier ; si ce champ est absent, l’archive est vide comme les autres listes absentes.

## Vérification et livraison

Les suites `import-export.test.cjs` et `import-export.cjs` couvrent les relations exportées, les ambiguïtés, les exemplaires vendus, les changements pendant l'aperçu, le refus des fichiers trop volumineux et le rollback. Les scénarios navigateur utilisent uniquement des données fictives, le mode sandbox et le blocage des requêtes externes. Le workflow Firebase Preview conserve le site et le stockage sandbox existants. La fusion nécessite le « go » de Rom après validation de la preview.
