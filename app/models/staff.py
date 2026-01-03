# app/models/staff.py
from app import db
import bcrypt

class LawEnforcementStaff(db.Model):
    __tablename__ = '执法人员信息表'

    law_enforcement_id = db.Column(db.String(20), primary_key=True, comment="执法人员ID（如S001）")
    staff_name = db.Column(db.String(30), nullable=False, comment="人员姓名")
    department = db.Column(db.String(100), nullable=False, comment="所属部门")
    permission = db.Column(db.String(200), comment="执法权限（如森林保护/消防检查）")
    contact = db.Column(db.String(11), nullable=False, comment="联系电话")
    equipment_number = db.Column(db.String(30), comment="执法设备编号")

    def to_dict(self):
        return {
            'law_enforcement_id': self.law_enforcement_id,
            'staff_name': self.staff_name,
            'department': self.department,
            'permission': self.permission,
            'contact': self.contact,
            'equipment_number': self.equipment_number
        }

    # # 新增：密码加密/校验方法（适配登录鉴权）
    # @staticmethod
    # def encrypt_password(password: str) -> str:
    #     """密码加密（bcrypt）"""
    #     password_bytes = password.encode('utf-8')
    #     salt = bcrypt.gensalt()
    #     hashed = bcrypt.hashpw(password_bytes, salt)
    #     return hashed.decode('utf-8')
    #
    # def check_password(self, password: str) -> bool:
    #     """校验密码"""
    #     password_bytes = password.encode('utf-8')
    #     hashed_bytes = self.password.encode('utf-8')
    #     return bcrypt.checkpw(password_bytes, hashed_bytes)