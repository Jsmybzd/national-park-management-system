"""
核心API路由
处理用户认证、用户管理、角色权限管理等功能
支持8种用户角色
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import select, func, or_, and_, desc
import hashlib
import time
from datetime import datetime, timedelta
from itsdangerous import URLSafeSerializer

from app.db import get_db
from app.core import models, schemas
from app.config import settings
# 导入security.py的核心函数
from app.core.security import hash_password_sha256, register_user as security_register_user

router = APIRouter(prefix="/core", tags=["核心模块"])

# 创建序列化器
serializer = URLSafeSerializer(settings.app_secret_key, salt="session")
bearer_scheme = HTTPBearer()

# 在api.py顶部新增哈希函数
def hash_password_sha256(password: str) -> str:
    """SHA256加密密码"""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def create_token(user_id: int) -> str:
    """创建认证令牌"""
    payload = {
        "user_id": user_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + 8 * 60 * 60  # 8小时过期（方便开发测试）
    }
    return serializer.dumps(payload)


def verify_token(token: str) -> Dict[str, Any]:
    """验证令牌"""
    try:
        payload = serializer.loads(token)
        # 检查是否过期
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except:
        return None


async def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
        db: Session = Depends(get_db)
):
    """获取当前用户"""
    if not credentials or (credentials.scheme or "").lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="认证令牌无效或已过期"
        )

    user_id = payload.get("user_id")
    user = db.get(models.User, user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在"
        )

    # 检查用户是否被锁定（基于登录失败次数）
    # 获取最近30分钟内的失败登录尝试次数
    thirty_minutes_ago = datetime.now() - timedelta(minutes=30)
    failed_attempts = db.scalar(
        select(func.count(models.LoginAttempt.attempt_id)).where(
            models.LoginAttempt.user_id == user_id,
            models.LoginAttempt.success == 0,
            models.LoginAttempt.attempt_time >= thirty_minutes_ago
        )
    )

    # 如果失败次数超过5次，拒绝登录
    if failed_attempts >= 5:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户因多次登录失败被临时锁定，请30分钟后再试"
        )

    # 更新会话最后活动时间
    active_session = db.execute(
        select(models.UserSession).where(
            models.UserSession.user_id == user_id,
            models.UserSession.is_active == 1
        ).order_by(desc(models.UserSession.login_time)).limit(1)
    ).scalars().first()

    if active_session:
        active_session.last_activity = datetime.now()
        db.commit()

    return user


def record_login_attempt(
        db: Session,
        user_id: Optional[int],
        phone: str,
        success: bool,
        request: Request
):
    """记录登录尝试（适配所有表字段）"""
    attempt = models.LoginAttempt(
        user_id=user_id,
        phone=phone,
        success=1 if success else 0,  # 对应数据库的Integer类型
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,  # 补全user_agent
        error_msg=None  # 补全error_msg（失败时可填具体原因）
    )
    db.add(attempt)
    db.commit()


def create_user_session(
        db: Session,
        user_id: int,
        request: Request
):
    """创建用户会话（适配“用户会话”表的字段）"""
    session = models.UserSession(
        user_id=user_id,
        ip_address=request.client.host if request.client else None
        # 不包含user_agent（表中没有这个字段）
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_user_permissions_by_role(role_type: str) -> List[Dict[str, str]]:
    """根据角色获取权限列表"""
    # 根据任务书要求定义各角色的权限
    permissions_map = {
        "系统管理员": [
            {"permission_code": "USER_MANAGE", "permission_name": "用户管理"},
            {"permission_code": "DATA_VIEW_ALL", "permission_name": "查看所有数据"},
            {"permission_code": "DATA_EDIT_ALL", "permission_name": "编辑所有数据"},
            {"permission_code": "SYSTEM_CONFIG", "permission_name": "系统配置"},
            {"permission_code": "BACKUP_RESTORE", "permission_name": "备份恢复"},
        ],
        "生态监测员": [
            {"permission_code": "BIODIV_DATA_UPLOAD", "permission_name": "上传生物多样性数据"},
            {"permission_code": "BIODIV_DATA_VIEW", "permission_name": "查看生物多样性数据"},
            {"permission_code": "HABITAT_MANAGE", "permission_name": "栖息地管理"},
            {"permission_code": "SPECIES_MANAGE", "permission_name": "物种管理"},
        ],
        "数据分析师": [
            {"permission_code": "DATA_VIEW_ALL", "permission_name": "查看所有数据"},
            {"permission_code": "DATA_ANALYSIS", "permission_name": "数据分析"},
            {"permission_code": "REPORT_GENERATE", "permission_name": "生成报告"},
            {"permission_code": "THRESHOLD_MANAGE", "permission_name": "阈值管理"},
        ],
        "技术人员": [
            {"permission_code": "DEVICE_MANAGE", "permission_name": "设备管理"},
            {"permission_code": "SYSTEM_MAINTENANCE", "permission_name": "系统维护"},
            {"permission_code": "DEVICE_CALIBRATE", "permission_name": "设备校准"},
            {"permission_code": "NETWORK_MANAGE", "permission_name": "网络管理"},
        ],
        "游客": [
            {"permission_code": "VISITOR_RESERVE", "permission_name": "入园预约"},
            {"permission_code": "VISITOR_INFO_VIEW", "permission_name": "查看个人信息"},
            {"permission_code": "PARK_INFO_VIEW", "permission_name": "查看园区信息"},
            {"permission_code": "FEEDBACK_SUBMIT", "permission_name": "提交反馈"},
        ],
        "执法人员": [
            {"permission_code": "LAW_ENFORCE_VIEW", "permission_name": "查看执法任务"},
            {"permission_code": "LAW_ENFORCE_UPLOAD", "permission_name": "上传执法结果"},
            {"permission_code": "EVIDENCE_MANAGE", "permission_name": "证据管理"},
            {"permission_code": "VIOLATION_VIEW", "permission_name": "查看违规记录"},
        ],
        "科研人员": [
            {"permission_code": "RESEARCH_PROJECT_MANAGE", "permission_name": "科研项目管理"},
            {"permission_code": "RESEARCH_DATA_COLLECT", "permission_name": "科研数据采集"},
            {"permission_code": "RESEARCH_RESULT_UPLOAD", "permission_name": "科研成果上传"},
            {"permission_code": "SYSTEM_DATA_ACCESS", "permission_name": "系统数据访问"},
        ],
        "公园管理人员": [
            {"permission_code": "PARK_OVERVIEW_VIEW", "permission_name": "查看园区总览"},
            {"permission_code": "PROJECT_APPROVE", "permission_name": "项目审批"},
            {"permission_code": "FLOW_CONTROL_MANAGE", "permission_name": "流量控制管理"},
            {"permission_code": "ENFORCE_SCHEDULE_MANAGE", "permission_name": "执法调度管理"},
        ]
    }

    return permissions_map.get(role_type, [])


# ========== 新增：注册接口（重写，不依赖security.py） ==========
@router.post("/register", response_model=schemas.RegisterResponse)
def register(
        register_data: schemas.RegisterRequest,
        db: Session = Depends(get_db),
        request: Request = None
):
    """
    用户注册接口
    支持所有角色类型的用户注册，手机号唯一
    """
    # 1. 检查手机号是否已注册
    existing_user = db.execute(
        select(models.User).where(models.User.phone == register_data.phone)
    ).scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该手机号已注册"
        )
    
    # 2. 哈希密码
    pwd_hash = hash_password_sha256(register_data.password)
    
    # 3. 直接创建用户（ORM写法）
    new_user = models.User(
        name=register_data.name,
        phone=register_data.phone,
        role_type=register_data.role_type,
        password_hash=pwd_hash,    # 对应数据库：密码哈希
        failed_login_count=0,      # 对应数据库：登录失败次数
        is_locked=False            # 对应数据库：是否锁定
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "success": True,
        "user_id": new_user.id,
        "name": new_user.name,
        "phone": new_user.phone,
        "role_type": new_user.role_type
    }


# ========== 改造：登录接口（适配手机号+密码） ==========
@router.post("/login", response_model=schemas.LoginResponse)
async def login(
        login_data: schemas.LoginRequest,
        db: Session = Depends(get_db),
        request: Request = None
):
    """
    用户登录

    说明：使用手机号和密码进行登录验证
    安全要求：5次登录失败后锁定账户30分钟
    """
    # 查找用户（仅按手机号查）
    user = db.execute(
        select(models.User).where(
            models.User.phone == login_data.phone
        )
    ).scalar_one_or_none()

    if not user:
        # 记录失败的登录尝试
        record_login_attempt(db, None, login_data.phone, False, request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号或密码错误"
        )

    # 验证密码（调用security.py的哈希函数）
    pwd_hash = hash_password_sha256(login_data.password)
    if pwd_hash != user.password_hash:  # 注意：模型中需新增password_hash字段
        record_login_attempt(db, user.id, login_data.phone, False, request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号或密码错误"
        )

    # 检查最近30分钟的失败登录尝试次数
    thirty_minutes_ago = datetime.now() - timedelta(minutes=30)
    failed_attempts = db.scalar(
        select(func.count(models.LoginAttempt.attempt_id)).where(
            models.LoginAttempt.user_id == user.id,
            models.LoginAttempt.success == 0,
            models.LoginAttempt.attempt_time >= thirty_minutes_ago
        )
    )

    # 如果失败次数超过5次，拒绝登录
    if failed_attempts >= 5:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账户因多次登录失败被临时锁定，请30分钟后再试"
        )

    # 登录成功，记录成功尝试
    record_login_attempt(db, user.id, login_data.phone, True, request)

    # 创建会话
    session = create_user_session(db, user.id, request)

    # 生成令牌
    token = create_token(user.id)

    # 获取用户权限
    permissions = get_user_permissions_by_role(user.role_type)
    permission_codes = [p["permission_code"] for p in permissions]

    return {
        "user_id": user.id,
        "name": user.name,
        "role_type": user.role_type,
        "token": token,
        "permissions": permission_codes
    }


# ========== 原有登出接口（保留） ==========
@router.post("/logout")
async def logout(
        current_user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    """用户登出"""
    # 标记当前用户的活跃会话为过期
    active_session = db.execute(
        select(models.UserSession).where(
            models.UserSession.user_id == current_user.id,
            models.UserSession.is_active == 1
        )
    ).scalar()
    
    if active_session:
        active_session.is_active = 0
        db.commit()

    return {"message": "登出成功"}


# ========== 用户管理API（保留原有逻辑） ==========
@router.get("/users", response_model=schemas.UserListResponse)
def get_users(
        page: int = Query(1, ge=1, description="页码"),
        page_size: int = Query(20, ge=1, le=100, description="每页数量"),
        role_type: schemas.UserRole = Query(None, description="按角色筛选"),
        name: str = Query(None, description="按姓名搜索"),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    获取用户列表

    需要权限：系统管理员或公园管理人员
    """
    # 权限检查
    if current_user.role_type not in ["系统管理员", "公园管理人员"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权查看用户列表"
        )

    # 构建查询
    query = select(models.User)

    if role_type:
        query = query.where(models.User.role_type == role_type.value)

    if name:
        query = query.where(models.User.name.like(f"%{name}%"))

    # 计算总数
    total = db.scalar(select(func.count()).select_from(query.subquery()))

    # 分页查询
    offset = (page - 1) * page_size
    users = db.scalars(
        query.order_by(models.User.id.desc())
        .offset(offset)
        .limit(page_size)
    ).all()

    return {
        "total": total,
        "users": users
    }


@router.get("/users/{user_id}", response_model=schemas.UserResponse)
def get_user(
        user_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    获取单个用户信息

    权限：
    1. 用户自己可以查看自己的信息
    2. 系统管理员、公园管理人员可以查看所有用户信息
    """
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 权限检查
    is_self = current_user.id == user_id
    is_admin_or_manager = current_user.role_type in ["系统管理员", "公园管理人员"]

    if not is_self and not is_admin_or_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权查看其他用户信息"
        )

    return user


@router.post("/users", response_model=schemas.UserResponse)
def create_user(
        user_data: schemas.UserCreate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    创建新用户（管理员后台创建）

    需要权限：系统管理员或公园管理人员
    """
    # 权限检查
    if current_user.role_type not in ["系统管理员", "公园管理人员"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权创建用户"
        )

    # 检查手机号是否已注册
    existing = db.execute(
        select(models.User).where(models.User.phone == user_data.phone)
    ).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该手机号已注册"
        )

    # 创建用户（默认密码123456，需哈希）
    default_pwd_hash = hash_password_sha256("123456")
    db_user = models.User(
        name=user_data.name,
        phone=user_data.phone,
        role_type=user_data.role_type,
        password_hash=default_pwd_hash  # 新增密码哈希字段
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user


@router.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
        user_id: int,
        user_data: schemas.UserUpdate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    更新用户信息

    权限：
    1. 用户自己可以更新自己的信息（但不能修改角色）
    2. 系统管理员可以更新任何用户信息
    3. 公园管理人员可以更新非管理员用户的信息
    """
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 权限检查
    is_self = current_user.id == user_id
    is_admin = current_user.role_type == "系统管理员"
    is_manager = current_user.role_type == "公园管理人员"
    is_target_admin = user.role_type == "系统管理员"

    if not is_self and not is_admin:
        # 公园管理人员不能修改系统管理员的信息
        if is_manager and is_target_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权修改系统管理员信息"
            )
        elif not is_manager:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权修改其他用户信息"
            )

    # 检查：非管理员不能修改角色
    if not is_admin and user_data.role_type and user_data.role_type != user.role_type:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权修改用户角色"
        )

    # 检查手机号是否已被其他用户使用
    if user_data.phone and user_data.phone != user.phone:
        existing = db.execute(
            select(models.User).where(
                models.User.phone == user_data.phone,
                models.User.id != user_id
            )
        ).scalar_one_or_none()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该手机号已被其他用户使用"
            )

    # 处理密码更新（如果传了新密码）
    if hasattr(user_data, 'password') and user_data.password:
        user.password_hash = hash_password_sha256(user_data.password)

    # 更新字段
    update_data = user_data.model_dump(exclude_unset=True)
    # 排除password字段（已单独处理）
    update_data.pop('password', None)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    return user


@router.delete("/users/{user_id}")
def delete_user(
        user_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    删除用户

    需要权限：系统管理员
    不能删除自己
    """
    # 权限检查
    if current_user.role_type != "系统管理员":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要系统管理员权限"
        )

    # 不能删除自己
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己的账户"
        )

    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 不能删除其他系统管理员
    if user.role_type == "系统管理员" and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除其他系统管理员"
        )

    db.delete(user)
    db.commit()

    return {"message": "用户删除成功"}


# ========== 权限管理API（保留） ==========
@router.get("/permissions", response_model=schemas.UserPermissionResponse)
def get_user_permissions(
        current_user: models.User = Depends(get_current_user)
):
    """
    获取当前用户的权限列表
    """
    permissions = get_user_permissions_by_role(current_user.role_type)

    return {
        "user_id": current_user.id,
        "name": current_user.name,
        "role_type": current_user.role_type,
        "permissions": permissions
    }


@router.get("/profile", response_model=schemas.UserResponse)
def get_current_profile(
        current_user: models.User = Depends(get_current_user)
):
    """
    获取当前用户的完整信息
    """
    return current_user


@router.get("/roles")
def get_all_roles():
    """
    获取所有支持的角色类型
    """
    return {
        "roles": [
            {"value": "系统管理员", "description": "拥有系统所有权限"},
            {"value": "生态监测员", "description": "负责生物多样性和生态环境监测"},
            {"value": "数据分析师", "description": "负责数据分析和报告生成"},
            {"value": "技术人员", "description": "负责设备维护和系统技术支撑"},
            {"value": "游客", "description": "公园游客，可预约入园"},
            {"value": "执法人员", "description": "负责公园执法和违规处理"},
            {"value": "科研人员", "description": "开展科研项目，使用系统数据"},
            {"value": "公园管理人员", "description": "管理公园日常运营和决策"}
        ]
    }


# ========== 会话管理API（保留） ==========
@router.get("/sessions/active", response_model=List[schemas.SessionInfo])
def get_active_sessions(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    获取活跃会话列表

    需要权限：系统管理员
    """
    if current_user.role_type != "系统管理员":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要系统管理员权限"
        )

    # 获取所有活跃会话（最近30分钟内有活动的）
    thirty_minutes_ago = datetime.now() - timedelta(minutes=30)
    sessions = db.scalars(
        select(models.UserSession).where(
            models.UserSession.is_active == 1,
            models.UserSession.last_activity >= thirty_minutes_ago
        ).order_by(desc(models.UserSession.last_activity))
    ).all()

    return sessions


@router.post("/sessions/{session_id}/invalidate")
def invalidate_session(
        session_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    使指定会话失效

    需要权限：系统管理员或会话所有者
    """
    session = db.get(models.UserSession, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在"
        )

    # 权限检查
    if current_user.id != session.user_id and current_user.role_type != "系统管理员":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权操作此会话"
        )

    session.is_active = 0
    db.commit()

    return {"message": "会话已失效"}


# ========== 统计信息API（保留） ==========
@router.get("/stats", response_model=schemas.UserStats)
def get_user_stats(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    获取用户统计信息

    需要权限：系统管理员或公园管理人员
    """
    if current_user.role_type not in ["系统管理员", "公园管理人员"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权查看统计信息"
        )

    # 总用户数
    total_users = db.scalar(select(func.count(models.User.id)))

    # 按角色统计
    role_counts = {}
    for role in schemas.UserRole:
        count = db.scalar(
            select(func.count(models.User.id)).where(models.User.role_type == role.value)
        )
        role_counts[role.value] = count

    # 活跃会话数（最近30分钟）
    thirty_minutes_ago = datetime.now() - timedelta(minutes=30)
    active_sessions = db.scalar(
        select(func.count(models.UserSession.session_id)).where(
            models.UserSession.is_active == 1,
            models.UserSession.last_activity >= thirty_minutes_ago
        )
    )

    # 24小时内失败登录尝试数
    twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
    failed_attempts_24h = db.scalar(
        select(func.count(models.LoginAttempt.attempt_id)).where(
            models.LoginAttempt.success == 0,
            models.LoginAttempt.attempt_time >= twenty_four_hours_ago
        )
    )

    return {
        "total_users": total_users,
        "users_by_role": role_counts,
        "active_sessions": active_sessions,
        "failed_attempts_24h": failed_attempts_24h
    }


# ========== 系统信息API（保留） ==========
@router.get("/system/info", response_model=schemas.SystemInfo)
def get_system_info():
    """
    获取系统信息（无需登录）
    """
    return {
        "system_name": "国家公园智慧管理与生态保护系统",
        "version": "1.0.0",
        "description": "基于FastAPI的国家公园智慧管理系统",
        "supported_roles": [
            "系统管理员", "生态监测员", "数据分析师", "技术人员",
            "游客", "执法人员", "科研人员", "公园管理人员"
        ],
        "current_time": datetime.now()
    }


# ========== 健康检查API（保留） ==========
@router.get("/health")
def health_check():
    """健康检查"""
    return {"status": "healthy", "timestamp": datetime.now()}