from flask import Blueprint, request
from app.utils.response import success, error, not_found, no_content
from app.services.dispatch_service import DispatchService
from datetime import datetime, timedelta

bp = Blueprint('dispatch', __name__)

@bp.route('', methods=['GET'])
def query_dispatches():
    """
    通用调度记录查询接口（支持多条件组合筛选）
    Query参数说明：
    - dispatch_id: 调度ID（精准查询，优先级最高）
    - record_id: 非法记录ID（精准查询）
    - law_enforcement_id: 执法人员编号（精准查询）
    - status: 调度状态（待响应/已派单/已响应/已完成/已取消）
    - start_time: 调度创建开始时间（格式：YYYY-MM-DD）
    - end_time: 调度创建结束时间（格式：YYYY-MM-DD）
    """
    try:
        # 1. 获取参数（不变）
        dispatch_id = request.args.get('dispatch_id', '').strip()
        record_id = request.args.get('record_id', '').strip()
        law_enforcement_id = request.args.get('law_enforcement_id', '').strip()
        status = request.args.get('status', '').strip()
        start_time = request.args.get('start_time', '').strip()
        end_time = request.args.get('end_time', '').strip()

        # 2. 时间处理（不变）
        start_dt = None
        end_dt = None
        if start_time:
            try:
                start_dt = datetime.strptime(start_time, '%Y-%m-%d')
            except ValueError:
                return error("start_time格式错误，需为YYYY-MM-DD", 400)
        if end_time:
            try:
                end_dt = datetime.strptime(end_time, '%Y-%m-%d') + timedelta(days=1) - timedelta(seconds=1)
            except ValueError:
                return error("end_time格式错误，需为YYYY-MM-DD", 400)

        # 3. 仅调用get_by_conditions（核心简化）
        dispatches = DispatchService.get_by_conditions(
            dispatch_id=dispatch_id,
            record_id=record_id,
            status=status,
            law_enforcement_id=law_enforcement_id,
            start_time=start_dt,
            end_time=end_dt
        )

        # 4. 特殊处理：dispatch_id精准查询为空时返回404
        if dispatch_id and not dispatches:
            return not_found("调度记录不存在")

        # 5. 返回结果
        return success(
            [d.to_dict() for d in dispatches],
            f"查询到{len(dispatches)}条调度记录"
        )

    except Exception as e:
        return error(f"查询失败：{str(e)}", 500)

@bp.route('/create-by-procedure/<string:record_id>', methods=['GET'])
def create_dispatch_by_procedure(record_id):
    """
    调用存储过程批量创建调度任务
    """
    try:
        # 直接使用函数参数record_id（URL路径中的真实ID），而非request.view_args
        dispatch_list = DispatchService.create_by_procedure(record_id)
        return success(
            [d.to_dict() for d in dispatch_list],
            f"调用存储过程成功，批量创建{len(dispatch_list)}条调度任务",
            201
        )
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(f"服务器错误: {str(e)}", 500)

@bp.route('/<string:dispatch_id>/status', methods=['PUT'])
def update_dispatch_status(dispatch_id):
    """
    简化更新接口：仅更新调度状态（触发触发器）
    无需传复杂的时间字段，由Service层自动填充
    """
    data = request.get_json()
    if not data or 'dispatch_status' not in data:
        return error("缺少调度状态参数", 400)

    try:
        dispatch = DispatchService.update_dispatch_status(dispatch_id, data['dispatch_status'])
        if not dispatch:
            return not_found("调度记录不存在")
        return success(
            dispatch.to_dict(),
            f"调度状态已更新为{data['dispatch_status']}，触发器已自动同步非法记录状态"
        )
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(f"服务器错误: {str(e)}", 500)

@bp.route('/<string:dispatch_id>', methods=['DELETE'])
def delete_dispatch(dispatch_id):
    """删除调度记录（保留原逻辑）"""
    try:
        deleted = DispatchService.delete(dispatch_id)
        if not deleted:
            return not_found("调度记录不存在")
        return no_content()
    except Exception as e:
        return error(f"删除失败: {str(e)}", 500)