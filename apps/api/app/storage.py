from abc import ABC, abstractmethod
from pathlib import Path
from typing import Union

from app.config import get_settings


class StorageBackend(ABC):
    @abstractmethod
    def save_file(self, content: bytes, storage_key: str) -> str:
        pass

    @abstractmethod
    def get_file_path(self, storage_key: str) -> Path:
        pass

    @abstractmethod
    def delete_file(self, storage_key: str) -> bool:
        pass

    @abstractmethod
    def file_exists(self, storage_key: str) -> bool:
        pass


class LocalStorageBackend(StorageBackend):
    def __init__(self, base_dir: Union[str, Path, None] = None):
        if base_dir is None:
            settings = get_settings()
            base_dir = settings.upload_dir
        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, storage_key: str) -> Path:
        clean_key = storage_key.replace('\\', '/').strip('/')
        parts = [p for p in clean_key.split('/') if p and p != '..']
        target_path = (self.base_dir / Path(*parts)).resolve()

        try:
            target_path.relative_to(self.base_dir)
        except ValueError:
            raise PermissionError('Access denied: path traversal attempt detected.')
        return target_path

    def save_file(self, content: bytes, storage_key: str) -> str:
        target_path = self._resolve_safe_path(storage_key)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(content)
        return storage_key

    def get_file_path(self, storage_key: str) -> Path:
        return self._resolve_safe_path(storage_key)

    def delete_file(self, storage_key: str) -> bool:
        try:
            target_path = self._resolve_safe_path(storage_key)
            if target_path.exists() and target_path.is_file():
                target_path.unlink()
            return True
        except Exception:
            return False

    def file_exists(self, storage_key: str) -> bool:
        try:
            target_path = self._resolve_safe_path(storage_key)
            return target_path.exists() and target_path.is_file()
        except Exception:
            return False


_storage_instance: StorageBackend | None = None


def get_storage() -> StorageBackend:
    global _storage_instance
    if _storage_instance is None:
        _storage_instance = LocalStorageBackend()
    return _storage_instance
