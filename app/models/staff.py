# app/models/staff.py
from app import db

class LawEnforcementStaff(db.Model):
    __tablename__ = '执法人员信息表'

    law_enforcement_id = db.Column(db.String(20), primary_key=True)
    staff_name = db.Column(db.String(30), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    permission = db.Column(db.String(200))
    contact = db.Column(db.CHAR(11), nullable=False)
    equipment_number = db.Column(db.String(30))

    def to_dict(self):
        return {
            'law_enforcement_id': self.law_enforcement_id,
            'staff_name': self.staff_name,
            'department': self.department,
            'permission': self.permission,
            'contact': self.contact,
            'equipment_number': self.equipment_number
        }