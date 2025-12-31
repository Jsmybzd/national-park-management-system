# app/utils/response.py
from flask import jsonify
from typing import Any, Optional

def success(data: Optional[Any] = None, msg: str = "操作成功", code: int = 200):
    """
    成功响应（可不带数据）
    示例：
      - success() → 返回 {code:200, msg:"操作成功", data:null}
      - success(staff.to_dict()) → 带数据
    """
    return jsonify({
        "code": code,
        "msg": msg,
        "data": data  # 当 data=None 时，JSON 中就是 null
    }), code

def created(data: Optional[Any] = None, msg: str = "创建成功"):
    """201 Created，用于新增资源"""
    return success(data, msg, code=201)

def no_content(msg: str = "操作成功"):
    """204 No Content，常用于删除成功，不返回 body"""
    return "", 204

def error(msg: str = "操作失败", code: int = 400, data: Any = None):
    return jsonify({
        "code": code,
        "msg": msg,
        "data": data
    }), code

def not_found(msg: str = "资源未找到"):
    return error(msg, code=404)

def bad_request(msg: str = "请求参数错误"):
    return error(msg, code=400)

def server_error(msg: str = "服务器内部错误"):
    return error(msg, code=500)