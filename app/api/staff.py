from flask import Blueprint, request
from app.utils.response import success, error, not_found, no_content
from app.services.staff_service import StaffService
import re  # 用于手机号格式校验

# 创建蓝图（和app/__init__.py注册的前缀对应）
bp = Blueprint('staff', __name__)


# ---------------------- 执法人员基础CRUD接口 ----------------------
@bp.route('', methods=['GET'])
def get_all_staff():
    """查询所有执法人员（支持按部门筛选）"""
    # 支持按部门筛选
    department = request.args.get('department')
    if department:
        staff_list = StaffService.get_by_department(department)
    else:
        staff_list = StaffService.get_all()

    # 格式化返回数据，匹配数据库表字段
    result = []
    for staff in staff_list:
        result.append({
            "law_enforcement_id": staff.law_enforcement_id,
            "staff_name": staff.staff_name,
            "department": staff.department,
            "permission": staff.permission,
            "contact": staff.contact,
            "equipment_number": staff.equipment_number
        })
    return success(result)


@bp.route('/<string:law_enforcement_id>', methods=['GET'])
def get_staff(law_enforcement_id):
    """查询单个执法人员"""
    staff = StaffService.get_by_id(law_enforcement_id)
    if not staff:
        return not_found("执法人员不存在")

    # 匹配数据库表字段返回
    staff_info = {
        "law_enforcement_id": staff.law_enforcement_id,
        "staff_name": staff.staff_name,
        "department": staff.department,
        "permission": staff.permission,
        "contact": staff.contact,
        "equipment_number": staff.equipment_number
    }
    return success(staff_info)


# 补充：手机号校验函数（匹配数据库CHECK约束：11位数字，以1开头）
def validate_mobile(mobile):
    """校验手机号格式（11位数字，以1开头）"""
    if not re.match(r'^1[0-9]{10}$', mobile):
        raise ValueError("手机号格式错误（必须是11位数字，以1开头）")
    return mobile


@bp.route('', methods=['POST'])
def create_staff():
    """创建执法人员（字段完全匹配数据库表）"""
    data = request.get_json()
    if not data:
        return error("请求体不能为空", 400)

    # 校验必填字段（匹配数据库表非空约束）
    required_fields = ['law_enforcement_id', 'staff_name', 'department', 'contact']
    for field in required_fields:
        if field not in data or not data[field]:
            return error(f"缺少字段或字段为空: {field}", 400)

    try:
        data['contact'] = validate_mobile(data['contact'])  # 手机号校验

        # 可选字段处理（数据库无默认值的字段）
        data.setdefault('permission', '')
        data.setdefault('equipment_number', '')

        # 调用Service层创建
        staff = StaffService.create(data)

        # 返回创建结果
        result = {
            "law_enforcement_id": staff.law_enforcement_id,
            "staff_name": staff.staff_name,
            "department": staff.department,
            "permission": staff.permission,
            "contact": staff.contact,
            "equipment_number": staff.equipment_number
        }
        return success(result, "创建成功", 201)
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(f"服务器错误: {str(e)}", 500)


@bp.route('/<string:law_enforcement_id>', methods=['PUT'])
def update_staff(law_enforcement_id):
    """更新执法人员信息（字段匹配数据库表）"""
    data = request.get_json()
    if not data:
        return error("请求体不能为空", 400)

    try:
        # 格式校验（仅校验传入的字段）
        if 'contact' in data and data['contact']:
            data['contact'] = validate_mobile(data['contact'])
        if 'law_enforcement_id' in data:
            raise ValueError("禁止修改执法人员ID")

        # 调用Service层更新
        staff = StaffService.update(law_enforcement_id, data)
        if not staff:
            return not_found("执法人员不存在")

        # 返回更新结果
        result = {
            "law_enforcement_id": staff.law_enforcement_id,
            "staff_name": staff.staff_name,
            "department": staff.department,
            "permission": staff.permission,
            "contact": staff.contact,
            "equipment_number": staff.equipment_number
        }
        return success(result, "更新成功")
    except ValueError as e:
        return error(str(e), 400)
    except Exception as e:
        return error(f"服务器错误: {str(e)}", 500)


@bp.route('/<string:law_enforcement_id>', methods=['DELETE'])
def delete_staff(law_enforcement_id):
    """删除执法人员"""
    try:
        # 物理删除（可根据需求改为逻辑删除）
        deleted = StaffService.delete(law_enforcement_id)
        if not deleted:
            return not_found("执法人员不存在")
        return success(message="删除成功")
    except Exception as e:
        return error(f"删除失败: {str(e)}", 500)