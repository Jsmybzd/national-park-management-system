# database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import urllib.parse

server = r'张诺恒\SQLExpress'  # 注意：加 r 前缀避免转义问题
database = 'NationalParkDB'
driver = 'ODBC Driver 18 for SQL Server'

# 关键：添加 Encrypt 和 TrustServerCertificate
conn_str = (
    f"DRIVER={{{driver}}};"
    f"SERVER={server};"
    f"DATABASE={database};"
    f"Trusted_Connection=yes;"
    f"Encrypt=Optional;"               # ← 允许非加密连接
    f"TrustServerCertificate=yes;"     # ← 跳过证书验证（开发环境安全）
)

params = urllib.parse.quote_plus(conn_str)
SQLALCHEMY_DATABASE_URL = f"mssql+pyodbc:///?odbc_connect={params}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()