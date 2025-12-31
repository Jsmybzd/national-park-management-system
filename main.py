# 1. 导入所有必需的模块
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware  # 关键：导入CORSMiddleware
from api.research import router as research_router
from database import engine
from models import Base

# 2. 初始化数据库表（首次启动自动创建表）
Base.metadata.create_all(bind=engine)

# 3. 创建FastAPI应用
app = FastAPI(title="科研数据支撑系统", version="1.0")

# 4. 配置跨域（解决前端访问跨域问题）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有域名访问（测试环境用，生产环境指定具体域名）
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有HTTP方法
    allow_headers=["*"],  # 允许所有请求头
)

# 5. 注册路由（加/api前缀，和你的测试URL对应）
app.include_router(research_router, prefix="/api")

# 6. 测试接口（可选，验证服务是否启动）
@app.get("/")
def root():
    return {"message": "科研数据支撑系统已启动，访问 /docs 查看接口文档"}