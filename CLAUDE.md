# Suivi dépenses : contexte du projet pour Claude Code

> Ce fichier résume tout ce qu'il faut savoir pour reprendre le projet : qui l'utilise, comment travailler, l'architecture, le modèle de données, les règles de calcul, les fonctionnalités, les tests et l'historique. **Lis-le en entier avant toute modification.**
> Dernière version livrée : **`5 nov. · v35`** (constante `APP_VERSION`, dans `src/app7.js`).

---

## 1. Qui, et comment travailler avec lui

- **Utilisateur : Robin**, en France. Il écrit en **français, de façon brève**, parfois par dictée vocale (fautes de frappe fréquentes : comprendre l'intention).
- **Réponds en français, concis, concret, sans jargon.** Pas de longs exposés techniques : ce qui change pour lui, comment s'en servir, les limites.
- **Sois honnête sur les limites techniques** : CORS, plan gratuit Firebase, Safari/iOS, pas de serveur… Il préfère « ce n'est pas possible, voici l'alternative » plutôt qu'une demi-solution cachée.
- **Il n'aime pas les interfaces surchargées.** Fais simple et lisible sur téléphone (390 px de large).
- **Chaque livraison est vérifiée** : tests de scénarios (`tests/`), contrôle visuel sur téléphone, puis un récap court de ce qui change.
- **Avant un gros changement ambigu**, pose une question courte. Pour une demande claire, fais-la directement.
- **Quand tu changes un comportement existant**, dis-le explicitement (« avant… / maintenant… »), surtout si un ancien test change d'attente.
- **À chaque livraison :**
  1. incrémente `APP_VERSION` (`src/app7.js`, format `'J mois · vNN'`) ;
  2. reconstruis `index.html` ;
  3. lance les tests ;
  4. commit + push sur `main` (`index.html`, `src/`, `tests/`…), puis vérifie le site en ligne ;
  5. précise si `firestore.rules` change : il faut alors le publier dans la console Firebase, onglet Firestore › Règles.
- **À la fin de chaque réponse**, propose les prochaines améliorations utiles. Il aime qu'on lui en suggère, mais il choisit lui-même.

### Son usage (résumé, sans données personnelles)

- Plusieurs comptes : un compte courant perso (le plus utilisé), des comptes joints (dont un partagé dans l'app avec une autre personne qui utilise aussi l'app) et un compte d'épargne.
- Des virements récurrents vers un compte joint servent à payer des dépenses communes (courses, box internet, abonnements) : ils sont catégorisés (ex. *Alimentation*).
- Il note souvent ses paiements **avant** qu'ils passent en banque (carte débitée 1 à 3 jours après).
- Il ne veut pas « gonfler » ses dépenses et recettes avec des opérations qui s'annulent (ex. −22 € payés pour quelqu'un, +22 € remboursés).
- Il partage beaucoup de dépenses avec une autre personne (courses, restos, week-ends) : d'où le système d'avances, de remboursements et de dépenses communes.
- Ses détails personnels (banques, montants, noms) ne sont **pas** dans ce dépôt public : ne jamais y ajouter de données bancaires réelles.

---

## 2. Contraintes techniques (non négociables)

- **Un seul fichier `index.html`** hébergé sur **GitHub Pages** (dépôt `martinwindhampro-cmd/finance-budget`, branche `main`).
- **Publication** : Claude publie lui-même chaque nouvelle version directement sur `main` (tests OK d'abord), puis vérifie que le site en ligne affiche la nouvelle `APP_VERSION`. Robin n'a plus de glisser-déposer à faire.
- **Firebase, plan gratuit Spark uniquement** : Auth (email + mot de passe) et Firestore.
  - **Pas** de Cloud Functions, pas de Storage payant, pas de serveur, pas d'API payante, pas d'agrégateur bancaire.
  - Conséquence : pas de récupération automatique des opérations bancaires. Les vraies notifications passent par un **relais gratuit Cloudflare** (voir Notifications).
- **Bibliothèques CDN** :
  - Firebase *compat* 10.8.1 (`firebase-app`, `-auth`, `-firestore`) ;
  - Chart.js 4.4.1 ;
  - SheetJS `xlsx` 0.18.5, chargé **à la demande** depuis cdnjs, uniquement pour lire un relevé Excel.
- **PWA** : `manifest.webmanifest`, `sw.js` (cache `budget-v3` : réseau d'abord pour la page, cache d'abord pour les bibliothèques), icônes. L'app est **installée sur iPhone et PC**.
- **Hors ligne** : `db.enablePersistence({ synchronizeTabs: true })`.
- Taux de change via `api.frankfurter.app` (BCE, gratuit). Les banques n'ont pas d'API utilisable (CORS + CGU), c'est déjà expliqué à Robin.
- Logos des marchands : service d'icônes Google (`www.google.com/s2/favicons`).

---

## 3. Organisation du dépôt

```
index.html            ← GÉNÉRÉ (ne pas éditer à la main) : c'est le fichier servi par GitHub Pages
manifest.webmanifest, sw.js, icon-*.png, apple-touch-icon.png, favicon-32.png   ← PWA
firestore.rules       ← règles de sécurité (à publier à la main dans la console Firebase)
push/worker.js        ← relais de notifications (Cloudflare Worker), SANS la clé privée
src/
  shell.html          ← tout le HTML + CSS, avec le marqueur /*APP_JS*/ où le JS est injecté
  app1.js … app16.js  ← le JavaScript, découpé par thème (voir ci-dessous)
  build.py            ← assemble : python3 src/build.py  → index.html
tests/
  fsmock.js           ← faux Firebase (Auth + Firestore en mémoire, avec les mêmes règles de sécurité)
  t5.js … t33.js      ← scénarios (fixtures/ : données fictives) (jsdom), un fichier par grande fonctionnalité
  run.sh              ← lance tout : cd tests && ./run.sh   (ou ./run.sh t29 t31)
```

**Ordre de concaténation (important, `build.py`)** : `app1, app2, app3, app6, app7, app8, app9, app10, app11, app12, app13, app14, app15, app16, app5, app4`.

Tout est dans un seul `<script>` en `'use strict'`. Les fonctions sont « hoistées », mais pas les `const` et `let` de haut niveau : attention à l'ordre si tu ajoutes une constante utilisée tôt. `app4.js` (événements) est en dernier.

| Fichier | Rôle |
|---|---|
| `app1.js` | Firebase, outils (`$`, `eur`, `num`, `parseAmt`, `uid`…), **données** (`normalize`, `month`, modèles récurrents), **calculs** (`calc`, `chainBalance`, `eff` / `cash`, `vspent`, alertes), **synchro** (`mutate`, `save`, fusion à 3 voies `mergeMeta` / `mergeList`, `pushCloud`, `onRemote`), connexion, comptes (`openAccount`, `createAccount`, invitations, membres), activité, sauvegardes quotidiennes |
| `app2.js` | Interface commune (`UI`, `svg`/icônes `IP`, `tip`, `rowHTML`, `go`, `render`, `renderChrome`), écrans **Accueil**, **Mouvements**, **Budgets** (répartition, cartes budget, échéancier) |
| `app3.js` | **Épargne** (simulateur, objectifs, anciens comptes d'épargne internes `U.savAcc`), **Historique** (graphiques), **fiche d'édition d'un mouvement** (`openPanel`, `paintPanel`, `panelClick`, `savePanel`), boîtes de dialogue génériques (`formDialog`), budget, solde au 1er |
| `app4.js` | Gestionnaires d'événements globaux (`click` sur `data-a`, `input`, `change`, clavier) : **c'est ici qu'on branche une nouvelle action `data-a="…"`** |
| `app5.js` | Comptes : sélecteur, écran « Tous mes comptes », réglages du compte (nom, banque, logo, couleur, type courant/épargne, membres), messagerie (`vMessages`) |
| `app6.js` | Accueil d'un **compte épargne** (`vSavAccueil`) |
| `app7.js` | **Virements** : entre mes comptes (lignes liées, même `xfer.id`), vers une personne (collection `transfers`), automatiques (modèles) ; annuaire (`publishDir`) ; `txMonth` (écrire dans le mois d'un autre compte par transaction) ; `recvAccount` ; **`APP_VERSION`** ; réglages |
| `app8.js` | **Mode simple** (pour personnes peu à l'aise : `SIMPLE()`, accueil et fiche simplifiés) |
| `app9.js` | **Devises** (BCE), **objectifs** d'épargne, **crédits** (prêts, mensualités en charge fixe) |
| `app10.js` | **Connexions** entre utilisateurs (`links`), **avances / remboursements** (`debts`, `pdebts`) : création, fiche, paiements, suppression à deux, remboursement automatique, rappels |
| `app11.js` | **Partager une dépense à plusieurs** (`splitDialog`, groupes `grp`), demandes reçues (invitations), refus |
| `app12.js` | **Pointage avec le relevé bancaire** : lecture CSV / Excel / OFX / QIF, rapprochement, écran de validation |
| `app13.js` | **Relevés bancaires** : historique des relevés déposés (`statements`), écran `releves`, fusion sans doublon, rappel mensuel |
| `app14.js` | **Intérêts des comptes épargne** (Livret A par quinzaines, au jour le jour, fin de mois ; plafonds ; fiscalité) |
| `app16.js` | **Vraies notifications** (`pushSetup`, `pushTo`, `PUSH_URL`, `VAPID_PUB`), **Charges fixes partagées** (`shfix` : proposer une charge fixe à une personne connectée, elle accepte et la même charge fixe est créée chez elle ; virement auto vers le même compte joint si elle en est membre — `fixCreate`), **« J'ai remboursé »** (remboursement vers une autre personne « à confirmer » : `payConfirm`, `payRejAction`, carte « À valider » sur l'accueil et la messagerie), **pastille sur l'icône** (`appBadge`) |
| `app15.js` | **Dépenses communes façon Tricount** (compensation des avances, lignes dans les 2 comptes, modification sans accord, choix Non / Partagée / Déduire / Avance dans la fiche dépense, choix habituel par catégorie, **bilan par personne** + « Tout solder », conversion des anciens « ½ Partagé ») |

`app.js` et `sync.js` (anciennes versions monolithiques) **ne sont plus utilisés**. Ils ne sont pas dans ce dépôt.

---

## 4. Modèle de données (Firestore)

### Collections

| Chemin | Contenu | Qui peut lire / écrire |
|---|---|---|
| `users/{uid}` | profil + préférences `U` (voir plus bas) + `accounts: [ids]`, `seen` | le propriétaire |
| `accounts/{id}` | `name, bank, site, color, kind ('courant' \| 'epargne'), owner, members[], memberEmails{uid:email}`, **`meta`** (JSON canonique de tout le compte sauf les mois), **`summary`** `{k, current, est, rav}` (pour afficher les autres comptes sans les charger), `updatedAt/By` | membres (le propriétaire gère les membres) |
| `accounts/{id}/months/{AAAA-MM}` | `data` = JSON du mois | membres |
| `accounts/{id}/activity`, `/backups` | journal (messagerie) et sauvegardes quotidiennes | membres |
| `accounts/{id}/statements/{du}_{au}` | relevés bancaires déposés : `from, to, n, bal{date,amt}, running, name, src, at, by, byEmail, lines` (JSON `[{d,a(centimes),l,b?}]`) | membres |
| `invites/{acc}_{email}` | invitation à rejoindre un compte | expéditeur / destinataire |
| `links/{emailA}__{emailB}` | connexion entre 2 personnes (emails triés) : `from, to, status (pending/accepted/declined), uids{uid:email}` | les 2 |
| `directory/{email}` | annuaire : noms des comptes proposés (jamais les soldes), `recv` (compte de réception par défaut) | soi + personnes connectées |
| `transfers/{id}` | virement vers une personne : `from, fromEmail, to(email), amount, label, date(jour), k, status sent/received, toAcc, toAccName, debt?` | expéditeur / destinataire |
| `shfix/{id}` | **charge fixe partagée** proposée : `members[2], emails{}, from, fromEmail, fromAcc, tmplId, to, toEmail, status (pending/accepted/declined), at, answeredAt, toAcc, toAccName, tpl{name, amount, date, cat, site?, img?, xfer?{acc, accName}}` | les 2 membres ; le destinataire ne change que `status, answeredAt, toAcc, toAccName` |
| `pdebts/{id}` | **avance partagée** entre 2 personnes (même forme qu'une avance + `members[2], emails{}, invite?, reqs[], closed`) | les 2 membres ; suppression seulement si `closed == true` |

### Données d'un compte : l'objet `S` en mémoire (compte affiché = `active`)

```js
S = {
  categories: ['Logement','Énergie',…],
  templates: { expenses: [...], incomes: [...], budgets: [...] },   // modèles récurrents (tmplId) recopiés chaque mois
  months: { 'AAAA-MM': { bankBalance /* solde au 1er saisi, ou null = calculé */, savingGoal,
                         expenses: [...], incomes: [...], budgets: [{id,cat,amount,tmplId}],
                         rec /* pointage du mois : at, gap, todo, done, val[], ign[], grp[], nogrp[], bank{k,amt} */ } },
  debts: [...],        // avances rangées dans CE compte (le compte qui a avancé)
  loans: [...],        // crédits
  goal: {name, amount},// objectif d'un compte épargne
  sav: {type, rate, calc:'q'|'d'|'m', pay:'year'|'month', tax:'net'|'pfu', cap},   // caractéristiques épargne
  cmDef: { [catégorie]: {mode:'half'|'debt'|'new', comp?, who?, name?} },          // choix habituel « dépense commune »
  alerts: {thr, pct, custom: [...]}, savings, savAcc (ancien)
}
```

**Un mouvement** (dépense ou recette) :
- **Champs de base** : `id, name, amount, date` (jour du mois, en texte, `''` si aucun), `status` (`'Payé'` / `'Prévu'` pour une dépense, `'Reçu'` / `'En attente'` pour une recette), `cat`, `isFixed` + `tmplId` (récurrent), `site` / `img` (logo), `fx {cur, amt, rate, date}` (devise), `by` (email, sur un compte partagé).
- **Virements** : `xfer {kind:'acc'|'person', acc, accName, id, auto, to, from}`.
- **Dépenses communes et avances** :
  - `share` : **ma part**, quand j'ai payé une dépense commune (le compte garde `amount`, les stats ne comptent que `share`) ;
  - `nc: 1` : part « compensée » chez l'autre (rien ne sort du compte, compte dans ses catégories) ;
  - `cpdebt / cpid / comp` : lien vers une dette déduite ;
  - `newdebt` : avance créée par cette dépense ;
  - `split` : partage à plusieurs.
- **Divers** :
  - `isDivided` : **ancien** « ½ Partagé » (compte la moitié **dans le solde aussi**) ;
  - `bk` : ajouté depuis le relevé ;
  - `int` : intérêts enregistrés ;
  - `debt` : mouvement d'un remboursement.

**Préférences utilisateur `U`** (`users/{uid}`) : `savAcc, savings, savIncl, contacts, recvAcc` (compte de réception par défaut), `recvHide, xfHide, xfAcc, goals`.

### Synchronisation (à respecter)

- **Écrire dans le compte affiché : toujours via `mutate(() => { … }, 'message toast' | false)`.** Ça sauvegarde, rafraîchit l'écran et pousse sur le cloud, avec une fusion à 3 voies (`mergeMeta` / `mergeMonth` / `mergeList` par `id`) pour les modifications simultanées.
- **Écrire dans un autre de mes comptes** : `txMonth(acc, k, m => …)` (transaction ; `summary` mis à jour), ou `onAcc(acc, k, fn)` qui choisit tout seul entre `mutate` et `txMonth`.
- **Avances** : `updateDebt(e, x => …)`. Il gère les 3 emplacements : compte actif (`mutate`), autre compte (transaction sur `meta`) et `pdebts` (transaction).
- **Nouveau champ de premier niveau dans `S`** : l'ajouter dans `mergeMeta` (`['savings','alerts','goal','sav','cmDef']`), sinon il peut être écrasé.
- Montants : en euros (nombres), arrondis au centime ; en **centimes** (entiers) dans le pointage (`app12`).
- Dates : **ne jamais utiliser `toISOString()` pour « aujourd'hui »** (décalage UTC) → `todayISO()`, `today()` (jour), `nowK()` (mois `AAAA-MM`), `ck()` (mois affiché), `kAdd(k, n)`, `dim(k)`.

---

## 5. Règles de calcul (le cœur métier)

- **`eff(e)`** = ce que la dépense **me coûte** (budgets, catégories, graphiques, historique) : `share` s'il existe, sinon ½ si `isDivided`, sinon `amount`.
- **`cash(e)`** = ce qui **sort vraiment du compte** (solde) : 0 si `nc`, `amount` si `share`, sinon `eff`.
- **`calc(m, k)`** :
  - montants en `cash` : `incAll`, `incIn`, `outAll` / `outPaid` / `outPlan`, `fixAll` / `fixPaid`, `varAll` ;
  - `outMine` (stats) ;
  - `init` (solde au 1er : saisi, ou chaîné depuis le mois précédent par `chainBalance`) ;
  - **`current = init + incIn − outPaid`** ;
  - `est` (fin de mois estimée, avec les dépenses habituelles restantes d'après les 6 derniers mois) ;
  - **`rav`** (reste à vivre = solde + recettes à venir − dépenses à payer − épargne prévue) ;
  - `perDay`.
- **Budgets** : `vspent(m, cat)` = toutes les dépenses de la catégorie **charges fixes comprises** (ex. un virement mensuel « courses » vers le compte joint, classé en *Alimentation*), sauf les virements « simples » entre mes comptes (`xferPlain` : catégorie vide ou *Virement*).
  - Répartition des recettes : `fixOut` (charges fixes **hors** catégories budgétées) + `budEff` (max(budget, dépensé)) + `varOut` (hors budget) + `xferOut` + épargne → `free` (libre).
  - `planned` = `fixOut + budPlan + varOut + xferOut`.
- **Catégories / historique** : `catTotals(m)` (en `eff`), `outMine`.

---

## 6. Fonctionnalités (état v33)

**Base**
- Comptes multiples (courant / épargne), partagés avec invitation (email vérifié).
- Mois : charges fixes et recettes récurrentes via les modèles, budgets, échéancier, solde au 1er saisi ou calculé.
- Recherche, filtres, duplication, devises.
- Alertes : seuil, % de budget, alertes personnalisées, grosses dépenses, retards.
- Messagerie (activité des comptes partagés, demandes), notifications du navigateur (app ouverte seulement).
- Thème Auto / Clair / Sombre, mode simple, PWA installable, sauvegardes quotidiennes, export / import JSON.

**Virements**
- Entre mes comptes : une ligne liée de chaque côté, et la modification se répercute.
- Vers une personne (boîte de réception `transfers`, elle choisit le compte qui reçoit).
- Récurrents : apparaissent en recette fixe sur le compte qui reçoit.
- Catégorisés (ex. virement « courses » → *Alimentation*).

**Épargne**
- Simulateur, objectifs, comptes épargne (accueil dédié).
- **Intérêts** (`app14`) : Livret A / LDDS / LEP / Livret Jeune / PEL / compte rémunéré, calcul par quinzaines (un versement compte à la quinzaine suivante, un retrait dès sa quinzaine), au jour le jour ou en fin de mois, versement annuel ou mensuel (bouton « Ajouter au compte »), plafond, prélèvement de 30 %.
  - Le taux n'est **pas** pré-rempli (il change) : Robin met celui de sa banque.

**Crédits** : mensualité automatique en charge fixe jusqu'à la fin, tableau d'amortissement simplifié.

**Avances / remboursements** (`app10`) :
- **Côtés `lender` / `borrower`** : `{kind:'acc', acc}` | `{kind:'user', uid, email, acc?, accName?}` | `{kind:'text', who}` (ancien format : `to` / `who`).
- **Où l'avance est rangée** : dans le compte qui a avancé (`S.debts`) si tout se passe entre mes comptes ou avec un simple nom ; dans **`pdebts`** si une autre personne est concernée.
- **Compte joint** : `lenderAcc(e)` / `borrowerAcc(e)` donnent **mon** compte concerné. Un compte joint qui a avancé est « à recevoir » **pour ses deux membres**. On ne rembourse jamais avec le compte qui a avancé (`borrowerAcc` l'évite).
- **Paiements** `payments[]` :
  - classiques `{amount, date, label, from, to, toUser, inc, exp, xid, k, by}` : ils créent les mouvements (recette chez le prêteur, dépense ou virement chez l'emprunteur) ;
  - **modifiables sans accord** par celui qui les a saisis (`payEditDialog`) ;
  - **vers une autre personne** (depuis v34) : **plus de virement dans sa boîte `transfers`**. Le paiement porte `pend: 1, at, toAcc` (« J'ai remboursé ») et compte tout de suite dans le reste dû ; l'autre **confirme** (`payConfirm` : choisit le compte, crée la recette, `okAt, inc, ik, to`) ou répond **« Pas reçu »** (`rej {at, by}` : ne compte plus ; celui qui a payé peut « Renvoyer » ou « Supprimer »). Modifié après confirmation → `pend` + `re` (à reconfirmer, la même recette est mise à jour). Un paiement pas encore confirmé se supprime sans demande.
- **Suppression** d'une avance ou d'un paiement partagé : **demande à l'autre** (`reqs`). Choix « garder les mouvements » / « tout supprimer ». « Clôturer » archive (`arch`) dans l'historique, et l'avance peut être rouverte.
- **Remboursement automatique** mensuel (`auto`), exécuté par l'app de celui qui l'a réglé.
- **Rappels** au choix de l'utilisateur : rien depuis N jours / chaque mois le X / avant une date limite.
- **Invitations** (`invite: pending/accepted/declined`) pour les parts envoyées à une personne connectée.

**Partager à plusieurs** (`app11`) : parts égales ou libres, participants = mes comptes, personnes connectées (demande à accepter) ou simples noms. Groupe `grp`, vue « 👥 ».

**Dépenses communes façon Tricount** (`app15`) :
- **Ligne de compensation** dans une avance : `{comp:1, tot, part, half, side:'L'|'B' (qui a payé), amount (+ déduit / − ajouté), v (version), lines {L|B:{id,acc,k,v}}, mk ('both'|'other'|false), nol, ed}`.
- **Lignes de dépense** : `compSync()` crée ou met à jour la ligne de **son** compte (payeur : `amount` + `share` ; l'autre : `nc`). Il est appelé après chaque changement, à chaque mise à jour de `pdebts` et en tâche de fond (`compSyncSoon`). Une transaction réserve la ligne pour éviter les doublons. Les entrées créées en v29 sans lignes sont complétées (`compMigrate`).
- **Fiche d'une dépense › « Dépense commune »** : **Non / Partagée** (juste ½ dans les stats) / **Déduire** (au choix parmi mes dettes en cours) / **Avance** (nouvelle dette liée : un de mes comptes, une personne connectée ou un nom). La part est la moitié par défaut, ou un montant au choix. Tout reste lié : modifier ou supprimer la dépense met à jour la dette.
- **Choix habituel par catégorie** (`S.cmDef`) : retenu à l'enregistrement d'une nouvelle dépense, pré-sélectionné ensuite (y compris quand le libellé choisit la catégorie), « ne plus le proposer ».
- **Bilan par personne** (Budgets) : net de toutes les avances, « Tout solder » = compensation des deux sens sans virement, puis un seul vrai paiement pour le reste.
- **Convertir les anciens « ½ Partagé »** (bouton dans Mouvements ; les virements ne sont pas touchés).

**Charges fixes partagées** (`app16`, v34) : bouton 👥 dans Paramètres › Charges fixes (colonne « Partage ») ou dans la fiche d'une charge fixe › « 👥 Partager cette charge fixe ». La personne connectée reçoit la demande (« À valider » sur l'accueil et dans la messagerie). Si elle accepte, elle choisit le compte d'où part la charge : même nom, montant, jour, catégorie, logo ; si c'était un virement automatique vers un compte dont elle est membre (compte joint), elle a le même virement automatique (recette fixe en face sur le joint). Copie à l'acceptation : une modification ultérieure n'est **pas** répercutée chez l'autre.

**Notifications** (v35) : **vraies notifications même app fermée** (Web Push, iPhone avec l'app sur l'écran d'accueil iOS ≥ 16.4, Android, PC), sans Play Store / App Store.
- Les services push d'Apple / Google refusent les envois directs depuis une page web (pas de CORS) : un **relais Cloudflare Worker gratuit** (`push/worker.js`, compte Cloudflare de Robin, sans carte) les envoie. Il vérifie le jeton Firebase de l'expéditeur (RS256, `aud` = projet), n'accepte que l'origine GitHub Pages et les hôtes des services push, chiffre le message (aes128gcm, RFC 8291) et signe (VAPID ES256). Il ne garde rien.
- **Clé VAPID** : la publique est dans `src/app16.js` (`VAPID_PUB`) ; la **privée n'est que dans la copie collée dans Cloudflare** (jamais dans le dépôt : `push/worker.js` a des marqueurs `__VAPID_PRIVATE__`). Le contact VAPID doit être une vraie URL (Apple renvoie `BadJwtToken` pour un contact fictif).
- `PUSH_URL` (`src/app16.js`) = adresse du relais ; vide → tout est caché.
- Chaque appareil : bouton « 🔔 Activer les notifications » (Paramètres › Profil & app, ou Messagerie) → `pushSetup` range l'abonnement dans `directory/{email}.push` (5 max ; lisible par les personnes connectées ; `publishDir` écrit en `merge`).
- Envoi `pushTo(email, texte)` à chaque demande ou réponse : « J'ai remboursé », confirmé / pas reçu / modifié, charge fixe partagée proposée / acceptée / refusée, part demandée / acceptée / refusée, demande de suppression / réponse. **Jamais de montant** dans le texte.
- `sw.js` : événement `push` → notification + pastille. Quand l'appareil a le push, les notifications locales du navigateur (`notifyLocal`) sont coupées pour éviter les doublons.
- Pastille sur l'icône (`appBadge`).

**Pointage avec le relevé** (`app12`) :
- **Formats lus** : Crédit Agricole (CSV ISO-8859-1 avec en-tête de compte et libellés sur plusieurs lignes, **Excel .xlsx**), Boursorama (CSV), Revolut (CSV, frais inclus, opérations annulées ignorées), OFX, QIF. Sinon, une fenêtre propose de choisir les colonnes.
- **Rapprochement**, dans l'ordre :
  1. même montant au centime, date proche (la date d'achat carte est lue dans le libellé) ;
  2. une ligne de l'app = 2 opérations (payé en 2 fois, ou noté en net) ;
  3. « ½ Partagé » ;
  4. montants presque égaux (devise, frais) ;
  5. opérations qui s'annulent (−22 / +22) ;
  6. **remboursement approximatif** (un virement reçu ≈ 1 à 3 paiements dont au moins un non noté ; écart ≤ 0,50 € seulement si le montant est rond ; « Compter en net »).
- **Début de mois** : si le relevé couvre la fin du mois précédent, l'app retrouve les lignes notées début octobre mais passées fin septembre et calcule le vrai solde au 1er. Sinon, elle cherche la combinaison qui explique l'écart.
- **Paiements carte notés à l'avance** (2 derniers jours du relevé) : « en cours », ce n'est pas une anomalie.
- **Écran en cartes** : proposition + « C'est normal ✓ ». Une fois tout validé : « ✓ Relevé pointé ».
- **Identifiant d'une opération** : `date|centimes|24 premiers caractères alphanumériques du libellé` (`bkHash`, identique en CSV et en Excel). Les anciens identifiants sont normalisés par `hkey`.

**Relevés** (`app13`, écran `releves`, accès Mouvements › « Relevés & pointage ») : dépôt et historique, fusion des relevés qui se chevauchent, état par mois, export CSV, suppression, rappel « dépose ton relevé » jusqu'au 12 du mois.

---

## 7. Tests

- **Lancer** : `python3 src/build.py && cd tests && ./run.sh` (installe `jsdom` au premier lancement). `./run.sh t31` pour un seul.
- **Fonctionnement** : chaque test charge `index.html` dans jsdom avec `fsmock.js` (Auth + Firestore en mémoire **avec les mêmes règles de sécurité**, transactions, écouteurs). Il ouvre plusieurs clients (Robin, Marie / Marion, Paul) qui partagent le même faux serveur, puis vérifie des scénarios (✅ / ❌). Les requêtes réseau sont simulées.
- **Lire le résultat** : un test est OK si aucune ligne `❌` et pas de `CRASH`. Certains tests n'affichent pas « TOUT EST OK » (t6, t7) : c'est normal.
- **Dépendance à la date** : plusieurs tests utilisent le mois en cours (`nowK()`). Si un test casse au changement de mois, vérifie d'abord que ce n'est pas l'attente qui dépend de la date.
- **Couverture par test** :
  - t5–t9 : synchro, comptes partagés, saisie, mode simple ;
  - t10–t14 : virements, épargne, joint, devises ;
  - t15–t17 : avances, connexions, suppression à deux, historique, automatique, rappels ;
  - t18 : partage à plusieurs ;
  - t19, t21* : pointage (fichiers synthétiques, faux positifs) ;
  - t26–t27 : partage avec ses propres comptes et compte joint ;
  - t28 : intérêts ;
  - t29–t32 : dépenses communes, Tricount, choix habituel, bilan, budget avec charges fixes ;
  - t33 : charges fixes partagées, « J'ai remboursé » (confirmer / pas reçu / reconfirmer), pastille ;
  - t34 : vraies notifications (abonnement, envoi au relais, textes sans montant). Le relais lui-même a été testé à part (chiffrement déchiffré par `http_ece`, signature VAPID, jetons refusés, Apple accepte la signature).
- **Tests retirés de ce dépôt** : ceux basés sur les **vrais relevés de Robin**, pour ne pas publier ses données bancaires. t14 utilise `tests/fixtures/joint-demo.json` (fictif).
- **Contrôle visuel** : rendre la page à 390 × 844 px (Playwright / Chromium) pour vérifier l'affichage téléphone. Les noms longs doivent passer à la ligne, pas être coupés.

---

## 8. Pièges connus (déjà rencontrés)

- `toISOString()` donne la date de la veille le soir (UTC) → utiliser `todayISO()`.
- Juste après `updateDebt`, `ACC[...].meta` peut être en retard d'un cycle : ne pas relire les données synchronisées dans une boucle. Voir `autoRun` (réserve l'échéance, puis avance localement).
- Une boîte de dialogue `askDeleteMode` attend un clic : dans un test, ne pas faire `await` dessus avant d'avoir cliqué.
- **Ancien « ½ Partagé » (`isDivided`)** : compte la moitié **dans le solde**, et c'est source d'écarts avec la banque. Le nouveau « Partagée » (`share`) garde le montant entier dans le solde.
- Comptes **épargne** : pas d'écran Budgets, donc pas de carte Remboursements.
- `formDialog` : `intro` et `title` sont insérés en HTML brut → **échapper** (`esc`) les textes venant des données.
- Le remboursement approximatif était trop permissif (70 % de faux positifs) : resserré (7 jours après les paiements, 2 jours d'écart entre eux, montant rond, 0,50 € max). Testé sur 600 mois aléatoires (t21*).
- Firebase compat : `FieldValue`, `runTransaction`, `onSnapshot` ; les règles imposent `members` inchangés à la mise à jour d'un `pdebt`.

---

## 9. Historique des versions (résumé)

- **v1–v10** : app de base, multi-comptes, comptes joints, logos, épargne, virements entre comptes et vers une personne, PWA, thème, mode simple, nom « Suivi dépenses » (logo tirelire bleue), devises, objectifs, crédits, réorganisation des écrans.
- **v11–v15** : avances / remboursements, connexions entre utilisateurs, avances partagées, suppression à deux.
- **v16** : historique des avances, remboursement automatique, rappels.
- **v17** : partager une dépense à plusieurs (demandes à accepter).
- **v18–v25** : pointage avec le relevé (CSV / OFX / QIF puis Excel), cas réels rencontrés sur ses relevés, validation par cartes, relevés gardés en historique.
- **v26–v27** : partage avec ses propres comptes ; compte joint vu à l'identique par ses 2 membres.
- **v28** : intérêts des comptes épargne.
- **v29–v32** : dépenses communes façon Tricount (compensation), lignes dans les 2 comptes, modification sans accord, montant réel sur le compte et ma part dans les stats, choix Non / Partagée / Déduire / Avance dans la fiche dépense.
- **v35** : vraies notifications même app fermée, via un relais Cloudflare gratuit.
- **v34** : charges fixes partagées (demande à accepter, même charge fixe chez l'autre), « J'ai remboursé » à confirmer par celui qui reçoit (remplace le virement automatique dans sa boîte), carte « À valider » sur l'accueil, pastille sur l'icône de l'app.
- **v33** : charges fixes comptées dans le budget de leur catégorie (virement « courses » → Alimentation, répartition corrigée), choix habituel par catégorie, bilan par personne + « Tout solder », conversion des anciens « ½ Partagé ».

---

## 10. Idées en attente / pistes proposées à Robin

- Répercuter chez l'autre une modification d'une charge fixe partagée (montant qui change), ou l'arrêter des deux côtés.
- Refusé par Robin : « relancer quelqu'un » (il ne veut pas que l'app devienne une messagerie).
- Inviter par email une personne non connectée (sa part devient une demande quand elle accepte).
- Export / récap de l'historique des avances (CSV / PDF).
- Partage d'une dépense quand **l'autre** a payé directement depuis la fiche dépense (aujourd'hui : bouton « ↔ Dépense commune » de l'avance).
- Limites assumées : pas d'import bancaire automatique (agrégateur payant), taux du Livret A à saisir.
