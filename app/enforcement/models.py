from sqlalchemy import Column, String, Integer, Boolean, Numeric, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.db import Base


class 执法人员信息表(Base):
    __tablename__ = "执法人员信息表"

    law_enforcement_id = Column(String(20), primary_key=True)
    staff_name = Column(String(30), nullable=False)
    department = Column(String(100), nullable=False)
    permission = Column(String(200))
    contact = Column(String(11), nullable=False)
    equipment_number = Column(String(30))
    # 新增以下2个字段（和数据库表保持一致）
    status = Column(String(20), nullable=False, default="在线")  # 对应数据库的status
    is_dispatched = Column(Boolean, nullable=False, default=False)  # 对应数据库的is_dispatched


class 视频监控点信息表(Base):
    __tablename__ = "视频监控点信息表"

    monitor_point_id = Column(String(30), primary_key=True)
    area_number = Column(String(20), nullable=False)
    install_location_lng = Column(Numeric(10, 6), nullable=False)
    install_location_lat = Column(Numeric(10, 6), nullable=False)
    monitor_range = Column(String(200))
    device_status = Column(String(20), nullable=False)
    data_storage_cycle = Column(Integer, nullable=False)


class 非法行为记录表(Base):
    __tablename__ = "非法行为记录表"

    record_id = Column(String(30), primary_key=True)
    behavior_type = Column(String(50), nullable=False)
    occur_time = Column(DateTime, nullable=False)
    area_number = Column(String(20), nullable=False)
    evidence_path = Column(String(500), nullable=False)
    handle_status = Column(String(20), nullable=False)
    law_enforcement_id = Column(String(20), ForeignKey("执法人员信息表.law_enforcement_id"))
    handle_result = Column(String(500))
    punishment_basis = Column(String(500))
    monitor_point_id = Column(String(30), ForeignKey("视频监控点信息表.monitor_point_id"), nullable=False)

    staff = relationship("执法人员信息表")
    monitor_point = relationship("视频监控点信息表")
    dispatches = relationship("执法调度信息表", back_populates="record")


class 执法调度信息表(Base):
    __tablename__ = "执法调度信息表"

    dispatch_id = Column(String(30), primary_key=True)
    record_id = Column(String(30), ForeignKey("非法行为记录表.record_id"), nullable=False)
    law_enforcement_id = Column(String(20), ForeignKey("执法人员信息表.law_enforcement_id"), nullable=False)
    dispatch_time = Column(DateTime, nullable=False)
    response_time = Column(DateTime)
    complete_time = Column(DateTime)
    dispatch_status = Column(String(20), nullable=False)

    record = relationship("非法行为记录表", back_populates="dispatches")
    staff = relationship("执法人员信息表")
