from pydantic import BaseModel
from typing import Optional, List


class SurveyPayload(BaseModel):
    session_key: str
    genres: List[str]
    content_type: str
    actors: List[str] = []
    directors: List[str] = []


class FavoritePayload(BaseModel):
    session_key: str
    tconst: str


class MovieOut(BaseModel):
    tconst: str
    title: str
    type: str
    year: Optional[int]
    genres: Optional[str]
    rating: Optional[float]
    votes: Optional[int]
    runtime: Optional[int]
    actors: Optional[str]
    directors: Optional[str]
    poster_url: Optional[str]
    is_favorite: bool = False

    class Config:
        orm_mode = True


class UserCheckResponse(BaseModel):
    has_profile: bool
    session_key: str
