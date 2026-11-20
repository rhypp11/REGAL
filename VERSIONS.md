# Versions du site

Le menu affiche `Version 3-111 (20.11.26)`. La majeure et le numéro de pull request sont renseignés dans `release-config.json`. Mettre à jour `pullRequest` avec le numéro de la PR qui livre le changement, puis régénérer les fichiers. La date du build suit l’heure de Paris.

Le manifeste conserve son identifiant interne par date et compteur pour que les pages déjà ouvertes puissent détecter les mises à jour. Plusieurs builds d’une même PR peuvent porter le même libellé public.

Après les modifications applicatives, exécuter `node scripts/build-release.cjs` puis `node scripts/build-release.cjs --check`. Le générateur écrit `site-version.json` et les métadonnées de `index.html`. Ces fichiers sont livrés ensemble, sans changer le pipeline statique de production. Relancer le générateur sans changement ne produit pas une nouvelle version. `JTD_BUILD_DATE` permet une date explicite pour les tests ; le contrôle ne dépend jamais du jour où il est exécuté.

L’empreinte de contenu complète la version lisible. Elle porte sur les fichiers applicatifs JS/CSS/HTML/SVG de la racine, les icônes PNG du site, le manifeste et la configuration Hosting. Les champs de version du HTML sont neutralisés pour éviter une empreinte autoréférente. Les tests, documents et captures ne changent pas la version applicative.

Le menu profil affiche la version effectivement chargée. La vérification de mise à jour lit seulement `site-version.json`, sans cache et sans comparer les ETags. Une version distante différente donne une seule alerte par page chargée ; le bouton reste disponible dans le profil après fermeture de l’alerte. Une erreur réseau ou une réponse invalide n’est pas considérée comme une mise à jour.

L’actualisation garde les vérifications de sauvegarde cloud et de session. Elle passe par une URL portant l’empreinte attendue pour éviter un ancien HTML en cache, conserve la route et retire ce paramètre lorsque la bonne version a été chargée. Les données utilisateur restent dans leur stockage habituel.

La preview et le site principal utilisent uniquement le fichier de version de leur propre origine. La preview conserve son isolation Firebase.
