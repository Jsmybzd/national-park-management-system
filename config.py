# config.py
import os
from dotenv import load_dotenv

load_dotenv()  # 加载 .env 文件

class Config:
    SQLALCHEMY_DATABASE_URI = (
        "mssql+pyodbc://localhost\\SQLEXPRESS/执法监管业务线"
        "?driver=ODBC+Driver+17+for+SQL+Server"
        "&trusted_connection=yes"
    )