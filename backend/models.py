from sqlalchemy import Column, String, Float, Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base


class Movie(Base):
    __tablename__ = "movies"

    tconst    = Column(String, primary_key=True, index=True)
    title     = Column(String, nullable=False, index=True)
    type      = Column(String, nullable=False)       # movie | tvSeries
    year      = Column(Integer, nullable=True)
    genres    = Column(String, nullable=True)        # comma-separated
    rating    = Column(Float, nullable=True)
    votes     = Column(Integer, nullable=True)
    runtime   = Column(Integer, nullable=True)       # minutes
    actors    = Column(Text, nullable=True)          # comma-separated
    directors = Column(Text, nullable=True)          # comma-separated
    poster_url= Column(String, nullable=True)


class User(Base):
    __tablename__ = "users"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    session_key = Column(String, unique=True, index=True, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    preferences = relationship("Preference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    favorites   = relationship("Favorite",   back_populates="user", cascade="all, delete-orphan")


class Preference(Base):
    __tablename__ = "preferences"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    genres       = Column(String, nullable=True)
    content_type = Column(String, nullable=True)    # movie | tvSeries | both
    actors       = Column(Text, nullable=True)
    directors    = Column(Text, nullable=True)

    user = relationship("User", back_populates="preferences")


class Favorite(Base):
    __tablename__ = "favorites"

    id       = Column(Integer, primary_key=True, autoincrement=True)
    user_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    tconst   = Column(String, ForeignKey("movies.tconst"), nullable=False)
    saved_at = Column(DateTime(timezone=True), server_default=func.now())

    user  = relationship("User",  back_populates="favorites")
    movie = relationship("Movie")
