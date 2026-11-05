# Calories brûlées par sport

Élan estime les calories avec la méthode des MET. Le même tableau est disponible dans l'app : Réglages > Guide des calories.

## Calcul

```
calories = MET × poids (kg) × durée (h)
```

Exemple : 1 h de kick boxing à intensité modérée pour 75 kg donne 7,3 × 75 × 1 = 548 kcal.

Le poids utilisé est celui de la dernière pesée à la date de la séance ou avant. Sans pesée antérieure, l'app prend la première pesée enregistrée. Sans aucune pesée, elle n'affiche pas d'estimation.

## Calories par heure

| Sport | Intensité | MET | 60 kg | 75 kg | 90 kg | Code et activité du Compendium |
|---|---|---|---|---|---|---|
| Course | Légère | 7,5 | 450 | 563 | 675 | 12020 : Jogging, general, self-selected pace |
| Course | Modérée | 9,3 | 558 | 698 | 837 | 12050 : Running, 6-6.3 mph (10 min/mile) |
| Course | Intense | 11,8 | 708 | 885 | 1062 | 12080 : Running, 7.5 mph (8 min/mile) |
| Muscu | Légère | 3,5 | 210 | 263 | 315 | 02054 : Resistance training, multiple exercises, 8-15 reps |
| Muscu | Modérée | 5,0 | 300 | 375 | 450 | 02052 : Resistance training, squats, deadlift |
| Muscu | Intense | 6,0 | 360 | 450 | 540 | 02050 : Weight lifting, power lifting or body building, vigorous |
| Kick boxing | Légère | 5,3 | 318 | 398 | 477 | 15425 : Martial Arts, slower pace, novice performers, practice |
| Kick boxing | Modérée | 7,3 | 438 | 548 | 657 | 15457 : Kickboxing |
| Kick boxing | Intense | 10,3 | 618 | 773 | 927 | 15430 : Martial Arts, moderate pace (dont kick boxing, Muay Thai) |
| Vélo | Légère | 4,0 | 240 | 300 | 360 | 01010 : Bicycling, <10 mph, leisure |
| Vélo | Modérée | 6,8 | 408 | 510 | 612 | 01020 : Bicycling, 10-11.9 mph, leisure, slow |
| Vélo | Intense | 10,0 | 600 | 750 | 900 | 01040 : Bicycling, 14-15.9 mph, fast, vigorous |
| Natation | Légère | 5,8 | 348 | 435 | 522 | 18240 : Swimming laps, freestyle, slow, recreational |
| Natation | Modérée | 8,0 | 480 | 600 | 720 | 18290 : Swimming, crawl, medium speed, ~50 yards/minute |
| Natation | Intense | 9,8 | 588 | 735 | 882 | 18230 : Swimming laps, freestyle, fast, vigorous |
| Marche | Légère | 3,0 | 180 | 225 | 270 | 17170 : Walking, 2.5 mph, firm, level surface |
| Marche | Modérée | 3,8 | 228 | 285 | 342 | 17190 : Walking, 2.8 to 3.4 mph, moderate pace |
| Marche | Intense | 4,8 | 288 | 360 | 432 | 17200 : Walking, 3.5 to 3.9 mph, brisk |
| Yoga | Légère | 2,3 | 138 | 173 | 207 | 02175 : Yoga, General |
| Yoga | Modérée | 2,7 | 162 | 203 | 243 | 02185 : Yoga, Vinyasa |
| Yoga | Intense | 4,0 | 240 | 300 | 360 | 02160 : Yoga, Power |
| HIIT | Légère | 5,0 | 300 | 375 | 450 | 02035 : Circuit training, moderate effort |
| HIIT | Modérée | 7,0 | 420 | 525 | 630 | 02210 : High intensity interval exercise, moderate effort |
| HIIT | Intense | 11,0 | 660 | 825 | 990 | 02214 : High intensity interval exercise, burpees, Tabata, vigorous |
| Autre | Légère | 3,5 | 210 | 263 | 315 | 02034 : Circuit training, light effort |
| Autre | Modérée | 5,5 | 330 | 413 | 495 | 02060 : Health club exercise, general |
| Autre | Intense | 7,5 | 450 | 563 | 675 | 02040 : Circuit training with kettlebells, vigorous |

Les libellés d'intensité et le choix de l'activité retenue pour chacun sont des choix de l'app, pas du Compendium. La ligne « Autre » est une approximation.

## Kick boxing

Le Compendium donne deux valeurs : 7,3 pour « Kickboxing » et 10,3 pour les arts martiaux à rythme modéré, kick boxing inclus. L'app utilise 7,3 pour « Modérée » et 10,3 pour « Intense ». « Légère » (5,3) correspond à une pratique lente de débutant.

## Vitesse réelle

Si une distance est saisie en course, vélo ou marche, l'app calcule la vitesse et prend le MET correspondant du Compendium, à la place de l'intensité choisie.

| Course (km/h) | MET | | Vélo (km/h) | MET | | Marche (km/h) | MET |
|---|---|---|---|---|---|---|---|
| moins de 6,9 | 6,5 | | moins de 16 | 4,0 | | moins de 4,5 | 3,0 |
| 6,9 à 7,8 | 7,8 | | 16 à 19,2 | 6,8 | | 4,5 à 5,6 | 3,8 |
| 7,8 à 8,8 | 8,5 | | 19,2 à 22,5 | 8,0 | | 5,6 à 6,4 | 4,8 |
| 8,8 à 9,6 | 9,0 | | 22,5 à 25,7 | 10,0 | | 6,4 et plus | 5,5 |
| 9,6 à 10,4 | 9,3 | | 25,7 à 32 | 12,0 | | | |
| 10,4 à 11 | 10,5 | | 32 et plus | 16,8 | | | |
| 11 à 11,7 | 11,0 | | | | | | |
| 11,7 à 12,4 | 11,8 | | | | | | |
| 12,4 à 14 | 12,0 | | | | | | |
| 14 à 17 | 14,8 | | | | | | |
| 17 et plus | 18,5 | | | | | | |

Le Compendium donne les vitesses en miles par heure. Les seuils en km/h sont des conversions arrondies, et les vitesses entre deux entrées sont rattachées à la plus proche.

## Limites

- Ce sont des moyennes de population, pas une mesure de ta dépense réelle.
- Le résultat inclut la dépense de repos : ce n'est pas uniquement le surplus dû au sport.
- Le Compendium signale que certaines valeurs sont estimées plutôt que mesurées.
- La valeur standard de 1 MET surestime souvent la dépense de repos réelle : d'environ 20 % en moyenne selon une étude sur 769 personnes.
- Ces chiffres ne sont pas un avis médical ni nutritionnel.

## Sources

- [2024 Adult Compendium : sports](https://pacompendium.com/sports/)
- [2024 Adult Compendium : conditioning exercise](https://pacompendium.com/conditioning-exercise/)
- [2024 Adult Compendium : running](https://pacompendium.com/running/)
- [2024 Adult Compendium : bicycling](https://pacompendium.com/bicycling/)
- [2024 Adult Compendium : walking](https://pacompendium.com/walking/)
- [2024 Adult Compendium : water activities](https://pacompendium.com/water-activities/)
- [Metabolic equivalent: one size does not fit all (J Appl Physiol, 2005)](https://pubmed.ncbi.nlm.nih.gov/15831804/)
