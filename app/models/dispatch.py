from app import db
from datetime import datetime

class LawEnforcementDispatch(db.Model):
    """执法调度信息表模型（严格匹配数据库表结构）"""
    __tablename__ = '执法调度信息表'

    dispatch_id = db.Column(db.String(20), primary_key=True, comment="调度编号（如DISP001）")
    record_id = db.Column(db.String(20), nullable=False, comment="非法行为记录编号（如REC001）")
    law_enforcement_id = db.Column(db.String(20), nullable=False, comment="执法人员ID")
    dispatch_time = db.Column(db.DateTime, nullable=False, default=datetime.now, comment="调度时间")
    response_time = db.Column(db.DateTime, comment="响应时间")
    complete_time = db.Column(db.DateTime, comment="处置完成时间")
    # 扩展状态值：兼容存储过程的"待响应"和触发器的"已完成"
    dispatch_status = db.Column(db.String(20), default='待响应', comment="调度状态：待响应/已派单/已响应/已完成/已取消")

    def to_dict(self):
        """转为字典（时间格式优化）"""
        return {
            'dispatch_id': self.dispatch_id,
            'record_id': self.record_id,
            'law_enforcement_id': self.law_enforcement_id,
            # 格式化时间为易读字符串
            'dispatch_time': self.dispatch_time.strftime("%Y-%m-%d %H:%M:%S") if self.dispatch_time else None,
            'response_time': self.response_time.strftime("%Y-%m-%d %H:%M:%S") if self.response_time else None,
            'complete_time': self.complete_time.strftime("%Y-%m-%d %H:%M:%S") if self.complete_time else None,
            'dispatch_status': self.dispatch_status
        }