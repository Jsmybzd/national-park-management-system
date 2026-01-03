from flask import Blueprint, request
from app.utils.response import success, error, not_found
from app.services.monitor_service import MonitorService
# from app.utils.jwt_util import JWTUtil

bp = Blueprint('monitor', __name__)

# 未实现的JWT鉴权装饰器
# @bp.before_request
# @JWTUtil.jwt_required
# def before_request():
#     pass


@bp.route('', methods=['GET'])
def get_all_monitors():
    """查询所有监控点（支持按区域/状态筛选）"""
    try:
        area_number = request.args.get('area_number', '').strip()
        device_status = request.args.get('device_status', '').strip()

        # 修复4：实现组合条件查询逻辑（替代未实现的get_by_conditions）
        if area_number and device_status:
            monitors = MonitorService.get_by_area(area_number)
            monitors = [m for m in monitors if m.device_status == device_status]
        elif area_number:
            monitors = MonitorService.get_by_area(area_number)
        elif device_status:
            monitors = MonitorService.get_by_status(device_status)
        else:
            monitors = MonitorService.get_all()

        return success([m.to_dict() for m in monitors])
    except Exception as e:
        return error(f"查询失败：{str(e)}", 500)

@bp.route('/<string:monitor_point_id>', methods=['GET'])
def get_monitor(monitor_point_id):
    try:
        monitor = MonitorService.get_by_id(monitor_point_id.strip())
        if not monitor:
            return not_found("监控点不存在")
        return success(monitor.to_dict())
    except Exception as e:
        return error(f"查询失败：{str(e)}", 500)

@bp.route('', methods=['POST'])
def create_monitor():
    data = request.get_json()
    if not data:
        return error("请求体不能为空", 400)

    # 仅校验必填字段存在性，格式校验交给Service层
    required_fields = ['monitor_point_id', 'area_number', 'install_location_lng', 'install_location_lat']
    for field in required_fields:
        val = data.get(field, '').strip()
        if not val:
            return error(f"缺少字段或字段为空: {field}", 400)

    try:
        # 直接传原始值，避免float精度丢失
        monitor = MonitorService.create(data)
        return success(monitor.to_dict(), "创建成功", 201)
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(f"服务器错误: {str(e)}", 500)


@bp.route('/batch', methods=['POST'])
def batch_create_monitor():
    """批量创建监控点"""
    data_list = request.get_json()
    if not data_list or not isinstance(data_list, list):
        return error("请求体必须是包含监控点数据的数组", 400)

    success_list = []
    fail_list = []
    for idx, data in enumerate(data_list):
        try:
            # 复用单条创建的校验逻辑
            required_fields = ['monitor_point_id', 'area_number', 'install_location_lng', 'install_location_lat']
            for field in required_fields:
                val = data.get(field)
                if val is None:
                    raise ValueError(f"第{idx + 1}条数据缺少字段：{field}")
                elif isinstance(val, str) and not val.strip():
                    raise ValueError(f"第{idx + 1}条数据字段{field}为空")

            monitor = MonitorService.create(data)
            success_list.append(monitor.to_dict())
        except ValueError as e:
            fail_list.append({"index": idx + 1, "error": str(e)})
        except Exception as e:
            fail_list.append({"index": idx + 1, "error": f"服务器错误：{str(e)}"})

    return success({
        "success_count": len(success_list),
        "fail_count": len(fail_list),
        "success_data": success_list,
        "fail_data": fail_list
    }, "批量创建完成")

@bp.route('/<string:monitor_point_id>', methods=['PUT'])
def update_monitor(monitor_point_id):
    data = request.get_json()
    if not data:
        return error("请求体不能为空", 400)

    try:
        monitor = MonitorService.update(monitor_point_id.strip(), data)
        if not monitor:
            return not_found("监控点不存在")
        return success(monitor.to_dict(), "更新成功")
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(f"服务器错误: {str(e)}", 500)

@bp.route('/<string:monitor_point_id>', methods=['DELETE'])
def delete_monitor(monitor_point_id):
    """删除监控点（统一返回JSON格式，替代no_content）"""
    try:
        deleted = MonitorService.delete(monitor_point_id.strip())
        if not deleted:
            return not_found("监控点不存在")
        # 修复7：统一返回格式，前端可感知删除成功
        return success(message="监控点删除成功")
    except Exception as e:
        return error(f"删除失败: {str(e)}", 500)