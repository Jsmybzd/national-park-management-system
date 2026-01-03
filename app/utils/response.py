# app/utils/response.py
from flask import jsonify

# 核心成功响应（适配所有接口）
def success(data=None, message="操作成功", code=200):
    return jsonify({"code": code, "message": message, "data": data}), code

# 通用错误响应
def error(message="操作失败", code=400, data=None):
    return jsonify({"code": code, "message": message, "data": data}), code

# 资源不存在（404）
def not_found(message="资源不存在"):
    return error(message, 404)

# 删除成功（204，保留JSON格式，避免前端解析异常）
def no_content(message="删除成功"):
    return jsonify({"code": 204, "message": message, "data": None}), 204

# JWT鉴权专用
def unauthorized(message="未授权访问，请先登录"):
    return error(message, 401)

# 可选：权限不足（后续扩展用）
def forbidden(message="权限不足，禁止访问"):
    return error(message, 403)