# 🎬 Mindique — Sistema de Recomendação de Filmes e Séries

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

Documentação interativa: `http://127.0.0.1:8000/docs`
