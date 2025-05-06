from pydantic import BaseModel, Field
from typing import Optional


class CalculateRequest(BaseModel):
    pdb: str = Field(examples=["2SRC"], description="PDB ID of the protein structure.")

    class Config:
        json_schema_extra = {"example": {"pdb": "2SRC"}}


class CalculateResponse(BaseModel):
    task_id: str = Field(
        ...,
        examples=["123e4567-e89b-12d3-a456-123123123000"],
        description="Unique identifier for the calculation task.",
    )

    class Config:
        json_schema_extra = {"example": {"task_id": "123e4567-e89b-12d3-a456-123123123000"}}


class TaskStatusResponse(BaseModel):
    status: str = Field(..., examples=["SUCCESS"], description="Current status of the task.")
    result: Optional[dict] = Field(None, examples=[{"key": "value"}], description="Result data when task is complete.")

    class Config:
        json_schema_extra = {"example": {"status": "SUCCESS", "result": {"key": "value"}}}


class FileResponseModel(BaseModel):
    file_path: str = Field(..., examples=["/app/data/results/file.txt"], description="Path to the file on the server.")
    file_name: str = Field(..., examples=["file.txt"], description="Name of the file for download.")
    message: str = Field(
        ..., examples=["File downloaded successfully."], description="Status message about the file download."
    )

    class Config:
        json_schema_extra = {
            "example": {
                "file_path": "/app/data/results/file.txt",
                "file_name": "file.txt",
                "message": "File downloaded successfully.",
            }
        }


class ProxyRequest(BaseModel):
    job_name: str = Field(..., examples=["CryptoShow 2SRC A LYS 123"], description="Name of the job to be processed.")
    queries: str = Field(..., examples=["2SRC A LYS 123"], description="Query string for the job.")
    options: dict = Field(..., examples=[{}], description="Additional options for the job.")

    class Config:
        json_schema_extra = {"example": {"data": {"key": "value"}}}


class HealthResponse(BaseModel):
    status: str = Field(..., examples=["healthy"], description="Health status of the service.")

    class Config:
        json_schema_extra = {"example": {"status": "healthy"}}
