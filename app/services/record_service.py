from app import db
from app.models import IllegalBehaviorRecord, LawEnforcementStaff, VideoMonitorPoint

class RecordService:
    @staticmethod
    def get_all():
        return IllegalBehaviorRecord.query.all()

    @staticmethod
    def get_by_id(record_id):
        if not record_id:
            return None
        return IllegalBehaviorRecord.query.get(record_id.strip())

    @staticmethod
    def get_records_by_area(area_number):
        if not area_number:
            return []
        return IllegalBehaviorRecord.query.filter_by(area_number=area_number.strip()).all()

    @staticmethod
    def get_records_by_status(handle_status):
        valid_status = ['未处理', '处理中', '已结案']
        if handle_status not in valid_status:
            raise ValueError(f"处理状态无效，仅支持：{', '.join(valid_status)}")
        return IllegalBehaviorRecord.query.filter_by(handle_status=handle_status).all()

    @staticmethod
    def create(data):
        if 'area_number' in data:
            raise ValueError("禁止手动传入区域编号，区域编号将自动从监控点ID关联获取")

        if 'handle_status' in data:
            raise ValueError("创建记录时处置状态强制为'未处理'，禁止手动指定")

        illegal_fields = ['handle_result', 'punishment_basis']
        for field in illegal_fields:
            if field in data:
                raise ValueError(f"创建记录时禁止传入「{field}」，该字段仅可在处置阶段更新")

        required_fields = ['record_id', 'behavior_type', 'monitor_point_id']
        for field in required_fields:
            val = data.get(field, '').strip()
            if not val:
                raise ValueError(f"必填字段「{field}」不能为空")

        # 关联监控点获取区域编号
        monitor_point_id = data['monitor_point_id'].strip()
        monitor = VideoMonitorPoint.query.get(monitor_point_id)
        if not monitor:
            raise ValueError(f"监控点ID「{monitor_point_id}」不存在，无法获取区域编号")
        auto_area_number = monitor.area_number

        # ========== 执法人员校验（不变，可选传） ==========
        law_enforcement_id = data.get('law_enforcement_id', '').strip()
        if law_enforcement_id:
            staff = LawEnforcementStaff.query.get(law_enforcement_id)
            if not staff:
                raise ValueError(f"执法人员ID「{law_enforcement_id}」不存在")

        # ========== 创建记录（强制固定初始状态） ==========
        record = IllegalBehaviorRecord(
            record_id=data['record_id'].strip(),
            behavior_type=data['behavior_type'].strip(),
            area_number=auto_area_number,  # 强制用监控点关联的，忽略前端传参
            monitor_point_id=monitor_point_id,
            evidence_path=data.get('evidence_path', '').strip(),  # 可选传
            law_enforcement_id=law_enforcement_id,  # 可选传
            handle_status="未处理",  # 强制固定初始状态，禁止前端修改
            handle_result=None,  # 创建时无处置结果
            punishment_basis=None  # 创建时无处罚依据
        )

        try:
            db.session.add(record)
            db.session.commit()
            return record
        except Exception as e:
            db.session.rollback()
            raise Exception(f"创建记录失败：{str(e)}")

    @staticmethod
    def update(record_id, data):
        record = IllegalBehaviorRecord.query.get(record_id.strip())
        if not record:
            return None

        # 修复：若更新monitor_point_id，同步更新area_number
        if 'monitor_point_id' in data and data['monitor_point_id'].strip():
            new_monitor_id = data['monitor_point_id'].strip()
            new_monitor = VideoMonitorPoint.query.get(new_monitor_id)
            if not new_monitor:
                raise ValueError(f"新的监控点ID「{new_monitor_id}」不存在")
            # 同步更新area_number为新监控点的区域编号
            record.area_number = new_monitor.area_number
            record.monitor_point_id = new_monitor_id

        # 执法人员外键校验（保持不变）
        if 'law_enforcement_id' in data and data['law_enforcement_id'].strip():
            staff = LawEnforcementStaff.query.get(data['law_enforcement_id'].strip())
            if not staff:
                raise ValueError(f"执法人员ID「{data['law_enforcement_id']}」不存在")

        # 处理状态校验（保持不变）
        if 'handle_status' in data:
            valid_status = ['未处理', '处理中', '已结案']
            status = data['handle_status'].strip()
            if status not in valid_status:
                raise ValueError(f"处理状态无效，仅支持：{', '.join(valid_status)}")
            record.handle_status = status

        # 处理其他可更新字段（排除area_number，避免手动修改）
        updatable_fields = [
            'behavior_type', 'evidence_path', 'law_enforcement_id',
            'handle_result', 'punishment_basis'
        ]
        for field in updatable_fields:
            if field in data and data[field] is not None:
                val = data[field].strip() if isinstance(data[field], str) else data[field]
                setattr(record, field, val)

        try:
            db.session.commit()
            return record
        except Exception as e:
            db.session.rollback()
            raise Exception(f"更新记录失败：{str(e)}")

    @staticmethod
    def delete(record_id):
        if not record_id:
            return False

        record = IllegalBehaviorRecord.query.get(record_id.strip())
        if not record:
            return False

        try:
            db.session.delete(record)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise Exception(f"删除记录失败：{str(e)}")
