import hashlib
import time
from typing import Optional, Dict

from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings


serializer = URLSafeSerializer(settings.app_secret_key, salt="session")


def hash_password_sha256(password: str) -> str:
    """SHA256哈希密码"""
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def create_session_cookie(user_id: int) -> str:
    """创建会话cookie"""
    payload = {
        "user_id": user_id,
        "iat": int(time.time()),
        "last": int(time.time()),
    }
    return serializer.dumps(payload)


def parse_session_cookie(cookie_value: str) -> Optional[dict]:
    """解析会话cookie"""
    try:
        return serializer.loads(cookie_value)
    except BadSignature:
        return None


def touch_session_cookie(cookie_value: str) -> Optional[str]:
    """更新会话cookie时间戳"""
    data = parse_session_cookie(cookie_value)
    if not data:
        return None
    data["last"] = int(time.time())
    return serializer.dumps(data)


def is_session_expired(cookie_value: str) -> bool:
    """检查会话是否过期"""
    data = parse_session_cookie(cookie_value)
    if not data:
        return True
    last = int(data.get("last", 0))
    return (time.time() - last) > settings.session_idle_minutes * 60


def register_user(db: Session, phone: str, name: str, password: str, role_type: str) -> Optional[Dict]:
    """用户注册：新增用户到用户表"""
    # 1. 先检查手机号是否已注册
    existing = db.execute(
        text("SELECT 1 FROM dbo.用户 WHERE phone = :p"),
        {"p": phone}
    ).first()
    if existing:
        return None  # 手机号已存在
    
    # 2. 哈希密码
    pwd_hash = hash_password_sha256(password)
    
    # 3. 插入新用户
    result = db.execute(
        text("""
            INSERT INTO dbo.用户 (name, phone, role_type, 密码哈希, 登录失败次数, 是否锁定)
            OUTPUT INSERTED.用户ID  -- 返回新增的用户ID
            VALUES (:n, :p, :rt, :ph, 0, 0)
        """),
        {
            "n": name,
            "p": phone,
            "rt": role_type,
            "ph": pwd_hash
        }
    )
    db.commit()
    
    # 4. 返回用户信息
    user_id = result.scalar()
    return {
        "user_id": user_id,
        "name": name,
        "phone": phone,
        "role_type": role_type
    }


def authenticate(db: Session, phone: str, password: str) -> Optional[Dict]:
    """用户认证：手机号+密码登录，返回用户信息"""
    row = db.execute(
        text("""
            SELECT 用户ID, name, phone, role_type, 密码哈希, 是否锁定, 登录失败次数
            FROM dbo.用户
            WHERE phone = :p
        """),
        {"p": phone}
    ).mappings().first()

    if not row:
        return None  # 手机号不存在

    if row["是否锁定"]:
        return None  # 用户已锁定

    # 验证密码
    pwd_hash = hash_password_sha256(password)
    if pwd_hash != row["密码哈希"]:
        # 密码错误，更新失败次数+锁定状态
        db.execute(
            text("""
                UPDATE dbo.用户
                SET 登录失败次数 = 登录失败次数 + 1,
                    是否锁定 = CASE WHEN 登录失败次数 + 1 >= 5 THEN 1 ELSE 0 END
                WHERE 用户ID = :id
            """),
            {"id": row["用户ID"]}
        )
        db.commit()
        return None

    # 登录成功，重置失败次数+记录登录时间
    db.execute(
        text("""
            UPDATE dbo.用户
            SET 登录失败次数 = 0, 最后登录时间 = GETDATE()
            WHERE 用户ID = :id
        """),
        {"id": row["用户ID"]}
    )
    db.commit()

    # 返回用户信息
    return {
        "user_id": row["用户ID"],
        "name": row["name"],
        "phone": row["phone"],
        "role_type": row["role_type"]
    }


def user_has_permission(db: Session, user_id: int, permission_code: str) -> bool:
    """检查用户是否有指定权限（若后续需要权限表，需同步改表名）"""
    res = db.execute(
        text("""
            SELECT 1
            FROM dbo.UserRoles ur
            JOIN dbo.RolePermissions rp ON rp.RoleId = ur.RoleId
            JOIN dbo.Permissions p ON p.PermissionId = rp.PermissionId
            WHERE ur.UserId = :uid AND p.PermissionCode = :pc
        """),
        {"uid": user_id, "pc": permission_code}
    ).first()
    return res is not None


def get_current_user_id(request) -> Optional[int]:
    """从请求中获取当前用户ID"""
    cookie = request.cookies.get("session")
    if not cookie:
        return None
    if is_session_expired(cookie):
        return None
    data = parse_session_cookie(cookie)
    if not data:
        return None
    return int(data["user_id"])