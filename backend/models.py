from pydantic import BaseModel, Field
from typing import Optional


class CalculateRequest(BaseModel):
    pdb: str = Field(..., example="2SRC")

    class Config:
        schema_extra = {"example": {"pdb": "2SRC"}}


class CalculateResponse(BaseModel):
    task_id: str = Field(..., example="123e4567-e89b-12d3-a456-123123123000")

    class Config:
        schema_extra = {"example": {"task_id": "123e4567-e89b-12d3-a456-123123123000"}}


class TaskStatusResponse(BaseModel):
    status: str = Field(..., example="SUCCESS")
    result: Optional[dict] = Field(None, example={"key": "value"})

    class Config:
        schema_extra = {"example": {"status": "SUCCESS", "result": {"key": "value"}}}


class FileResponseModel(BaseModel):
    file_path: str = Field(..., example="/app/data/results/file.txt")
    file_name: str = Field(..., example="file.txt")
    message: str = Field(..., example="File downloaded successfully.")

    class Config:
        schema_extra = {
            "example": {
                "file_path": "/app/data/results/file.txt",
                "file_name": "file.txt",
                "message": "File downloaded successfully.",
            }
        }


class ProxyRequest(BaseModel):
    data: dict = Field(..., example={"key": "value"})

    class Config:
        schema_extra = {"example": {"data": {"key": "value"}}}


class HealthResponse(BaseModel):
    status: str = Field(..., example="healthy")

    class Config:
        schema_extra = {"example": {"status": "healthy"}}
