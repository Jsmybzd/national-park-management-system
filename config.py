import os
from dotenv import load_dotenv

load_dotenv()  # 加载 .env 文件

class Config:
    # 数据库连接配置（兼容SQLAlchemy）
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URI",
        "mssql+pyodbc://localhost\\SQLEXPRESS/NationalParkDB?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False  # 调试时可设为True，打印SQL语句