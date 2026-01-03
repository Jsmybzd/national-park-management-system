# 导入所有模块的蓝图
from flask import Blueprint

# 导入各业务模块的蓝图对象
from .illegal_record import bp as illegal_record_bp
from .dispatch import bp as dispatch_bp
from .monitor import bp as monitor_bp
from .staff import bp as staff_bp

# 定义蓝图注册函数（供主程序调用）
def register_api_blueprints(app):
    """
    统一注册API蓝图，遵循RESTful规范
    每个业务模块对应独立前缀，语义清晰
    """
    # 执法人员模块
    app.register_blueprint(staff_bp, url_prefix='/api/enforcement/staff')
    # 非法行为记录模块
    app.register_blueprint(illegal_record_bp, url_prefix='/api/enforcement/records')
    # 执法调度模块
    app.register_blueprint(dispatch_bp, url_prefix='/api/enforcement/dispatch')
    # 监控点模块
    app.register_blueprint(monitor_bp, url_prefix='/api/enforcement/monitor')

# 暴露注册函数（供外部调用）
__all__ = ['register_api_blueprints']