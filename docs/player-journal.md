# Journal de joueur

Le journal est privé et stocké avec les autres listes du compte. Une entrée décrit un parcours (jeu ou extension), son support joué, son accès et son statut. Les champs de fin, de ressenti et d’avis sont affichés uniquement pour les jeux terminés. Un replay crée une entrée distincte. La complétion propose « Jeu terminé », « 100 % » ou « Tous les succès », sans cumul. Le statut « En cours » utilise une manette et les statuts issus du journal sont identifiés sur les cartes de collection.

Le lien avec la collection utilise l’identifiant exact d’un exemplaire. Il est choisi explicitement ; aucun rapprochement par nom n’est effectué. Une entrée indépendante, numérique ou une extension ne crée pas de jeu dans la collection physique. Les extensions restent indépendantes du statut du jeu de base.

Pour un exemplaire lié, le journal pilote le statut de la collection. Un parcours en cours prévaut ; un parcours terminé antérieur reste conservé. Sans parcours en cours, une fin physique donne « Terminé », une fin numérique « Terminé ailleurs ». En supprimant le dernier lien, l’ancien statut de collection est rétabli. Les changements de nom, les ventes et les suppressions de l’exemplaire ne suppriment pas l’historique du journal.

La sauvegarde passe en version 4 et accepte toujours les versions 1 à 3 ainsi que les anciennes listes. L’export pour ChatGPT inclut les avis ; le partage public existant ne publie pas le journal. La persistance locale du journal et des statuts associés est atomique avant de remplacer les données en mémoire. Les gardes de session et la synchronisation cloud existantes sont conservées.

Le stockage cloud conserve son document unique. Une sauvegarde dépassant 900 000 octets est refusée avant toute mutation lors d’un enregistrement du journal, avec un message explicite. Les avis ont une limite de 20 000 caractères. Une évolution vers plusieurs documents peut être étudiée si cette limite devient concrète.

L’import du Sheets et le rapprochement manuel des titres constituent une étape séparée, après validation de cette première version. Le tracker Pokémon est un chantier distinct.

La preview utilise exclusivement les données et le stockage sandbox existants, sans charger Firebase ni ouvrir de session de production. Les tests du journal bloquent les requêtes externes.
