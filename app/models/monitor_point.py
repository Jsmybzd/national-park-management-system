# app/models/monitor_point.py
from app import db

class VideoMonitorPoint(db.Model):
    __tablename__ = '视频监控点信息表'

    monitor_point_id = db.Column(db.String(30), primary_key=True)
    area_number = db.Column(db.String(20), nullable=False)
    install_location_lng = db.Column(db.DECIMAL(10, 6), nullable=False)
    install_location_lat = db.Column(db.DECIMAL(10, 6), nullable=False)
    monitor_range = db.Column(db.String(200))
    device_status = db.Column(db.String(20), default='正常')
    data_storage_cycle = db.Column(db.Integer, default=90)

    def to_dict(self):
        return {
            'monitor_point_id': self.monitor_point_id,
            'area_number': self.area_number,
            'install_location_lng': float(self.install_location_lng) if self.install_location_lng else None,
            'install_location_lat': float(self.install_location_lat) if self.install_location_lat else None,
            'monitor_range': self.monitor_range,
            'device_status': self.device_status,
            'data_storage_cycle': self.data_storage_cycle
        }