@echo off
python -m src.data_processing.osm_parser
python -m uvicorn src.api.main:app --app-dir . --reload