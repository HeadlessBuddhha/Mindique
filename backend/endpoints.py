from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
import random

from backend.database import get_db
from backend.models import Movie, User, Preference, Favorite
from backend.schemas import SurveyPayload, FavoritePayload, MovieOut, UserCheckResponse

router = APIRouter()

# Mood → géneros (completamente independente do perfil do usuário)
MOOD_GENRE_MAP = {
    "light":    ["Comedy", "Animation", "Family", "Romance"],
    "tense":    ["Thriller", "Mystery", "Crime", "Horror"],
    "curious":  ["Documentary", "Biography", "History", "Sci-Fi"],
    "excited":  ["Action", "Adventure", "Sci-Fi", "Fantasy"],
    "sad":      ["Drama", "Romance", "Music"],
    "inspired": ["Biography", "Sport", "History", "Drama"],
}


def get_user(db: Session, session_key: str) -> Optional[User]:
    return db.query(User).filter(User.session_key == session_key).first()


def get_favs_set(db: Session, user: Optional[User]) -> set:
    if not user:
        return set()
    return {f.tconst for f in db.query(Favorite.tconst).filter(Favorite.user_id == user.id).all()}


def to_out(movie: Movie, favs: set) -> MovieOut:
    return MovieOut(
        tconst=movie.tconst, title=movie.title, type=movie.type,
        year=movie.year, genres=movie.genres, rating=movie.rating,
        votes=movie.votes, runtime=movie.runtime, actors=movie.actors,
        directors=movie.directors, poster_url=movie.poster_url,
        platforms=movie.platforms, is_favorite=movie.tconst in favs,
    )


def apply_platform_filter(q, pref: Optional[Preference]):
    """Aplica filtro de plataforma se o usuário não selecionou 'Todas'."""
    if not pref or not pref.platforms:
        return q
    platform_list = [p.strip() for p in pref.platforms.split(",") if p.strip()]
    if not platform_list or "Todas" in platform_list:
        return q
    conds = [Movie.platforms.ilike(f"%{p}%") for p in platform_list]
    return q.filter(or_(*conds))


# ── User ──────────────────────────────────────────────────────────

@router.get("/user/check", response_model=UserCheckResponse)
def check_user(session_key: str = Query(...), db: Session = Depends(get_db)):
    user = get_user(db, session_key)
    has  = user is not None and user.preferences is not None
    return UserCheckResponse(has_profile=has, session_key=session_key)


@router.post("/user/survey")
def save_survey(payload: SurveyPayload, db: Session = Depends(get_db)):
    user = get_user(db, payload.session_key)
    if not user:
        user = User(session_key=payload.session_key)
        db.add(user)
        db.flush()
    if user.preferences:
        db.delete(user.preferences)
        db.flush()
    pref = Preference(
        user_id=user.id,
        genres=",".join(payload.genres),
        content_type=payload.content_type,
        platforms=",".join(payload.platforms),
    )
    db.add(pref)
    db.commit()
    return {"status": "ok"}


# ── Movies ────────────────────────────────────────────────────────

@router.get("/movies/explore", response_model=List[MovieOut])
def explore(
    session_key: str = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(24, le=48),
    db: Session = Depends(get_db),
):
    user = get_user(db, session_key)
    favs = get_favs_set(db, user)
    q    = db.query(Movie).filter(Movie.rating >= 6.0)

    if user and user.preferences:
        pref = user.preferences

        # Filtro de tipo de conteúdo
        if pref.content_type and pref.content_type != "both":
            q = q.filter(Movie.type == pref.content_type)

        # Filtro de gêneros preferidos
        if pref.genres:
            conds = [Movie.genres.ilike(f"%{g.strip()}%") for g in pref.genres.split(",") if g.strip()]
            if conds:
                q = q.filter(or_(*conds))

        # Filtro de plataformas
        q = apply_platform_filter(q, pref)

    movies = q.order_by(Movie.rating.desc(), Movie.votes.desc()).offset((page - 1) * limit).limit(limit).all()
    return [to_out(m, favs) for m in movies]


@router.get("/movies/lucky", response_model=MovieOut)
def lucky(session_key: str = Query(...), db: Session = Depends(get_db)):
    user = get_user(db, session_key)
    favs = get_favs_set(db, user)
    q    = db.query(Movie).filter(Movie.rating >= 7.0, Movie.votes >= 1000)

    if user and user.preferences:
        pref = user.preferences
        if pref.content_type and pref.content_type != "both":
            q = q.filter(Movie.type == pref.content_type)
        q = apply_platform_filter(q, pref)

    candidates = q.order_by(Movie.rating.desc()).limit(80).all()
    if not candidates:
        candidates = db.query(Movie).filter(Movie.rating >= 7.0).limit(80).all()
    if not candidates:
        raise HTTPException(status_code=404, detail="Nenhum filme encontrado")

    weights = [m.rating ** 2 for m in candidates]
    chosen  = random.choices(candidates, weights=weights, k=1)[0]
    return to_out(chosen, favs)


@router.get("/movies/mood", response_model=List[MovieOut])
def mood(
    session_key: str = Query(...),
    mood: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Mood é INDEPENDENTE das preferências de gênero do survey.
    Filtra apenas por: humor → gêneros, tipo de conteúdo e plataformas do usuário.
    """
    user   = get_user(db, session_key)
    favs   = get_favs_set(db, user)
    genres = MOOD_GENRE_MAP.get(mood.lower(), [])

    q = db.query(Movie).filter(Movie.rating >= 6.0)

    # Gêneros vêm EXCLUSIVAMENTE do humor, nunca do perfil
    if genres:
        conds = [Movie.genres.ilike(f"%{g}%") for g in genres]
        q = q.filter(or_(*conds))

    # Tipo de conteúdo e plataformas ainda se aplicam
    if user and user.preferences:
        pref = user.preferences
        if pref.content_type and pref.content_type != "both":
            q = q.filter(Movie.type == pref.content_type)
        q = apply_platform_filter(q, pref)

    movies = q.order_by(Movie.rating.desc(), Movie.votes.desc()).limit(24).all()
    return [to_out(m, favs) for m in movies]


@router.get("/movies/favorites", response_model=List[MovieOut])
def get_favorites(session_key: str = Query(...), db: Session = Depends(get_db)):
    user = get_user(db, session_key)
    if not user:
        return []
    tconsts = {f.tconst for f in db.query(Favorite).filter(Favorite.user_id == user.id).all()}
    movies  = db.query(Movie).filter(Movie.tconst.in_(tconsts)).all()
    return [to_out(m, tconsts) for m in movies]


@router.post("/movies/favorite")
def toggle_favorite(payload: FavoritePayload, db: Session = Depends(get_db)):
    user = get_user(db, payload.session_key)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    existing = db.query(Favorite).filter(
        Favorite.user_id == user.id, Favorite.tconst == payload.tconst
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"action": "removed", "tconst": payload.tconst}
    db.add(Favorite(user_id=user.id, tconst=payload.tconst))
    db.commit()
    return {"action": "added", "tconst": payload.tconst}
