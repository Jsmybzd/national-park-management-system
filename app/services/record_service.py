# app/services/record_service.py
from app import db
from app.models import IllegalBehaviorRecord, LawEnforcementStaff, VideoMonitorPoint


class RecordService:

    # 通用查询所有记录
    @staticmethod
    def get_all():
        return IllegalBehaviorRecord.query.all()

    @staticmethod
    def create(data):
        # 1. 校验外键是否存在（执法人员 & 监控点）
        staff = LawEnforcementStaff.query.get(data['law_enforcement_id'])
        monitor = VideoMonitorPoint.query.get(data['monitor_point_id'])
        if not staff:
            raise ValueError("执法人员不存在")
        if not monitor:
            raise ValueError("监控点不存在")

        # 2. 创建记录
        record = IllegalBehaviorRecord(
            behavior_type=data['behavior_type'],
            occur_time=data['occur_time'],
            area_number=data['area_number'],
            evidence_path=data['evidence_path'],
            law_enforcement_id=data['law_enforcement_id'],
            monitor_point_id=data['monitor_point_id']
        )
        db.session.add(record)
        db.session.commit()
        return record

    @staticmethod
    def update(record_id, status, result=None, basis=None):
        record = IllegalBehaviorRecord.query.get(record_id)
        if not record:
            raise ValueError("记录不存在")
        if status not in ['未处理', '处理中', '已结案']:
            raise ValueError("状态无效")

        record.handle_status = status
        record.handle_result = result
        record.punishment_basis = basis
        db.session.commit()
        return record

    @staticmethod
    def get_records_by_area(area_number):
        return IllegalBehaviorRecord.query.filter_by(area_number=area_number).all()