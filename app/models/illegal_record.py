# app/models/illegal_record.py
from app import db
from datetime import datetime

class IllegalBehaviorRecord(db.Model):
    __tablename__ = '非法行为记录表'

    record_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    behavior_type = db.Column(db.String(50), nullable=False)
    occur_time = db.Column(db.DateTime, nullable=False)
    area_number = db.Column(db.String(20), nullable=False)
    evidence_path = db.Column(db.String(500), nullable=False)
    handle_status = db.Column(db.String(20), default='未处理')
    law_enforcement_id = db.Column(db.String(20), nullable=False)
    handle_result = db.Column(db.String(500))
    punishment_basis = db.Column(db.String(500))
    monitor_point_id = db.Column(db.String(30), nullable=False)

    def to_dict(self):
        return {
            'record_id': self.record_id,
            'behavior_type': self.behavior_type,
            'occur_time': self.occur_time.isoformat() if self.occur_time else None,
            'area_number': self.area_number,
            'evidence_path': self.evidence_path,
            'handle_status': self.handle_status,
            'law_enforcement_id': self.law_enforcement_id,
            'handle_result': self.handle_result,
            'punishment_basis': self.punishment_basis,
            'monitor_point_id': self.monitor_point_id
        }