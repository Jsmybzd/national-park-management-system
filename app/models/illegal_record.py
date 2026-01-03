# app/models/illegal_record.py
from app import db
from datetime import datetime

class IllegalBehaviorRecord(db.Model):
    __tablename__ = '非法行为记录表'

    record_id = db.Column(db.String(20), primary_key=True, comment="非法行为记录编号（如REC001）")
    behavior_type = db.Column(db.String(50), nullable=False, comment="行为类型（非法砍伐/违规用火等）")
    # occur_time设置默认值（当前时间），无需手动传值
    occur_time = db.Column(db.DateTime, nullable=False, default=datetime.now, comment="行为发生时间")
    area_number = db.Column(db.String(20), nullable=False, comment="发生区域编号")
    evidence_path = db.Column(db.String(500), comment="影像证据文件路径")
    handle_status = db.Column(db.String(20), default='未处理', comment="处理状态：未处理/处理中/已结案")
    law_enforcement_id = db.Column(db.String(20), comment="负责执法人员ID")
    handle_result = db.Column(db.String(500), comment="处理结果")
    punishment_basis = db.Column(db.String(500), comment="处罚依据")
    monitor_point_id = db.Column(db.String(30), nullable=False, comment="关联监控点ID")

    def to_dict(self):
        return {
            'record_id': self.record_id,
            'behavior_type': self.behavior_type,
            # 时间格式化：兼容前端解析，返回字符串
            'occur_time': self.occur_time.strftime("%Y-%m-%d %H:%M:%S") if self.occur_time else None,
            'area_number': self.area_number,
            'evidence_path': self.evidence_path,
            'handle_status': self.handle_status,
            'law_enforcement_id': self.law_enforcement_id,
            'handle_result': self.handle_result,
            'punishment_basis': self.punishment_basis,
            'monitor_point_id': self.monitor_point_id
        }