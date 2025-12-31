# # app/api/staff.py
# from flask import Blueprint, request
# from app.utils.response import success, error, not_found, no_content
# from app.services.staff_service import StaffService
#
# bp = Blueprint('staff', __name__)
#
# @bp.route('/staff', methods=['GET'])
# def get_all_staff():
#     staff_list = StaffService.get_all()
#     return success([s.to_dict() for s in staff_list])
#
# @bp.route('/staff/<string:law_enforcement_id>', methods=['GET'])
# def get_staff(law_enforcement_id):
#     staff = StaffService.get_by_id(law_enforcement_id)
#     if not staff:
#         return not_found("执法人员不存在")
#     return success(staff.to_dict())
#
# @bp.route('/staff', methods=['POST'])
# def create_staff():
#     data = request.get_json()
#     try:
#         staff = StaffService.create(data)
#         return success(staff.to_dict(), "创建成功", 201)
#     except ValueError as e:
#         return error(str(e), 400)
#     except Exception as e:
#         return error(f"服务器错误: {str(e)}", 500)
#
# @bp.route('/staff/<string:law_enforcement_id>', methods=['PUT'])
# def update_staff(law_enforcement_id):
#     data = request.get_json()
#     try:
#         staff = StaffService.update(law_enforcement_id, data)
#         if not staff:
#             return not_found("执法人员不存在")
#         return success(staff.to_dict(), "更新成功")
#     except ValueError as e:
#         return error(str(e), 400)
#     except Exception as e:
#         return error(f"服务器错误: {str(e)}", 500)
#
# @bp.route('/staff/<string:law_enforcement_id>', methods=['DELETE'])
# def delete_staff(law_enforcement_id):
#     try:
#         deleted = StaffService.delete(law_enforcement_id)
#         if not deleted:
#             return not_found("执法人员不存在")
#         return no_content()
#     except Exception as e:
#         return error(f"删除失败: {str(e)}", 500)