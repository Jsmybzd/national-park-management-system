"""
核心数据模型定义
基于任务书要求的8种用户角色
"""
from sqlalchemy import Column, Integer, String, DateTime, CheckConstraint, Boolean, UniqueConstraint
from sqlalchemy.sql import func
from app.db import Base


class User(Base):
    """用户表 - 整合所有角色"""
    __tablename__ = "用户"  # 数据库表名（中文）

    # 字段名完全匹配数据库（中文）
    id = Column("id", Integer, primary_key=True, autoincrement=True, comment="用户ID")
    name = Column("name", String(100), nullable=False, comment="用户姓名")
    phone = Column("phone", String(20), unique=True, nullable=False, comment="手机号")
    role_type = Column("role_type", String(20), nullable=False, comment="用户角色类型")
    created_time = Column("created_time", DateTime, server_default=func.now(), comment="创建时间")
    
    # 中文字段名（和数据库一致）
    password_hash = Column("密码哈希", String(64), nullable=False, comment="密码哈希（SHA256）")
    failed_login_count = Column("登录失败次数", Integer, default=0, comment="累计登录失败次数")
    is_locked = Column("是否锁定", Boolean, default=False, comment="是否被锁定")
    last_login_time = Column("最后登录时间", DateTime, nullable=True, comment="最后登录时间")

    # 角色约束
    __table_args__ = (
        CheckConstraint(
            "role_type IN ('系统管理员', '生态监测员', '数据分析师', '技术人员', '游客', '执法人员', '科研人员', '公园管理人员')",
            name="CHK_用户角色"
        ),
        UniqueConstraint("phone", name="UQ_用户手机号"),
    )

    def __repr__(self):
        return f"<User(id={self.id}, name={self.name}, phone={self.phone}, role={self.role_type})>"


class RolePermission(Base):
    """角色权限映射表"""
    __tablename__ = "角色权限"

    role_type = Column("role_type", String(20), primary_key=True, comment="角色类型")
    permission_code = Column("permission_code", String(50), primary_key=True, comment="权限编码")
    permission_name = Column("permission_name", String(100), comment="权限名称")
    description = Column("description", String(200), comment="权限描述")

    def __repr__(self):
        return f"<RolePermission(role={self.role_type}, permission={self.permission_code})>"


class UserSession(Base):
    __tablename__ = "用户会话"  # 注意：你的表名是“用户会话”，不是“用户会话表”

    # 完全匹配表的字段名
    session_id = Column("session_id", Integer, primary_key=True, autoincrement=True)
    user_id = Column("user_id", Integer, nullable=False)
    login_time = Column("login_time", DateTime, server_default=func.now())
    last_activity = Column("last_activity", DateTime, server_default=func.now())
    is_active = Column("is_active", Integer, default=1)  # 1=活跃，0=过期
    ip_address = Column("ip_address", String(50))

    def __repr__(self):
        return f"<UserSession(session_id={self.session_id}, user_id={self.user_id})>"


class LoginAttempt(Base):
    __tablename__ = "登录尝试"

    # 完全匹配数据库的字段名（包括user_agent/error_msg）
    attempt_id = Column("attempt_id", Integer, primary_key=True, autoincrement=True)
    user_id = Column("user_id", Integer, nullable=True)
    phone = Column("phone", String(20), nullable=False)
    attempt_time = Column("attempt_time", DateTime, server_default=func.now())
    success = Column("success", Integer, default=0)  # 数据库是Integer类型（1/0）
    ip_address = Column("ip_address", String(50))
    user_agent = Column("user_agent", String(200), nullable=True)  # 新增：匹配表字段
    error_msg = Column("error_msg", String(100), nullable=True)    # 新增：匹配表字段

    def __repr__(self):
        return f"<LoginAttempt(attempt_id={self.attempt_id}, phone={self.phone})>"