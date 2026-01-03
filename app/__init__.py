from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from config import Config
from sqlalchemy import text

db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # 1. 优化跨域配置（解决APIFox跨域拦截）
    CORS(
        app,
        supports_credentials=True,
        origins="*",  # 开发环境允许所有域名，生产环境改为指定前端域名
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"]
    )

    # 2. 初始化数据库
    db.init_app(app)

    # 3. 数据库连接验证
    with app.app_context():
        try:
            db.session.execute(text('SELECT 1'))
            db.session.commit()
            print("数据库连接成功！")
        except Exception as e:
            print(f"数据库连接失败：{e}")

    # 延迟导入避免循环依赖，调用api/__init__.py中的注册函数
    from app.api import register_api_blueprints
    register_api_blueprints(app)  # 这行是关键！没有它业务路由不会注册

    # # ========== 调试必备：打印所有已注册的路由 ==========
    # print("\n=== 已注册的路由列表 ===")
    # for rule in app.url_map.iter_rules():
    #     print(f"路径：{rule.rule} | 允许方法：{list(rule.methods)}")

    return app