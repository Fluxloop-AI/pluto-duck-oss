"""Boards service for query execution and asset management."""

from __future__ import annotations

import aiofiles
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Dict
from uuid import uuid4

import duckdb
from fastapi import UploadFile

from pluto_duck_backend.app.core.config import get_settings
from pluto_duck_backend.app.services.boards.repository import BoardsRepository


class BoardsService:
    """Service for board operations including query execution."""

    def __init__(self, repository: BoardsRepository):
        self.repo = repository
        settings = get_settings()
        self.warehouse_path = settings.duckdb.path
        # Asset storage path (configurable)
        self.asset_storage_path = Path.home() / ".pluto_duck" / "assets"

    async def execute_query(self, query_id: str, project_id: str) -> Dict[str, Any]:
        """
        Execute stored query, enforce project scope, cache results.
        
        Args:
            query_id: Query ID to execute
            project_id: Project ID for permission check
            
        Returns:
            Query result snapshot with columns and data
            
        Raises:
            ValueError: If query not found
            PermissionError: If query doesn't belong to project
        """
        # Get query
        query = self.repo.get_query(query_id)
        if not query:
            raise ValueError("Query not found")

        # Verify board ownership by traversing: query -> item -> board -> project
        item = self.repo.get_item(query.board_item_id)
        if not item:
            raise ValueError("Board item not found")

        board = self.repo.get_board(item.board_id)
        if not board:
            raise ValueError("Board not found")

        if board.project_id != project_id:
            raise PermissionError("Query does not belong to this project")

        # Execute against DuckDB
        try:
            with duckdb.connect(str(self.warehouse_path)) as con:
                result = con.execute(query.query_text).fetchall()
                columns = [desc[0] for desc in con.description] if con.description else []

            # Create snapshot
            snapshot = {
                "columns": columns,
                "data": [dict(zip(columns, row)) for row in result],
                "row_count": len(result),
                "executed_at": datetime.now(UTC).isoformat(),
            }

            # Update query with result (cache)
            self.repo.update_query_result(
                query_id=query_id,
                result=snapshot,
                rows=len(result),
                status="success",
            )

            return snapshot

        except Exception as e:
            # Update query with error
            self.repo.update_query_result(
                query_id=query_id,
                result=None,
                rows=0,
                status="error",
                error_message=str(e),
            )
            raise

    async def get_cached_result(self, query_id: str) -> Dict[str, Any] | None:
        """Get cached query result without re-execution."""
        query = self.repo.get_query(query_id)
        if not query:
            return None

        if query.last_result_snapshot:
            return query.last_result_snapshot

        return None

    async def upload_asset(
        self,
        item_id: str,
        file: UploadFile,
        project_id: str,
    ) -> Dict[str, Any]:
        """
        Handle image/file upload, store to filesystem (NOT in DB as binary).
        
        Args:
            item_id: Board item ID
            file: Uploaded file
            project_id: Project ID for permission check
            
        Returns:
            Asset info with ID and URL
            
        Raises:
            ValueError: If file type not supported or item not found
            PermissionError: If item doesn't belong to project
        """
        # Validate file type (images only for MVP)
        if not file.content_type or not file.content_type.startswith("image/"):
            raise ValueError("Only image uploads are supported")

        # Verify item ownership
        item = self.repo.get_item(item_id)
        if not item:
            raise ValueError("Board item not found")

        board = self.repo.get_board(item.board_id)
        if not board:
            raise ValueError("Board not found")

        if board.project_id != project_id:
            raise PermissionError("Item does not belong to this project")

        # Generate unique filename
        file_ext = Path(file.filename or "image.png").suffix
        unique_name = f"{uuid4()}{file_ext}"

        # Storage path
        # Example: ~/.pluto_duck/assets/abc-123-def.png
        storage_path = self.asset_storage_path / unique_name
        storage_path.parent.mkdir(parents=True, exist_ok=True)

        # Save file to disk (binary data stored here, NOT in DB)
        content = await file.read()
        async with aiofiles.open(storage_path, "wb") as f:
            await f.write(content)

        # Create asset record (only metadata in DB)
        asset_id = self.repo.create_asset(
            item_id=item_id,
            asset_type="image",
            file_name=file.filename or "image.png",
            file_path=str(storage_path),  # Path only, not binary
            file_size=len(content),
            mime_type=file.content_type,
        )

        # Return asset info with URL for frontend
        # URL format: /api/v1/boards/assets/{asset_id}/download
        return {
            "asset_id": asset_id,
            "file_name": file.filename,
            "file_size": len(content),
            "mime_type": file.content_type,
            "url": f"/api/v1/boards/assets/{asset_id}/download",
        }

    async def download_asset(self, asset_id: str) -> tuple[Path, str]:
        """
        Get asset file path for download.
        
        Args:
            asset_id: Asset ID
            
        Returns:
            Tuple of (file_path, mime_type)
            
        Raises:
            ValueError: If asset not found
        """
        asset = self.repo.get_asset(asset_id)
        if not asset:
            raise ValueError("Asset not found")

        file_path = Path(asset.file_path)
        if not file_path.exists():
            raise ValueError("Asset file not found on disk")

        return file_path, asset.mime_type or "application/octet-stream"


def get_boards_service() -> BoardsService:
    """Get boards service instance."""
    from pluto_duck_backend.app.services.boards import get_boards_repository

    repo = get_boards_repository()
    return BoardsService(repo)

