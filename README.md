# Trouvix Grille

Jeu de grille multijoueur (local + en ligne) — Next.js + Socket.IO.

---

## Démarrage local (2 services)

Le jeu en ligne a besoin de **deux services en parallèle** :

| Service | Port | Commande |
| ------- | ---- | -------- |
| Game-service (Socket.IO + logique serveur) | **3003** | `npm run dev:game` |
| Front Next.js | **9999** | `npm run dev` |

Le front pointe vers le game-service local via `.env.local`
(`NEXT_PUBLIC_GAME_SERVICE_URL=http://localhost:3003`).

### Lancer les deux dans **deux terminaux séparés**

**Terminal 1 — le game-service (port 3003) :**

```powershell
npm run dev:game
```

**Terminal 2 — le front Next (port 9999) :**

```powershell
npm run dev
```

Puis ouvrir : **http://localhost:9999**

> ⚠️ **Important :** si seul `npm run dev` est lancé et que le game-service (3003)
> ne tourne pas, la connexion au salon en ligne tourne en boucle. Il faut
> toujours démarrer `npm run dev:game` **en premier**.

### Lancer les deux depuis **un seul terminal PowerShell**

```powershell
Start-Process powershell -ArgumentList 'npm run dev:game'; npm run dev
```

Ou en arrière-plan (les deux dans la même fenêtre) :

```powershell
Start-Job { npm run dev:game }; npm run dev
```

## Autres commandes

| Commande | Description |
| -------- | ----------- |
| `npm run lint` | Vérifie le code avec ESLint |
| `npm run build` | Build de production |
| `npm run start` | Démarre le build de production (port 9999) |
| `npm run db:push` | Applique le schéma Prisma à la base |

## Déploiement

Voir [DEPLOY.md](./DEPLOY.md).
