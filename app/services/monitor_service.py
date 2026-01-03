from app import db
from app.models import VideoMonitorPoint
from decimal import Decimal

class MonitorService:
    """视频监控点业务逻辑层"""

    @staticmethod
    def get_all():
        """查询所有监控点"""
        return VideoMonitorPoint.query.all()

    @staticmethod
    def get_by_id(monitor_point_id):
        """根据监控点ID查询单个记录"""
        if not monitor_point_id:
            return None
        return VideoMonitorPoint.query.get(monitor_point_id.strip())

    @staticmethod
    def create(data):
        """创建监控点（统一校验逻辑，处理空值）"""
        # 1. 过滤空值，统一转为None
        data = {k: v.strip() if isinstance(v, str) else v for k, v in data.items() if v is not None}
        data = {k: v if v != "" else None for k, v in data.items()}

        # 2. 校验必填字段
        required_fields = ['monitor_point_id', 'area_number', 'install_location_lng', 'install_location_lat']
        for field in required_fields:
            if field not in data or not data[field]:
                raise ValueError(f"缺少必填字段：{field}")

        # 3. 经纬度校验+转Decimal（直接处理原始值，避免float精度丢失）
        try:
            # 直接从原始字符串/数字转Decimal，跳过float环节
            lng = Decimal(str(data['install_location_lng']))
            lat = Decimal(str(data['install_location_lat']))
            if not (-180 <= lng <= 180):
                raise ValueError("经度必须在-180~180之间")
            if not (-90 <= lat <= 90):
                raise ValueError("纬度必须在-90~90之间")
        except (ValueError, Decimal.InvalidOperation) as e:
            raise ValueError(f"经纬度格式错误：{str(e)}（请传入数字，如116.403874）")

        # 4. 创建监控点对象
        monitor = VideoMonitorPoint(
            monitor_point_id=data['monitor_point_id'],
            area_number=data['area_number'],
            install_location_lng=lng,
            install_location_lat=lat,
            monitor_range=data.get('monitor_range'),
            device_status=data.get('device_status', '正常'),
            data_storage_cycle=data.get('data_storage_cycle', 90)
        )

        # 5. 事务提交
        try:
            db.session.add(monitor)
            db.session.commit()
            return monitor
        except Exception as e:
            db.session.rollback()
            raise Exception(f"创建监控点失败：{str(e)}")

    @staticmethod
    def update(monitor_point_id, data):
        """更新监控点（统一校验，处理空值）"""
        # 1. 过滤空值
        data = {k: v.strip() if isinstance(v, str) else v for k, v in data.items() if v is not None}
        data = {k: v if v != "" else None for k, v in data.items()}

        # 2. 查监控点
        monitor = VideoMonitorPoint.query.get(monitor_point_id)
        if not monitor:
            return None

        # 3. 经纬度更新校验
        if 'install_location_lng' in data and data['install_location_lng']:
            try:
                lng = Decimal(str(data['install_location_lng']))
                if not (-180 <= lng <= 180):
                    raise ValueError("经度必须在-180~180之间")
                monitor.install_location_lng = lng
            except (ValueError, Decimal.InvalidOperation) as e:
                raise ValueError(f"经度格式错误：{str(e)}")

        if 'install_location_lat' in data and data['install_location_lat']:
            try:
                lat = Decimal(str(data['install_location_lat']))
                if not (-90 <= lat <= 90):
                    raise ValueError("纬度必须在-90~90之间")
                monitor.install_location_lat = lat
            except (ValueError, Decimal.InvalidOperation) as e:
                raise ValueError(f"纬度格式错误：{str(e)}")

        # 4. 其他字段更新
        updatable_fields = ['area_number', 'monitor_range', 'device_status', 'data_storage_cycle']
        for field in updatable_fields:
            if field in data:
                val = data[field]
                # 设备状态校验
                if field == 'device_status' and val:
                    valid_status = ['正常', '故障', '维护中', '停用']
                    if val not in valid_status:
                        raise ValueError(f"设备状态无效，仅支持：{', '.join(valid_status)}")
                # 存储周期校验
                if field == 'data_storage_cycle' and val:
                    if not isinstance(val, int) or val <= 0:
                        raise ValueError("数据存储周期必须是正整数（天）")
                # 赋值（空值转None）
                setattr(monitor, field, val if val != "" else None)

        # 5. 提交更新
        try:
            db.session.commit()
            return monitor
        except Exception as e:
            db.session.rollback()
            raise Exception(f"更新监控点失败：{str(e)}")

    @staticmethod
    def delete(monitor_point_id):
        """删除监控点（增加空值校验）"""
        if not monitor_point_id:
            return False

        monitor = VideoMonitorPoint.query.get(monitor_point_id)
        if not monitor:
            return False

        try:
            db.session.delete(monitor)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise Exception(f"删除监控点失败：{str(e)}")

    @staticmethod
    def get_by_area(area_number):
        """按区域编号查询监控点"""
        if not area_number:
            return []
        return VideoMonitorPoint.query.filter_by(area_number=area_number.strip()).all()

    @staticmethod
    def get_by_status(device_status):
        """按设备状态查询监控点"""
        valid_status = ['正常', '故障', '维护中', '停用']
        if device_status not in valid_status:
            raise ValueError(f"设备状态无效，仅支持：{', '.join(valid_status)}")
        return VideoMonitorPoint.query.filter_by(device_status=device_status).all()