# 🚀 Déploiement de Trouvix Grille

Ce guide vous explique comment déployer le jeu sur internet pour que tout le monde puisse y jouer.

## Architecture

```
Vercel (gratuit)              Railway (gratuit)
┌─────────────────────┐       ┌────────────────────────┐
│  Frontend Next.js   │ WSS   │  Game Service Socket.io │
│  • Design + UI      │──────▶│  • Salles en ligne      │
│  • Mode local (IA)  │       │  • Timer serveur        │
│  • Mode connecté    │       │  • Challenges Benchou   │
└─────────────────────┘       └────────────────────────┘
   trouvix.vercel.app            trouvix-game.up.railway.app
```

- **Vercel** héberge le site web (visible par tout le monde)
- **Railway** héberge le serveur de jeu (mode connecté temps réel)

---

## Étape 1 : Déployer le Game Service sur Railway

### 1.1 Créer un compte Railway
1. Allez sur https://railway.app
2. Connectez-vous avec GitHub (ou créez un compte)

### 1.2 Déployer le game-service
1. Cliquez **"New Project"**
2. Choisissez **"Deploy from GitHub repo"**
3. Sélectionnez votre dépôt GitHub contenant le projet Trouvix
4. Dans **"Root Directory"**, choisissez `mini-services/game-service`
5. Railway détecte automatiquement Bun et installe les dépendances
6. Le service démarre avec `bun index.ts`

### 1.3 Configurer les variables d'environnement
Dans Railway > votre service > **Variables** :
```
BENCHOU_PIN=331991    (ou votre code PIN secret personnalisé)
```
Le PORT est automatiquement défini par Railway.

### 1.4 Récupérer l'URL publique
Railway vous donne une URL comme :
```
https://trouvix-game.up.railway.app
```
Notez cette URL — vous en aurez besoin pour Vercel.

### 1.5 Vérifier que le service fonctionne
Ouvrez l'URL dans votre navigateur. Vous devriez voir :
```
{"code":0,"message":"..."}
```
(C'est normal — Socket.io répond en HTTP)

---

## Étape 2 : Déployer le Frontend sur Vercel

### 2.1 Créer un compte Vercel
1. Allez sur https://vercel.com
2. Connectez-vous avec GitHub

### 2.2 Importer le projet
1. Cliquez **"Add New"** > **"Project"**
2. Sélectionnez votre dépôt GitHub
3. Vercel détecte automatiquement Next.js

### 2.3 Configurer les variables d'environnement
Dans **"Environment Variables"**, ajoutez :
```
NEXT_PUBLIC_GAME_SERVICE_URL = https://trouvix-game.up.railway.app
```
(Remplacez par votre URL Railway de l'étape 1.4)

### 2.4 Déployer
1. Cliquez **"Deploy"**
2. Attendez ~2 minutes
3. Votre jeu est en ligne sur `https://trouvix.vercel.app` 🎉

---

## Étape 3 : Vérifier que tout fonctionne

1. Ouvrez votre URL Vercel
2. Testez le **mode local** (vs IA) — doit marcher immédiatement
3. Testez le **mode en ligne** :
   - Créez un salon
   - Ouvrez l'URL dans un autre onglet/navigateur
   - Rejoignez le salon avec le code
   - Lancez la partie — la grille doit se synchroniser en temps réel
4. Testez **Benchou Ferrari** :
   - Cliquez "Jouer avec Benchou Ferrari"
   - Dans un autre onglet, cliquez "Je suis Benchou Ferrari" + PIN
   - Acceptez le défi

---

## Étape 4 : Sécuriser le PIN Benchou Ferrari (recommandé)

En production, changez le PIN par défaut :
1. Dans Railway > Variables : `BENCHOU_PIN=votre_nouveau_code`
2. Le code `331991` par défaut ne sera plus utilisé

---

## FAQ

### Le mode local fonctionne-t-il sans Railway ?
**Oui.** Le mode local (vs IA) est 100% côté client. Il fonctionne même sans game-service.

### Que se passe-t-il si Railway est en maintenance ?
Le mode local continue de fonctionner. Le mode en ligne affichera "Hors ligne" et se reconnectera automatiquement quand Railway revient.

### Combien ça coûte ?
- **Vercel** : plan gratuit suffisant (100GB bande passante/mois)
- **Railway** : plan gratuit (500 heures/mois) ou $5/mois pour un service toujours actif

### Puis-je utiliser un autre hébergeur que Railway ?
Oui. Le game-service est un projet Bun standard. Alternatives :
- **Render** : https://render.com (plan gratuit avec limites)
- **Fly.io** : https://fly.io (gratuit, supporte WebSockets)
- Le Dockerfile est inclus pour n'importe quel hébergeur Docker

### Comment mettre à jour le jeu ?
1. Poussez votre code sur GitHub
2. Vercel redéploie automatiquement le frontend
3. Railway redéploie automatiquement le game-service
