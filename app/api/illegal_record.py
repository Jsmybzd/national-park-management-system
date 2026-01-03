from flask import Blueprint, request
from app.utils.response import success, error, not_found
from app.services.record_service import RecordService

# 移除未实现的JWT依赖，若需鉴权需补充JWTUtil实现
bp = Blueprint('illegal_record', __name__)

@bp.route('', methods=['GET'])
def get_all_records():
    try:
        records = RecordService.get_all()
        return success([record.to_dict() for record in records])
    except Exception as e:
        return error(f"查询失败：{str(e)}", 500)

@bp.route('/<string:record_id>', methods=['GET'])
def get_record(record_id):
    try:
        record = RecordService.get_by_id(record_id)
        if not record:
            return not_found("记录不存在")
        return success(record.to_dict())
    except Exception as e:
        return error(f"查询失败：{str(e)}", 500)

@bp.route('', methods=['POST'])
def create_record():
    data = request.get_json()
    if not data:
        return error("请求体不能为空", 400)

    required = ['record_id', 'behavior_type', 'monitor_point_id']
    for field in required:
        val = data.get(field, '').strip()
        if not val:
            return error(f"缺少字段或字段为空: {field}", 400)

    try:
        record = RecordService.create(data)
        return success(record.to_dict(), "创建成功", 201)
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(f"服务器错误: {str(e)}", 500)

@bp.route('/<string:record_id>', methods=['PUT'])
def update_record(record_id):
    data = request.get_json()
    if not data:
        return error("请求体不能为空", 400)

    try:
        record = RecordService.update(record_id, data)
        if not record:
            return not_found("记录不存在")
        return success(record.to_dict(), "更新成功")
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(f"服务器错误: {str(e)}", 500)

@bp.route('/<string:record_id>', methods=['DELETE'])
def delete_record(record_id):
    try:
        deleted = RecordService.delete(record_id)
        if not deleted:
            return not_found("记录不存在")
        return success(message="删除成功")
    except Exception as e:
        return error(f"删除失败: {str(e)}", 500)