"""
核心数据校验模型（Pydantic模型）
用于API请求/响应的数据验证
支持8种用户角色
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    """用户角色枚举 - 根据任务书更新"""
    SYSTEM_ADMIN = "系统管理员"
    ECOLOGY_MONITOR = "生态监测员"
    DATA_ANALYST = "数据分析师"
    TECHNICIAN = "技术人员"
    VISITOR = "游客"
    LAW_ENFORCER = "执法人员"
    RESEARCHER = "科研人员"
    PARK_MANAGER = "公园管理人员"


# 用户相关
class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="用户姓名")
    phone: Optional[str] = Field(None, max_length=20, description="联系电话")
    role_type: UserRole = Field(..., description="用户角色")

    class Config:
        use_enum_values = True


class UserCreate(UserBase):
    """创建用户（管理员后台）"""
    # 新增：管理员创建用户时可指定初始密码
    password: Optional[str] = Field(None, min_length=6, max_length=32, description="初始密码（至少6位）")


class UserUpdate(BaseModel):
    """更新用户信息"""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="用户姓名")
    phone: Optional[str] = Field(None, max_length=20, description="联系电话")
    role_type: Optional[UserRole] = Field(None, description="用户角色")
    # 新增：支持用户修改密码
    password: Optional[str] = Field(None, min_length=6, max_length=32, description="新密码（至少6位）")

    class Config:
        use_enum_values = True


class UserResponse(UserBase):
    """用户响应"""
    id: int
    created_time: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """用户列表响应"""
    total: int
    users: List[UserResponse]


# 注册相关（新增）
class RegisterRequest(BaseModel):
    """用户注册请求"""
    phone: str = Field(..., description="手机号（作为登录账号）")
    name: str = Field(..., description="用户姓名")
    password: str = Field(..., min_length=6, max_length=32, description="登录密码（至少6位）")
    role_type: UserRole = Field(..., description="用户角色")

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        """校验手机号格式（11位数字）"""
        if not v.strip():
            raise ValueError('手机号不能为空')
        if not v.isdigit() or len(v) != 11:
            raise ValueError('请输入11位有效手机号')
        return v.strip()

    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        """校验姓名"""
        if not v.strip() or len(v.strip()) < 2:
            raise ValueError('姓名至少2个字符')
        return v.strip()

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        """校验密码"""
        if len(v) < 6:
            raise ValueError('密码至少6位字符')
        if len(v) > 32:
            raise ValueError('密码最多32位字符')
        return v

    class Config:
        use_enum_values = True


class RegisterResponse(BaseModel):
    """用户注册响应"""
    success: bool = Field(default=True, description="注册是否成功")
    user_id: int = Field(..., description="新注册用户ID")
    name: str = Field(..., description="用户姓名")
    phone: str = Field(..., description="手机号")
    role_type: str = Field(..., description="用户角色")


# 登录相关（改造）
class LoginRequest(BaseModel):
    """登录请求（手机号+密码）"""
    phone: str = Field(..., description="手机号（作为登录账号）")
    password: str = Field(..., description="登录密码")

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        """校验手机号格式（11位数字）"""
        if not v.strip():
            raise ValueError('手机号不能为空')
        if not v.isdigit() or len(v) != 11:
            raise ValueError('请输入11位有效手机号')
        return v.strip()

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        """校验密码"""
        if not v:
            raise ValueError('密码不能为空')
        if len(v) < 6 or len(v) > 32:
            raise ValueError('密码长度需在6-32位之间')
        return v


class LoginResponse(BaseModel):
    """登录响应"""
    user_id: int
    name: str
    role_type: str
    token: str
    permissions: List[str] = Field(default_factory=list, description="用户权限列表")


# 会话相关
class SessionInfo(BaseModel):
    """会话信息"""
    session_id: int
    user_id: int
    login_time: datetime
    last_activity: datetime
    is_active: bool

    class Config:
        from_attributes = True


# 权限相关
class PermissionBase(BaseModel):
    """权限基础"""
    permission_code: str
    permission_name: str
    description: Optional[str] = None


class RolePermissionCreate(BaseModel):
    """创建角色权限"""
    role_type: UserRole
    permission_code: str

    class Config:
        use_enum_values = True


class RolePermissionResponse(RolePermissionCreate):
    """角色权限响应"""
    permission_name: Optional[str] = None
    description: Optional[str] = None


class UserPermissionResponse(BaseModel):
    """用户权限响应"""
    user_id: int
    name: str
    role_type: str
    permissions: List[PermissionBase]


# 安全相关
class LoginAttemptResponse(BaseModel):
    """登录尝试响应"""
    attempt_id: int
    user_id: Optional[int]
    phone: str
    attempt_time: datetime
    success: bool
    ip_address: Optional[str] = None

    class Config:
        from_attributes = True


# 统计相关
class UserStats(BaseModel):
    """用户统计"""
    total_users: int
    users_by_role: dict[str, int]
    active_sessions: int
    failed_attempts_24h: int


class SystemInfo(BaseModel):
    """系统信息"""
    system_name: str = "国家公园智慧管理与生态保护系统"
    version: str = "1.0.0"
    description: str = "基于FastAPI的国家公园智慧管理系统"
    supported_roles: List[str] = Field(default_factory=lambda: [
        "系统管理员", "生态监测员", "数据分析师", "技术人员",
        "游客", "执法人员", "科研人员", "公园管理人员"
    ])
    current_time: datetime