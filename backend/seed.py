"""
seed.py — Busca títulos do TMDB e popula o banco SQLite.
Inclui plataformas de streaming disponíveis no Brasil.

Uso:
  python backend/seed.py          # 200 títulos (padrão)
  python backend/seed.py 500
  python backend/seed.py 50       # teste rápido
"""

import sys
import os
import time
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

import requests
from backend.database import engine, SessionLocal
from backend.models import Base, Movie

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")
TMDB_BASE    = "https://api.themoviedb.org/3"
POSTER_BASE  = "https://image.tmdb.org/t/p/w500"

GENRE_MAP = {
    28:"Action", 12:"Adventure", 16:"Animation", 35:"Comedy", 80:"Crime",
    99:"Documentary", 18:"Drama", 10751:"Family", 14:"Fantasy", 36:"History",
    27:"Horror", 10402:"Music", 9648:"Mystery", 10749:"Romance", 878:"Sci-Fi",
    53:"Thriller", 10752:"War", 37:"Western", 10759:"Action", 10765:"Sci-Fi",
    10762:"Family", 10768:"War", 10764:"Reality", 10766:"Drama", 36:"History",
    10749:"Romance", 9648:"Mystery",
}

# Nomes normalizados de provedores TMDB → nome exibido no app
PROVIDER_NAME_MAP = {
    "Netflix":                  "Netflix",
    "Amazon Prime Video":       "Prime Video",
    "Amazon Video":             "Prime Video",
    "Disney Plus":              "Disney+",
    "Disney+":                  "Disney+",
    "HBO Max":                  "Max",
    "Max":                      "Max",
    "Apple TV Plus":            "Apple TV+",
    "Apple TV+":                "Apple TV+",
    "Paramount Plus":           "Paramount+",
    "Paramount+":               "Paramount+",
    "Globoplay":                "Globoplay",
    "Mubi":                     "Mubi",
    "Telecine Play":            "Telecine",
    "Claro video":              "Claro",
    "Star Plus":                "Star+",
    "Star+":                    "Star+",
    "Crunchyroll":              "Crunchyroll",
}

DEFAULT_TOTAL = int(sys.argv[1]) if len(sys.argv) > 1 else 200


def tmdb_get(path: str, params: dict = {}) -> dict:
    params["api_key"]  = TMDB_API_KEY
    params["language"] = "pt-BR"
    for attempt in range(3):
        try:
            r = requests.get(f"{TMDB_BASE}{path}", params=params, timeout=10)
            if r.status_code == 429:
                time.sleep(2)
                continue
            r.raise_for_status()
            return r.json()
        except requests.RequestException:
            if attempt == 2:
                raise
            time.sleep(1)
    return {}


def fetch_providers(tmdb_id: int, media_type: str) -> Optional[str]:
    """Busca plataformas disponíveis no Brasil."""
    try:
        data    = tmdb_get(f"/{media_type}/{tmdb_id}/watch/providers")
        br_data = data.get("results", {}).get("BR", {})
        # flatrate = streaming por assinatura
        providers = br_data.get("flatrate", [])
        names = []
        for p in providers:
            raw  = p.get("provider_name", "")
            norm = PROVIDER_NAME_MAP.get(raw, raw)
            if norm not in names:
                names.append(norm)
        return ",".join(names) if names else None
    except Exception:
        return None


def fetch_credits(tmdb_id: int, media_type: str):
    try:
        data      = tmdb_get(f"/{media_type}/{tmdb_id}/credits")
        cast      = data.get("cast", [])
        crew      = data.get("crew", [])
        actors    = ",".join(p["name"] for p in cast[:5])
        directors = ",".join(p["name"] for p in crew if p.get("job") == "Director")[:120]
        if media_type == "tv":
            created = data.get("created_by", [])
            if created:
                directors = ",".join(p["name"] for p in created[:3])
        return actors or None, directors or None
    except Exception:
        return None, None


def parse_genres(genre_ids: list) -> str:
    seen = []
    for gid in genre_ids[:4]:
        name = GENRE_MAP.get(gid)
        if name and name not in seen:
            seen.append(name)
    return ",".join(seen)


def fetch_pages(media_type: str, endpoint: str, max_items: int) -> list:
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

            tmdb_id   = item.get("id")
            poster    = item.get("poster_path")
            genre_ids = item.get("genre_ids", [])
            rating    = round(item.get("vote_average", 0), 1)
            votes     = item.get("vote_count", 0)

            if media_type == "movie":
                title     = item.get("title") or item.get("original_title", "")
                year_raw  = item.get("release_date", "")
                runtime   = None
                imdb_type = "movie"
            else:
                title     = item.get("name") or item.get("original_name", "")
                year_raw  = item.get("first_air_date", "")
                runtime   = (item.get("episode_run_time") or [None])[0]
                imdb_type = "tvSeries"

            year = int(year_raw[:4]) if year_raw and len(year_raw) >= 4 else None
            if not title or rating < 1:
                continue

            tconst = f"tmdb_{media_type}_{tmdb_id}"

            actors, directors = fetch_credits(tmdb_id, media_type)
            platforms         = fetch_providers(tmdb_id, media_type)

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
                "platforms":  platforms,
            })
            fetched += 1

        page += 1
        if page > data.get("total_pages", 1):
            break
        time.sleep(0.25)

    return items


def seed(total: int = DEFAULT_TOTAL):
    if not TMDB_API_KEY or TMDB_API_KEY == "sua_chave_aqui":
        print("❌  TMDB_API_KEY não configurada!")
        print("    Configure o arquivo .env na raiz do projeto.")
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

    half      = total // 2
    remainder = total - half

    print(f"\n🎬  Buscando {remainder} filmes e {half} séries no TMDB...")
    print("    (isso pode levar alguns minutos)\n")

    movie_endpoints = [
        ("/movie/popular",     remainder // 3),
        ("/movie/top_rated",   remainder // 3),
        ("/movie/now_playing", remainder - 2 * (remainder // 3)),
    ]
    tv_endpoints = [
        ("/tv/popular",    half // 3),
        ("/tv/top_rated",  half // 3),
        ("/tv/on_the_air", half - 2 * (half // 3)),
    ]

    all_items = []
    seen_ids  = set()

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
        print(f"\n✅  {inserted} títulos inseridos, {skipped} já existiam.")
        print(f"    Total no banco: {db.query(Movie).count()} títulos.\n")
    except Exception as e:
        db.rollback()
        print(f"\n❌  Erro: {e}")
        raise
    finally:
        db.close()


# corrige o Optional que faltou no import
from typing import Optional

if __name__ == "__main__":
    seed()
