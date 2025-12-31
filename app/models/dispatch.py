# app/models/dispatch.py
from app import db
from datetime import datetime

class LawEnforcementDispatch(db.Model):
    __tablename__ = '执法调度信息表'

    dispatch_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    record_id = db.Column(db.Integer, nullable=False)
    law_enforcement_id = db.Column(db.String(20), nullable=False)
    dispatch_time = db.Column(db.DateTime, nullable=False)
    response_time = db.Column(db.DateTime)
    complete_time = db.Column(db.DateTime)
    dispatch_status = db.Column(db.String(20), default='待响应')

    def to_dict(self):
        return {
            'dispatch_number': self.dispatch_number,
            'record_number': self.record_number,
            'law_enforcement_id': self.law_enforcement_id,
            'dispatch_time': self.dispatch_time.isoformat() if self.dispatch_time else None,
            'response_time': self.response_time.isoformat() if self.response_time else None,
            'complete_time': self.complete_time.isoformat() if self.complete_time else None,
            'dispatch_status': self.dispatch_status
        }