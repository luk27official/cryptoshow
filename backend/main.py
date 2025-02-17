from fastapi import FastAPI
import uvicorn

app = FastAPI()


@app.get("/")
async def read_root():
    return {"Hello": "World"}


@app.get("/{pdb_id}")
async def run_pdb_id(pdb_id: str):
    return {f"Called {pdb_id}"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
