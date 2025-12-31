# app/api/illegal_record.py
from flask import Blueprint, request
from app.utils.response import success, error, not_found, no_content
from app.services.record_service import RecordService
from datetime import datetime

bp = Blueprint('illegal_record', __name__)


@bp.route('/records', methods=['GET'])
def get_all_records():
    records = RecordService.get_all()
    return success([r.to_dict() for r in records])


@bp.route('/records/<string:record_id>', methods=['GET'])
def get_record(record_id):
    record = RecordService.get_by_id(record_id)
    if not record:
        return not_found("记录不存在")
    return success(record.to_dict())


@bp.route('/records', methods=['POST'])
def create_record():
    data = request.get_json()
    required = ['behavior_type', 'occur_time', 'area_number', 'evidence_path', 'law_enforcement_id',
                'monitor_point_id']
    for field in required:
        if field not in data:
            return error(f"缺少字段: {field}", 400)

    try:
        # 处理时间格式
        if isinstance(data['occur_time'], str):
            data['occur_time'] = datetime.fromisoformat(data['occur_time'].replace('Z', '+00:00'))
        record = RecordService.create(data)
        return success(record.to_dict(), "创建成功", 201)
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(f"服务器错误: {str(e)}", 500)


@bp.route('/records/<string:record_id>', methods=['PUT'])
def update_record(record_id):
    data = request.get_json()
    try:
        record = RecordService.update(record_id, data)
        if not record:
            return not_found("记录不存在")
        return success(record.to_dict(), "更新成功")
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(f"服务器错误: {str(e)}", 500)


@bp.route('/records/<string:record_number>', methods=['DELETE'])
def delete_record(record_number):
    try:
        deleted = RecordService.delete(record_number)
        if not deleted:
            return not_found("记录不存在")
        return no_content()
    except Exception as e:
        return error(f"删除失败: {str(e)}", 500)