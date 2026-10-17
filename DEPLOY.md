# Déploiement de Trouvix Grille

Le site Next.js reste sur Vercel. Le serveur de parties en ligne est porté sur Cloudflare Workers et Durable Objects, avec WebSockets natifs. Le mode local contre l’IA reste côté navigateur.

## Déployer le serveur Cloudflare

Prérequis : un compte Cloudflare gratuit et Node.js/npm sur le PC.

1. Ouvre un terminal dans le dossier du projet.
2. Lance `npx wrangler login` et autorise Wrangler dans le navigateur.
3. Déploie avec `npm run deploy:game:cloudflare`.
4. Dans le tableau de bord Cloudflare, vérifie que le Worker `trouvix-game-service` est actif.
5. Vérifie son URL : `https://trouvix-game-service.trouvix-grille.workers.dev/health` doit répondre avec `"status":"ok"`.
6. Si tu utilises le mode Benchou Ferrari, configure le secret : `npx wrangler secret put BENCHOU_PIN`, puis redéploie.

Wrangler crée le namespace SQLite du Durable Object lors du premier déploiement. Les salons et défis sont sauvegardés dans ce stockage; les connexions WebSocket reprennent leurs associations après une hibernation. Les chronomètres de tour, animations de résolution et expirations de salon sont déclenchés par des alarmes ponctuelles, et le navigateur anime le décompte entre les mises à jour serveur. Après un déploiement, les connexions peuvent être coupées; le client se reconnecte et rejoint de nouveau son salon.

## Raccorder Vercel

Dans **Vercel > projet Trouvix > Settings > Environment Variables**, définis `NEXT_PUBLIC_GAME_SERVICE_URL` sur `https://trouvix-game-service.trouvix-grille.workers.dev`. Ne mets ni `/health` ni `/ws` à la fin. Redéploie le front pour appliquer la variable.

Le client en production utilise le WebSocket natif `/ws`. En développement local, il continue d’utiliser Socket.IO via `npm run dev:game`.

Garde Render actif jusqu’à avoir vérifié deux navigateurs, la création et la reprise d’un salon, les WebSockets, les réactions et le talkie-walkie. Si tu dois revenir en arrière, remets l’ancienne URL Render dans Vercel et redéploie le front.

## Offre gratuite et limites

Cloudflare ne facture pas le transfert sortant ni le débit au Go. L’offre gratuite conserve toutefois des quotas : 100 000 requêtes par jour pour Workers et Durable Objects, 13 000 GB-s de durée et 100 000 lignes écrites par jour pour le stockage SQLite des Durable Objects, avec 5 GB de stockage total. En cas de dépassement, les opérations du quota concerné échouent jusqu’à sa remise à zéro; elles ne basculent pas automatiquement vers une facture à l’usage. Vérifie l’usage réel dans le tableau de bord Cloudflare avant d’ouvrir le site au public.

## Retour au développement local

Dans deux terminaux :

```powershell
npm run dev:game
npm run dev
```
