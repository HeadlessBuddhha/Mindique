# 🎬 Mindique — Sistema de Recomendação de Filmes e Séries

## Estrutura do Projeto

```
movie-recommender/
├── backend/
│   ├── main.py         # FastAPI app principal
│   ├── database.py     # Conexão SQLite (lê .env)
│   ├── models.py       # Tabelas: Movie, User, Preference, Favorite
│   ├── schemas.py      # Schemas Pydantic
│   ├── endpoints.py    # Endpoints da API
│   └── seed.py         # Popula o banco via TMDB API
├── frontend/
│   └── index.html      # SPA (Tailwind CDN + Vanilla JS)
├├── requirements.txt
└── README.md
```

---
## Como Rodar

### 1. Instalar dependências
```bash
pip install -r requirements.txt
```

### 2. Popular o banco via TMDB
```bash
python backend/seed.py          # 200 títulos (padrão)
python backend/seed.py 500      # 500 títulos
python backend/seed.py 50       # 50 títulos (teste rápido)
```

### 3. Iniciar o servidor
```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 4. Acessar no navegador
```
http://127.0.0.1:8000
```

---

## Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET  | `/api/user/check`       | Verifica se usuário tem perfil |
| POST | `/api/user/survey`      | Salva preferências do survey |
| GET  | `/api/movies/explore`   | Filmes filtrados por perfil |
| GET  | `/api/movies/lucky`     | Uma recomendação aleatória ponderada |
| GET  | `/api/movies/mood`      | Filmes por estado de humor |
| GET  | `/api/movies/favorites` | Favoritos do usuário |
| POST | `/api/movies/favorite`  | Adiciona/remove favorito |

Documentação interativa: `http://127.0.0.1:8000/docs`
