# # app/api/dispatch.py
# from flask import Blueprint, request
# from app.utils.response import success, error, not_found, no_content
# from app.services.dispatch_service import DispatchService
# from datetime import datetime
#
# bp = Blueprint('dispatch', __name__)
#
#
# @bp.route('/dispatches', methods=['GET'])
# def get_all_dispatches():
#     dispatches = DispatchService.get_all()
#     return success([d.to_dict() for d in dispatches])
#
#
# @bp.route('/dispatches/<string:dispatch_number>', methods=['GET'])
# def get_dispatch(dispatch_number):
#     dispatch = DispatchService.get_by_id(dispatch_number)
#     if not dispatch:
#         return not_found("调度记录不存在")
#     return success(dispatch.to_dict())
#
#
# @bp.route('/dispatches', methods=['POST'])
# def create_dispatch():
#     data = request.get_json()
#     required = ['dispatch_number', 'record_number', 'law_enforcement_id', 'dispatch_time']
#     for field in required:
#         if field not in data:
#             return error(f"缺少字段: {field}", 400)
#
#     try:
#         if isinstance(data['dispatch_time'], str):
#             data['dispatch_time'] = datetime.fromisoformat(data['dispatch_time'].replace('Z', '+00:00'))
#         dispatch = DispatchService.create(data)
#         return success(dispatch.to_dict(), "派单成功", 201)
#     except ValueError as e:
#         return error(str(e), 400)
#     except Exception as e:
#         return error(f"服务器错误: {str(e)}", 500)
#
#
# @bp.route('/dispatches/<string:dispatch_number>', methods=['PUT'])
# def update_dispatch(dispatch_number):
#     data = request.get_json()
#     try:
#         dispatch = DispatchService.update(dispatch_number, data)
#         if not dispatch:
#             return not_found("调度记录不存在")
#         return success(dispatch.to_dict(), "更新成功")
#     except ValueError as e:
#         return error(str(e), 400)
#     except Exception as e:
#         return error(f"服务器错误: {str(e)}", 500)
#
#
# @bp.route('/dispatches/<string:dispatch_number>', methods=['DELETE'])
# def delete_dispatch(dispatch_number):
#     try:
#         deleted = DispatchService.delete(dispatch_number)
#         if not deleted:
#             return not_found("调度记录不存在")
#         return no_content()
#     except Exception as e:
#         return error(f"删除失败: {str(e)}", 500)