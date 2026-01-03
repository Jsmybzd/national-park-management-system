from app import db
from decimal import Decimal

class VideoMonitorPoint(db.Model):
    __tablename__ = '视频监控点信息表'

    monitor_point_id = db.Column(db.String(30), primary_key=True, comment="监控点编号（如MON001）")
    area_number = db.Column(db.String(20), nullable=False, comment="监控点所属区域编号")
    install_location_lng = db.Column(db.Numeric(10, 6), nullable=False, comment="安装位置经度")
    install_location_lat = db.Column(db.Numeric(10, 6), nullable=False, comment="安装位置纬度")
    monitor_range = db.Column(db.String(200), comment="监控覆盖范围")
    device_status = db.Column(db.String(20), default='正常', comment="设备状态：正常/故障/维护中")
    data_storage_cycle = db.Column(db.Integer, default=90, comment="数据存储周期（天）")

    def to_dict(self):
        return {
            'monitor_point_id': self.monitor_point_id,
            'area_number': self.area_number,
            # 优化：Decimal转float更简洁的写法
            'install_location_lng': float(self.install_location_lng) if self.install_location_lng else None,
            'install_location_lat': float(self.install_location_lat) if self.install_location_lat else None,
            'monitor_range': self.monitor_range,
            'device_status': self.device_status,
            'data_storage_cycle': self.data_storage_cycle
        }