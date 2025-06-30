# 🚀 Système de Cache Redis pour Q&A

Ce document explique comment configurer et utiliser le système de cache Redis pour optimiser les performances des réponses Q&A.

## 📋 Vue d'ensemble

Le système de cache Redis améliore considérablement les performances en stockant les réponses Q&A pendant 24 heures. Lorsqu'une question identique est posée sur le même document avec les mêmes paramètres, la réponse est servie directement depuis le cache.

### 🎯 Avantages

- **Performance**: Réponses instantanées pour les questions répétées
- **Économie**: Réduction des appels API OpenAI GPT-4o
- **Scalabilité**: Meilleure gestion de la charge utilisateur
- **UX**: Amélioration de l'expérience utilisateur

## 📦 Installation

### 1. Installer Redis

#### Sur macOS (avec Homebrew)
```bash
brew install redis
brew services start redis
```

#### Sur Ubuntu/Debian
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

#### Via Docker
```bash
docker run -d --name redis -p 6379:6379 redis:latest
```

### 2. Installer la dépendance Python

La dépendance `redis==5.0.1` est déjà incluse dans `requirements.txt`.

```bash
pip install -r requirements.txt
```

## ⚙️ Configuration

### Variables d'environnement

Créez un fichier `.env` dans le répertoire `backend/` :

```env
# Configuration Redis (optionnel - valeurs par défaut)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Démarrage automatique

Le système de cache se connecte automatiquement à Redis au démarrage de l'application. Si Redis n'est pas disponible, l'application continue de fonctionner normalement sans cache.

## 🔑 Génération des clés de cache

Les clés de cache sont générées avec un hash SHA256 basé sur :
- `document_id`
- `question` (normalisée en minuscules)
- `similarity_threshold`
- `chunks_limit`
- `model` d'embedding
- `generate_answer` (booléen)

**Format de clé**: `qa:cache:{hash_sha256}`

**Exemple**: `qa:cache:a1b2c3d4e5f6...`

## 📊 Utilisation

### Cache automatique

Le cache fonctionne de manière transparente :

1. **Cache HIT**: Si la réponse existe → retour immédiat
2. **Cache MISS**: Si pas de cache → traitement + mise en cache
3. **TTL**: Expiration automatique après 24 heures

### Identification des réponses cachées

Les réponses contiennent un champ `from_cache` :
```json
{
  "document_id": 123,
  "question": "Quels sont les matériaux ?",
  "answer": "Les matériaux sont...",
  "from_cache": true,  // ← Indique si vient du cache
  "processing_time_ms": 15
}
```

## 🛠️ Endpoints de gestion

### Statistiques du cache
```http
GET /qa/cache/stats
```

Retourne :
```json
{
  "available": true,
  "qa_cache_entries": 42,
  "redis_version": "7.0.0",
  "memory_used": "1.2M",
  "hit_rate": 73.5
}
```

### Invalider le cache d'un document
```http
DELETE /qa/cache/document/{document_id}
```

Supprime toutes les entrées de cache pour un document spécifique.

### Vider tout le cache Q&A
```http
DELETE /qa/cache/clear
```

⚠️ **Attention**: Action irréversible qui supprime tout le cache Q&A.

## 🔍 Monitoring et debug

### Logs du cache

Le système produit des logs détaillés :

```
✅ Redis connecté sur localhost:6379
🎯 Cache HIT pour la question: Quels sont les matériaux néces...
💾 Réponse mise en cache (TTL: 86400s) pour: Comment dimensionner les...
```

### Vérification de la connectivité Redis

```bash
# Tester la connexion Redis
redis-cli ping
# Retour attendu: PONG

# Voir les clés de cache Q&A
redis-cli keys "qa:cache:*"

# Voir les statistiques Redis
redis-cli info
```

### Performance monitoring

L'endpoint `/qa/stats` inclut maintenant les métriques du cache :

```json
{
  "cache_system": {
    "available": true,
    "qa_cache_entries": 156,
    "hit_rate": 68.2,
    "memory_used": "2.4M"
  }
}
```

## 🔧 Optimisation

### Configuration Redis recommandée

Pour une utilisation en production, ajoutez dans `/etc/redis/redis.conf` :

```conf
# Optimisation pour le cache Q&A
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### Monitoring Redis

Utilisez Redis Insight ou des outils comme :
- `redis-cli --latency-history`
- `redis-cli --stat`
- Prometheus + Grafana pour les métriques

## 🚨 Dépannage

### Redis non disponible

Si Redis n'est pas accessible :
```
⚠️ Redis non disponible: Connection refused
```

**Solutions**:
1. Vérifier que Redis est démarré : `redis-cli ping`
2. Vérifier les variables d'environnement
3. Vérifier les permissions réseau/firewall

### Problèmes de sérialisation

Si des erreurs de JSON apparaissent :
```
⚠️ Erreur lecture cache: Expecting value: line 1 column 1 (char 0)
```

**Solutions**:
1. Vider le cache : `DELETE /qa/cache/clear`
2. Redémarrer Redis : `redis-cli flushdb`

### Performance dégradée

Si le cache semble lent :
1. Vérifier la latence : `redis-cli --latency`
2. Vérifier la mémoire : `redis-cli info memory`
3. Considérer l'augmentation de `maxmemory`

## 📈 Métriques de performance

Avec le cache activé, vous devriez observer :

- **Temps de réponse** : 10-50ms pour les cache HITs vs 2-10s pour les nouvelles questions
- **Taux de cache HIT** : 60-80% selon l'usage répétitif
- **Réduction des coûts OpenAI** : Proportionnelle au taux de HIT

## 🔐 Sécurité

### Données sensibles

Le cache stocke :
- ✅ Questions et réponses (texte uniquement)
- ✅ Métadonnées des chunks
- ❌ Pas de tokens d'authentification
- ❌ Pas de données utilisateur sensibles

### Isolation

Chaque question est liée à un `document_id` spécifique, garantissant l'isolation des données entre utilisateurs.

## 🎛️ Configuration avancée

### TTL personnalisé

Modifier le TTL par défaut dans `cache_service.py` :

```python
class RedisCache:
    def __init__(self):
        self.default_ttl = 24 * 60 * 60  # 24 heures
```

### Préfixe des clés

Personnaliser le préfixe pour éviter les conflits :

```python
self.cache_prefix = "myapp:qa:cache:"
```

### Politique d'éviction

Recommandations selon l'usage :
- **LRU** (par défaut) : Éviction des moins récemment utilisées
- **TTL** : Éviction basée sur l'expiration
- **Random** : Éviction aléatoire

---

## 📞 Support

En cas de problème :
1. Vérifier les logs de l'application
2. Tester la connectivité Redis
3. Consulter les métriques de performance
4. Vider le cache si nécessaire

Le système de cache est conçu pour être **fault-tolerant** : si Redis n'est pas disponible, l'application continue de fonctionner normalement sans cache. 