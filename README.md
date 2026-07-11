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
├── .env.example        # ← COPIE PARA .env E PREENCHA A CHAVE
├── requirements.txt
└── README.md
```

---

## Configuração do .env  ← COMECE AQUI

1. Copie o arquivo `.env.example` e renomeie para `.env`
2. Abra o `.env` e preencha sua chave do TMDB:

```env
TMDB_API_KEY=sua_chave_aqui
```

**Como obter a chave TMDB (gratuita):**
1. Crie uma conta em https://www.themoviedb.org
2. Vá em Configurações → API → Criar → Uso pessoal
3. Copie a chave "API Key (v3 auth)"

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
## ativar ambiente virtual

.\venv\Scripts\Activate.ps1

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
wubba