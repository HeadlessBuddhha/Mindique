from pydantic import BaseModel
from typing import Optional, List


class SurveyPayload(BaseModel):
    session_key: str
    genres: List[str]
    content_type: str
    platforms: List[str] = []


class FavoritePayload(BaseModel):
    session_key: str
    tconst: str


class MovieOut(BaseModel):
    tconst: str
    title: str
    type: str
    year: Optional[int] = None
    genres: Optional[str] = None
    rating: Optional[float] = None
    votes: Optional[int] = None
    runtime: Optional[int] = None
    actors: Optional[str] = None
    directors: Optional[str] = None
    poster_url: Optional[str] = None
    platforms: Optional[str] = None
    is_favorite: bool = False

    class Config:
        orm_mode = True


class UserCheckResponse(BaseModel):
    has_profile: bool
    session_key: str
