from app import db
from app.models import LawEnforcementStaff

class StaffService:
    """执法人员业务逻辑层（适配数据库表结构）"""

    @staticmethod
    def get_all():
        """查询所有执法人员"""
        return LawEnforcementStaff.query.all()

    @staticmethod
    def get_by_id(law_enforcement_id):
        """根据执法人员ID查询单个记录"""
        return LawEnforcementStaff.query.get(law_enforcement_id)

    @staticmethod
    def create(data):
        """
        创建执法人员
        :param data: 字典，包含执法人员字段（匹配数据库表）
        :return: 创建后的Staff对象
        """
        # 1. 校验必填字段（匹配数据库非空约束）
        required_fields = ['law_enforcement_id', 'staff_name', 'department', 'contact']
        for field in required_fields:
            if field not in data or not data[field]:
                raise ValueError(f"缺少必填字段：{field}")

        # 2. 校验手机号格式（匹配数据库CHECK约束）
        contact = data['contact']
        if not (len(contact) == 11 and contact.isdigit() and contact.startswith('1')):
            raise ValueError("手机号格式错误（必须是11位数字，以1开头）")

        # 3. 创建执法人员对象（仅保留数据库表字段）
        staff = LawEnforcementStaff(
            law_enforcement_id=data['law_enforcement_id'],
            staff_name=data['staff_name'],
            department=data['department'],
            permission=data.get('permission', ''),  # 数据库无默认值，默认空字符串
            contact=contact,
            equipment_number=data.get('equipment_number', '')
        )

        # 4. 事务提交
        try:
            db.session.add(staff)
            db.session.commit()
            return staff
        except Exception as e:
            db.session.rollback()
            raise Exception(f"创建执法人员失败：{str(e)}")

    @staticmethod
    def update(law_enforcement_id, data):
        """
        更新执法人员信息
        :param law_enforcement_id: 执法人员ID
        :param data: 更新字段字典（匹配数据库表）
        :return: 更新后的Staff对象（None表示不存在）
        """
        staff = LawEnforcementStaff.query.get(law_enforcement_id)
        if not staff:
            return None

        # 1. 禁止修改核心字段
        if 'law_enforcement_id' in data:
            raise ValueError("禁止修改执法人员ID")

        # 2. 处理手机号更新（校验格式）
        if 'contact' in data and data['contact']:
            contact = data['contact']
            if not (len(contact) == 11 and contact.isdigit() and contact.startswith('1')):
                raise ValueError("手机号格式错误（必须是11位数字，以1开头）")
            staff.contact = contact

        # 3. 处理其他字段更新（仅数据库表包含的字段）
        updatable_fields = ['staff_name', 'department', 'permission', 'equipment_number']
        for field in updatable_fields:
            if field in data and data[field] is not None:
                setattr(staff, field, data[field])

        # 4. 提交更新
        try:
            db.session.commit()
            return staff
        except Exception as e:
            db.session.rollback()
            raise Exception(f"更新执法人员失败：{str(e)}")

    @staticmethod
    def delete(law_enforcement_id):
        """
        删除执法人员
        :param law_enforcement_id: 执法人员ID
        :return: bool，True=删除成功
        """
        staff = LawEnforcementStaff.query.get(law_enforcement_id)
        if not staff:
            return False

        try:
            db.session.delete(staff)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise Exception(f"删除执法人员失败：{str(e)}")

    @staticmethod
    def get_by_department(department):
        """按部门查询执法人员"""
        return LawEnforcementStaff.query.filter_by(department=department).all()