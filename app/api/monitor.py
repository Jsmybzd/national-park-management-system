# # app/api/monitor.py
# from flask import Blueprint, request
# from app.utils.response import success, error, not_found, no_content
# from app.services.monitor_service import MonitorService
#
# bp = Blueprint('monitor', __name__)
#
# @bp.route('/monitor-points', methods=['GET'])
# def get_all_monitors():
#     monitors = MonitorService.get_all()
#     return success([m.to_dict() for m in monitors])
#
# @bp.route('/monitor-points/<string:monitor_point_id>', methods=['GET'])
# def get_monitor(monitor_point_id):
#     monitor = MonitorService.get_by_id(monitor_point_id)
#     if not monitor:
#         return not_found("监控点不存在")
#     return success(monitor.to_dict())
#
# @bp.route('/monitor-points', methods=['POST'])
# def create_monitor():
#     data = request.get_json()
#     try:
#         monitor = MonitorService.create(data)
#         return success(monitor.to_dict(), "创建成功", 201)
#     except ValueError as e:
#         return error(str(e), 400)
#     except Exception as e:
#         return error(f"服务器错误: {str(e)}", 500)
#
# @bp.route('/monitor-points/<string:monitor_point_id>', methods=['PUT'])
# def update_monitor(monitor_point_id):
#     data = request.get_json()
#     try:
#         monitor = MonitorService.update(monitor_point_id, data)
#         if not monitor:
#             return not_found("监控点不存在")
#         return success(monitor.to_dict(), "更新成功")
#     except ValueError as e:
#         return error(str(e), 400)
#     except Exception as e:
#         return error(f"服务器错误: {str(e)}", 500)
#
# @bp.route('/monitor-points/<string:monitor_point_id>', methods=['DELETE'])
# def delete_monitor(monitor_point_id):
#     try:
#         deleted = MonitorService.delete(monitor_point_id)
#         if not deleted:
#             return not_found("监控点不存在")
#         return no_content()
#     except Exception as e:
#         return error(f"删除失败: {str(e)}", 500)