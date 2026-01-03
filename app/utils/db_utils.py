# app/utils/db_utils.py
from app import db  # 从主包导入已初始化的db
from sqlalchemy import text

class DBUtils:
    @staticmethod
    def query(sql, params=None):
        """执行查询语句，返回字典列表"""
        result = db.session.execute(text(sql), params or {})
        columns = result.keys()
        return [dict(zip(columns, row)) for row in result.fetchall()]

    @staticmethod
    def execute(sql, params=None):
        """执行增删改/存储过程，返回受影响行数"""
        try:
            result = db.session.execute(text(sql), params or {})
            db.session.commit()
            return result.rowcount
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def call_procedure(proc_name, params=None):
        """调用SQL Server存储过程（适配你的sp_CreateDispatchForBehavior）"""
        # 拼接存储过程参数（如：EXEC sp_CreateDispatchForBehavior @record_id=:record_id）
        param_str = ", ".join([f"@{k}=:{k}" for k in (params or {}).keys()])
        sql = f"EXEC {proc_name} {param_str}" if param_str else f"EXEC {proc_name}"
        return DBUtils.execute(sql, params)