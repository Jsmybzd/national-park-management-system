from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Float, Text, DECIMAL
from sqlalchemy.orm import relationship

from app.db import Base


class 区域表(Base):
    __tablename__ = "区域表"

    id = Column(Integer, primary_key=True, comment="栖息地编号")
    name = Column(String(100), nullable=False, comment="区域名称")
    type = Column(
        Enum("森林", "湿地", "草原", "荒漠", "山地", "水域", "核心保护区", "缓冲区", "实验区"),
        nullable=False,
        comment="生态类型",
    )
    area = Column(Float, nullable=False, comment="面积（公顷）")
    main_protect = Column(Text, comment="核心保护范围")

    main_species_id = Column(
        Integer,
        ForeignKey("物种表.id", ondelete="SET NULL"),
        comment="主要物种编号",
    )
    suitable_score = Column(Float, comment="环境适宜性评分")

    created_at = Column(DateTime, comment="创建时间")
    updated_at = Column(DateTime, comment="更新时间")
    lng = Column(DECIMAL(10,6), comment="经度")
    lat = Column(DECIMAL(10,6), comment="纬度")

    main_species = relationship(
        "物种表", foreign_keys=[main_species_id], backref="作为主要物种的区域"
    )
    devices = relationship("监测设备表", backref="deployment_area", cascade="all, delete-orphan")


class 监测设备表(Base):
    __tablename__ = "监测设备表"

    id = Column(Integer, primary_key=True, comment="设备编号")
    type = Column(
        Enum("空气质量传感器", "水质监测仪", "土壤湿度传感器", "红外相机", "无人机", "气象站"),
        nullable=False,
        comment="设备类型",
    )
    deployment_area_id = Column(
        Integer,
        ForeignKey("区域表.id", ondelete="SET NULL"),
        comment="部署区域编号",
    )
    install_time = Column(DateTime, nullable=False, comment="安装时间")
    calibration_cycle = Column(Integer, default=30, comment="校准周期（天）")
    last_calibration_time = Column(DateTime, comment="上次校准时间")
    status = Column(Enum("正常", "故障", "离线"), default="正常", comment="运行状态")
    communication_protocol = Column(String(50), comment="通信协议")
    latitude = Column(Float, comment="纬度")
    longitude = Column(Float, comment="经度")

    created_at = Column(DateTime, comment="创建时间")
    updated_at = Column(DateTime, comment="更新时间")

    biodiversity_records = relationship(
        "物种监测记录表", backref="device", cascade="all, delete-orphan"
    )
