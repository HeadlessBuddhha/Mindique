"""
seed.py — Busca títulos dinamicamente do TMDB e popula o banco SQLite.

Como usar:
  1. Copie .env.example para .env na raiz do projeto
  2. Preencha TMDB_API_KEY com sua chave (themoviedb.org/settings/api)
  3. Execute: python backend/seed.py [quantidade]

Exemplos:
  python backend/seed.py          # busca 200 títulos (padrão)
  python backend/seed.py 500      # busca 500 títulos
  python backend/seed.py 50       # busca 50 títulos (teste rápido)
"""

import sys
import os
import time
from pathlib import Path

# Garante que a raiz do projeto está no path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Carrega o .env da raiz do projeto
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

import requests
from backend.database import engine, SessionLocal
from backend.models import Base, Movie

# ── Configuração ─────────────────────────────────────────────────
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
TMDB_BASE    = "https://api.themoviedb.org/3"
POSTER_BASE  = "https://image.tmdb.org/t/p/w500"

# Mapeamento de ID de gênero TMDB → nome
GENRE_MAP = {
    28:"Action", 12:"Adventure", 16:"Animation", 35:"Comedy", 80:"Crime",
    99:"Documentary", 18:"Drama", 10751:"Family", 14:"Fantasy", 36:"History",
    27:"Horror", 10402:"Music", 9648:"Mystery", 10749:"Romance", 878:"Sci-Fi",
    53:"Thriller", 10752:"War", 37:"Western", 10759:"Action & Adventure",
    10762:"Kids", 10763:"News", 10764:"Reality", 10765:"Sci-Fi & Fantasy",
    10766:"Soap", 10767:"Talk", 10768:"War & Politics",
}

# Quantas páginas buscar por categoria (20 títulos por página no TMDB)
DEFAULT_TOTAL = int(sys.argv[1]) if len(sys.argv) > 1 else 200


# ── Helpers de API ────────────────────────────────────────────────
def tmdb_get(path: str, params: dict = {}) -> dict:
    """Faz GET na API do TMDB com retry simples."""
    params["api_key"]  = TMDB_API_KEY
    params["language"] = "pt-BR"
    for attempt in range(3):
        try:
            r = requests.get(f"{TMDB_BASE}{path}", params=params, timeout=10)
            if r.status_code == 429:          # rate limit
                time.sleep(2)
                continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            if attempt == 2:
                raise
            time.sleep(1)
    return {}


def fetch_credits(tmdb_id: int, media_type: str):
    """Retorna (atores, diretores) como strings separadas por vírgula."""
    try:
        endpoint = f"/{media_type}/{tmdb_id}/credits"
        data     = tmdb_get(endpoint)
        cast     = data.get("cast", [])
        crew     = data.get("crew", [])

        actors    = ",".join(p["name"] for p in cast[:5])
        directors = ",".join(
            p["name"] for p in crew
            if p.get("job") in ("Director", "Series Director", "Executive Producer")
        )[:3 * 40]          # limita tamanho

        # Para séries, 'created_by' é mais preciso
        if media_type == "tv":
            created = data.get("created_by", [])
            if created:
                directors = ",".join(p["name"] for p in created[:3])

        return actors or None, directors or None
    except Exception:
        return None, None


def parse_genres(genre_ids: list) -> str:
    return ",".join(GENRE_MAP.get(gid, str(gid)) for gid in genre_ids[:4])


def fetch_pages(media_type: str, endpoint: str, max_items: int) -> list:
    """Busca até max_items títulos de um endpoint paginado do TMDB."""
    items   = []
    page    = 1
    fetched = 0

    while fetched < max_items:
        data    = tmdb_get(endpoint, {"page": page})
        results = data.get("results", [])
        if not results:
            break

        for item in results:
            if fetched >= max_items:
                break

            # Campos comuns
            tmdb_id    = item.get("id")
            poster     = item.get("poster_path")
            genre_ids  = item.get("genre_ids", [])
            rating     = round(item.get("vote_average", 0), 1)
            votes      = item.get("vote_count", 0)

            if media_type == "movie":
                title    = item.get("title") or item.get("original_title", "")
                year_raw = item.get("release_date", "")
                runtime  = None      # buscado separado se necessário
                imdb_type = "movie"
            else:
                title    = item.get("name") or item.get("original_name", "")
                year_raw = item.get("first_air_date", "")
                runtime  = item.get("episode_run_time", [None])[0] if item.get("episode_run_time") else None
                imdb_type = "tvSeries"

            year = int(year_raw[:4]) if year_raw and len(year_raw) >= 4 else None

            if not title or rating < 1:
                continue

            # tconst sintético único (TMDB não tem tconst IMDb nativo)
            tconst = f"tmdb_{media_type}_{tmdb_id}"

            actors, directors = fetch_credits(tmdb_id, media_type)

            items.append({
                "tconst":     tconst,
                "title":      title,
                "type":       imdb_type,
                "year":       year,
                "genres":     parse_genres(genre_ids),
                "rating":     rating,
                "votes":      votes,
                "runtime":    runtime,
                "actors":     actors,
                "directors":  directors,
                "poster_url": f"{POSTER_BASE}{poster}" if poster else None,
            })
            fetched += 1

        page += 1
        if page > data.get("total_pages", 1):
            break
        time.sleep(0.25)   # respeita rate limit do TMDB (40 req/s)

    return items


# ── Seed principal ────────────────────────────────────────────────
def seed(total: int = DEFAULT_TOTAL):
    if not TMDB_API_KEY or TMDB_API_KEY == "sua_chave_aqui":
        print("❌  TMDB_API_KEY não configurada!")
        print("    1. Copie .env.example para .env na raiz do projeto")
        print("    2. Preencha TMDB_API_KEY com sua chave de https://www.themoviedb.org/settings/api")
        sys.exit(1)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    existing = db.query(Movie).count()
    if existing > 0:
        print(f"ℹ️  Banco já contém {existing} títulos.")
        resp = input("   Deseja adicionar mais títulos? (s/N): ").strip().lower()
        if resp != "s":
            db.close()
            return

    # Divide igualmente entre filmes e séries
    half      = total // 2
    remainder = total - half

    print(f"\n🎬  Buscando {remainder} filmes e {half} séries no TMDB...")
    print("    (isso pode levar alguns minutos dependendo da quantidade)\n")

    # Endpoints de filmes
    movie_endpoints = [
        ("/movie/popular",    remainder // 3),
        ("/movie/top_rated",  remainder // 3),
        ("/movie/now_playing", remainder - 2 * (remainder // 3)),
    ]

    # Endpoints de séries
    tv_endpoints = [
        ("/tv/popular",    half // 3),
        ("/tv/top_rated",  half // 3),
        ("/tv/on_the_air", half - 2 * (half // 3)),
    ]

    all_items  = []
    seen_ids   = set()

    for endpoint, limit in movie_endpoints + tv_endpoints:
        mtype = "movie" if "/movie/" in endpoint else "tv"
        print(f"  ↳ {endpoint}  (até {limit} títulos)...")
        try:
            items = fetch_pages(mtype, endpoint, limit)
            for item in items:
                if item["tconst"] not in seen_ids:
                    seen_ids.add(item["tconst"])
                    all_items.append(item)
        except Exception as e:
            print(f"     ⚠️  Erro: {e}")

    # Insere no banco
    inserted = 0
    skipped  = 0
    try:
        for data in all_items:
            if db.query(Movie).filter(Movie.tconst == data["tconst"]).first():
                skipped += 1
                continue
            db.add(Movie(**data))
            inserted += 1

        db.commit()
        print(f"\n✅  Concluído! {inserted} títulos inseridos, {skipped} já existiam.")
        print(f"    Total no banco: {db.query(Movie).count()} títulos.\n")
    except Exception as e:
        db.rollback()
        print(f"\n❌  Erro ao salvar: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
