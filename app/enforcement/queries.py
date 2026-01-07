from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import desc, select, text
from sqlalchemy.orm import Session

from . import models


class EnforcementQueries:
    # ========== 执法人员管理 ==========
    @staticmethod
    def list_staff(db: Session, department: Optional[str] = None) -> List[models.执法人员信息表]:
        q = select(models.执法人员信息表)
        if department:
            q = q.where(models.执法人员信息表.department == department)
        return db.scalars(q.order_by(models.执法人员信息表.law_enforcement_id)).all()

    @staticmethod
    def get_staff(db: Session, law_enforcement_id: str) -> Optional[models.执法人员信息表]:
        return db.get(models.执法人员信息表, law_enforcement_id)

    @staticmethod
    def create_staff(db: Session, payload) -> models.执法人员信息表:
        staff = models.执法人员信息表(
            law_enforcement_id=payload.law_enforcement_id,
            staff_name=payload.staff_name,
            department=payload.department,
            permission=payload.permission,
            contact=payload.contact,
            equipment_number=payload.equipment_number,
        )
        db.add(staff)
        db.commit()
        db.refresh(staff)
        return staff

    @staticmethod
    def update_staff(db: Session, law_enforcement_id: str, update_data: dict) -> Optional[models.执法人员信息表]:
        staff = db.get(models.执法人员信息表, law_enforcement_id)
        if not staff:
            return None
        if "law_enforcement_id" in update_data:
            update_data.pop("law_enforcement_id", None)
        for k, v in update_data.items():
            if v is not None:
                setattr(staff, k, v)
        db.commit()
        db.refresh(staff)
        return staff

    @staticmethod
    def delete_staff(db: Session, law_enforcement_id: str) -> bool:
        staff = db.get(models.执法人员信息表, law_enforcement_id)
        if not staff:
            return False
        db.delete(staff)
        db.commit()
        return True

    # ========== 视频监控点管理 ==========
    @staticmethod
    def list_monitor_points(
        db: Session,
        area_number: Optional[str] = None,
        device_status: Optional[str] = None,
    ) -> List[models.视频监控点信息表]:
        q = select(models.视频监控点信息表)
        if area_number:
            q = q.where(models.视频监控点信息表.area_number == area_number)
        if device_status:
            q = q.where(models.视频监控点信息表.device_status == device_status)
        return db.scalars(q.order_by(models.视频监控点信息表.monitor_point_id)).all()

    @staticmethod
    def get_monitor_point(db: Session, monitor_point_id: str) -> Optional[models.视频监控点信息表]:
        return db.get(models.视频监控点信息表, monitor_point_id)

    @staticmethod
    def create_monitor_point(db: Session, payload) -> models.视频监控点信息表:
        mp = models.视频监控点信息表(
            monitor_point_id=payload.monitor_point_id,
            area_number=payload.area_number,
            install_location_lng=payload.install_location_lng,
            install_location_lat=payload.install_location_lat,
            monitor_range=payload.monitor_range,
            device_status=payload.device_status or "正常",
            data_storage_cycle=payload.data_storage_cycle or 90,
        )
        db.add(mp)
        db.commit()
        db.refresh(mp)
        return mp

    @staticmethod
    def update_monitor_point(db: Session, monitor_point_id: str, update_data: dict) -> Optional[models.视频监控点信息表]:
        mp = db.get(models.视频监控点信息表, monitor_point_id)
        if not mp:
            return None
        if "monitor_point_id" in update_data:
            update_data.pop("monitor_point_id", None)
        for k, v in update_data.items():
            if v is not None:
                setattr(mp, k, v)
        db.commit()
        db.refresh(mp)
        return mp

    @staticmethod
    def delete_monitor_point(db: Session, monitor_point_id: str) -> bool:
        mp = db.get(models.视频监控点信息表, monitor_point_id)
        if not mp:
            return False
        db.delete(mp)
        db.commit()
        return True

    # ========== 非法行为记录管理 ==========
    @staticmethod
    def list_illegal_records(db: Session) -> List[models.非法行为记录表]:
        return db.scalars(select(models.非法行为记录表).order_by(desc(models.非法行为记录表.occur_time))).all()

    @staticmethod
    def get_illegal_record(db: Session, record_id: str) -> Optional[models.非法行为记录表]:
        return db.get(models.非法行为记录表, record_id)

    @staticmethod
    def create_illegal_record(db: Session, payload) -> models.非法行为记录表:
        monitor = db.get(models.视频监控点信息表, payload.monitor_point_id)
        if not monitor:
            raise ValueError("监控点不存在")

        if payload.law_enforcement_id:
            staff = db.get(models.执法人员信息表, payload.law_enforcement_id)
            if not staff:
                raise ValueError("执法人员不存在")

        record = models.非法行为记录表(
            record_id=payload.record_id,
            behavior_type=payload.behavior_type,
            occur_time=datetime.now(),
            area_number=monitor.area_number,
            evidence_path=(payload.evidence_path or ""),
            handle_status="未处理",
            law_enforcement_id=payload.law_enforcement_id,
            handle_result=None,
            punishment_basis=None,
            monitor_point_id=payload.monitor_point_id,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def update_illegal_record(db: Session, record_id: str, update_data: dict) -> Optional[models.非法行为记录表]:
        record = db.get(models.非法行为记录表, record_id)
        if not record:
            return None

        if "record_id" in update_data:
            update_data.pop("record_id", None)

        if "monitor_point_id" in update_data and update_data["monitor_point_id"] is not None:
            new_monitor_id = update_data["monitor_point_id"]
            monitor = db.get(models.视频监控点信息表, new_monitor_id)
            if not monitor:
                raise ValueError("监控点不存在")
            record.monitor_point_id = new_monitor_id
            record.area_number = monitor.area_number

        # 处理 handle_status 映射
        if "handle_status" in update_data:
            status = update_data["handle_status"]
            mapping = {
                "已分配": "处理中",
                "已派单": "处理中",
                "派单中": "处理中",
                "完成": "已结案",
                "结案": "已结案",
            }
            status = mapping.get(status, status)
            if status not in {"未处理", "处理中", "已结案"}:
                raise ValueError(f"不支持的 handle_status: {status}")
            record.handle_status = status

        # 更新其他普通字段
        for field in ["behavior_type", "evidence_path", "law_enforcement_id", "handle_result", "punishment_basis"]:
            if field in update_data and update_data[field] is not None:
                setattr(record, field, update_data[field])

        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def delete_illegal_record(db: Session, record_id: str) -> bool:
        record = db.get(models.非法行为记录表, record_id)
        if not record:
            return False
        db.delete(record)
        db.commit()
        return True

    # ========== 执法调度管理 ==========
    @staticmethod
    def query_dispatches(
        db: Session,
        dispatch_id: Optional[str] = None,
        record_id: Optional[str] = None,
        law_enforcement_id: Optional[str] = None,
        status: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[models.执法调度信息表]:
        q = select(models.执法调度信息表)
        if dispatch_id:
            q = q.where(models.执法调度信息表.dispatch_id == dispatch_id)
        if record_id:
            q = q.where(models.执法调度信息表.record_id == record_id)
        if law_enforcement_id:
            q = q.where(models.执法调度信息表.law_enforcement_id == law_enforcement_id)
        if status:
            q = q.where(models.执法调度信息表.dispatch_status == status)
        if start_time is not None:
            q = q.where(models.执法调度信息表.dispatch_time >= start_time)
        if end_time is not None:
            q = q.where(models.执法调度信息表.dispatch_time <= end_time)
        return db.scalars(q.order_by(desc(models.执法调度信息表.dispatch_time))).all()

    @staticmethod
    def create_dispatch_with_staff(db: Session, dispatch_data: dict) -> models.执法调度信息表:
        new_dispatch = models.执法调度信息表(
            dispatch_id=dispatch_data["dispatch_id"],
            record_id=dispatch_data["record_id"],
            law_enforcement_id=dispatch_data["law_enforcement_id"],
            dispatch_time=datetime.now(),
            dispatch_status="已派单"  
        )
        db.add(new_dispatch)
        db.commit()
        db.refresh(new_dispatch)
        return new_dispatch

    @staticmethod
    def create_dispatch_for_record(db: Session, record_id: str) -> models.执法调度信息表:
        """
        强制调度：执法人员ID 固定为 EF006
        不使用随机分配，不依赖 update_illegal_record 来设置 ID
        """
        record = db.get(models.非法行为记录表, record_id)
        if not record:
            raise ValueError("非法记录不存在")

        law_enforcement_id = "EF006"
        staff = db.get(models.执法人员信息表, law_enforcement_id)
        if not staff:
            raise ValueError("执法人员 EF006 不存在，请先创建该人员")

        dispatch_id = f"DIS_{record_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        # 创建调度记录
        new_dispatch = models.执法调度信息表(
            dispatch_id=dispatch_id,
            record_id=record_id,
            law_enforcement_id=law_enforcement_id,
            dispatch_time=datetime.now(),
            dispatch_status="已派单"
        )
        db.add(new_dispatch)

        # ⚡️ 直接修改非法记录字段（确保写入）
        record.law_enforcement_id = law_enforcement_id
        record.handle_status = "处理中"

        db.commit()
        db.refresh(new_dispatch)
        return new_dispatch

    @staticmethod
    def update_dispatch_status(db: Session, dispatch_id: str, dispatch_status: str) -> Optional[models.执法调度信息表]:
        dispatch = db.get(models.执法调度信息表, dispatch_id)
        if not dispatch:
            return None

        # 统一状态值
        if dispatch_status == "已分配":
            dispatch_status = "处理中"

        dispatch.dispatch_status = dispatch_status

        if dispatch_status == "已响应" and dispatch.response_time is None:
            dispatch.response_time = datetime.now()
        if dispatch_status == "已完成" and dispatch.complete_time is None:
            dispatch.complete_time = datetime.now()

        db.commit()
        db.refresh(dispatch)
        return dispatch

    @staticmethod
    def delete_dispatch(db: Session, dispatch_id: str) -> bool:
        dispatch = db.get(models.执法调度信息表, dispatch_id)
        if not dispatch:
            return False
        db.delete(dispatch)
        db.commit()
        return True