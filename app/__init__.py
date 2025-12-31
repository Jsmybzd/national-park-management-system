# app/__init__.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from config import Config

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    CORS(app)
    db.init_app(app)

    # 在函数内部导入蓝图（避免循环导入）
    #from app.api.staff import bp as staff_bp
    from app.api.illegal_record import bp as record_bp
    #from app.api.dispatch import bp as dispatch_bp
    #from app.api.monitor import bp as monitor_bp

    #app.register_blueprint(staff_bp, url_prefix='/api')
    app.register_blueprint(record_bp, url_prefix='/api/law-enforcement')
    #app.register_blueprint(dispatch_bp, url_prefix='/api')
    #app.register_blueprint(monitor_bp, url_prefix='/api')
    with app.app_context():
        db.create_all()  # 自动根据模型创建表
    return app