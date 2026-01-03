# app/utils/jwt_util.py
import jwt
import time
from datetime import datetime, timedelta
from flask import current_app, request, g
from functools import wraps
from app.utils.response import error, unauthorized  # 后续补充unauthorized响应

# JWT配置（建议放到config.py，这里先写死，后续替换）
JWT_SECRET_KEY = "your-secret-key-xxxx-xxxx-xxxx"  # 生产环境要复杂，可从.env读取
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 2  # token有效期2小时


class JWTUtil:
    @staticmethod
    def generate_token(user_id: str, role: str = "staff") -> str:
        """
        生成JWT token
        :param user_id: 执法人员ID/用户ID
        :param role: 角色（如staff/admin）
        :return: 加密后的token字符串
        """
        # 1. 构造payload（存储不敏感的用户信息）
        payload = {
            "user_id": user_id,
            "role": role,
            "iat": datetime.utcnow(),  # 签发时间（UTC时间）
            "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)  # 过期时间
        }
        # 2. 生成token
        token = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        # 兼容Python3的字符串格式
        return token if isinstance(token, str) else token.decode("utf-8")

    @staticmethod
    def verify_token(token: str) -> dict:
        """
        校验token并解析payload
        :param token: 前端传入的token
        :return: 解析后的payload字典
        :raise: 校验失败抛出异常
        """
        try:
            # 校验并解析token
            payload = jwt.decode(
                token,
                JWT_SECRET_KEY,
                algorithms=[JWT_ALGORITHM],
                options={"verify_exp": True}  # 验证过期时间
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise Exception("Token已过期")
        except jwt.InvalidTokenError:
            raise Exception("Token无效")
        except Exception as e:
            raise Exception(f"Token校验失败：{str(e)}")

    @staticmethod
    def jwt_required(f):
        """
        Flask装饰器：接口需要token鉴权
        使用示例：
        @bp.route('/staff/<staff_id>')
        @JWTUtil.jwt_required
        def get_staff(staff_id):
            # 可通过g.user获取解析后的用户信息
            user_id = g.user["user_id"]
            ...
        """

        @wraps(f)
        def decorated_function(*args, **kwargs):
            # 1. 从请求头获取token（格式：Authorization: Bearer <token>）
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return error(msg="请先登录", code=401)

            token = auth_header.split(" ")[1]
            # 2. 校验token
            try:
                payload = JWTUtil.verify_token(token)
                # 3. 将用户信息存入g（Flask上下文，供接口使用）
                g.user = payload
            except Exception as e:
                return error(msg=str(e), code=401)

            # 4. 执行原接口逻辑
            return f(*args, **kwargs)

        return decorated_function