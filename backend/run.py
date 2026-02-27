"""
Convenience runner — starts the FastAPI dev server from any working directory.
Usage: python backend/run.py
"""
import subprocess
import sys
import os

# Change to the backend directory so 'app' module is importable
os.chdir(os.path.dirname(os.path.abspath(__file__)))

subprocess.run(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"],
    check=False,
)
