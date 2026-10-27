# Vigieau Water Card (FR)

Carte Home Assistant pour l'intégration **Vigieau** : niveau d'alerte sécheresse et usages de l'eau (arrosage, lavage, piscines…) **autorisés ou interdits**. Les entités Vigieau sont **détectées automatiquement**. Style verre, thème clair/sombre automatique, éditeur visuel, textes en français.

## Installation (HACS)
HACS → ⋮ → Dépôts personnalisés → URL de ce dépôt, catégorie **Tableau de bord** → installer → recharger la page.

## Configuration
Sans configuration particulière, la carte trouve toute seule les entités de votre commune :

```yaml
type: custom:vigieau-water-card
title: Restrictions d'eau
```

Options :

| Option | Description |
|---|---|
| `title` | Titre de la carte |
| `commune` | Identifiant de la commune dans les entités (ex. `la_chapelle_themer`) ; vide = détection automatique |
| `level_entity`, `level_numeric_entity` | Capteurs du niveau d'alerte ; vide = détection automatique |
| `only_restricted` | N'afficher que les usages interdits |
| `columns` | Colonnes (0 = automatique) |
| `theme` | `auto`, `light`, `dark` |
| `usages` | Avancé : liste manuelle d'usages `{ name, icon, allowed_entity, restriction_entity }` à la place de la détection automatique |

## Fonctionnement
- **Niveau d'alerte** : barre en 5 crans (pas de restriction, vigilance, alerte, alerte renforcée, crise), colorée selon la gravité.
- **Usages** : un `binary_sensor` « … autorisé à … » à `on` = **Autorisé**, à `off` = **Interdit**. Les usages interdits sont affichés en premier.
- **Sous conditions** : un usage autorisé dont le capteur « Restrictions - … » annonce une condition (horaires, jours…) s'affiche en orange « Sous conditions ».
- **Détails** : le texte du capteur « Restrictions - … » s'affiche sous l'usage ; un appui le déplie.
- Boutons **Tous / Interdits** pour filtrer.

Licence MIT.
