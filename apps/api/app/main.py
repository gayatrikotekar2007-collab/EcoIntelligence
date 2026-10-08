from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.database import engine
from app.exceptions import handle_http_exception, handle_unexpected_error, handle_validation_error
from app.routers import auth, evidence, investigations, map, users

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        pass
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    debug=settings.debug,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_prefix = settings.api_v1_prefix
app.include_router(auth.router, prefix=f"{api_prefix}/auth")
app.include_router(users.router, prefix=api_prefix)
app.include_router(investigations.router, prefix=f"{api_prefix}/investigations")
app.include_router(evidence.router, prefix=api_prefix)
app.include_router(map.router, prefix=api_prefix)


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.app_env,
    }


@app.get("/")
async def root():
    return {
        "message": f"{settings.app_name} API is running",
        "docs": "/docs",
    }


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return await handle_http_exception(request, exc)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    return await handle_validation_error(request, exc)


@app.exception_handler(Exception)
async def unexpected_exception_handler(request, exc):
    return await handle_unexpected_error(request, exc)
