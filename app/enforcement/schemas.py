
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class StaffBase(BaseModel):
    staff_name: str
    department: str
    permission: Optional[str] = None
    contact: str
    equipment_number: Optional[str] = None


class StaffCreate(StaffBase):
    law_enforcement_id: str


class StaffUpdate(BaseModel):
    staff_name: Optional[str] = None
    department: Optional[str] = None
    permission: Optional[str] = None
    contact: Optional[str] = None
    equipment_number: Optional[str] = None


class Staff(StaffBase):
    law_enforcement_id: str

    class Config:
        from_attributes = True


class MonitorPointBase(BaseModel):
    area_number: str
    install_location_lng: float
    install_location_lat: float
    monitor_range: Optional[str] = None
    device_status: Optional[str] = None
    data_storage_cycle: Optional[int] = None


class MonitorPointCreate(MonitorPointBase):
    monitor_point_id: str


class MonitorPointUpdate(BaseModel):
    area_number: Optional[str] = None
    install_location_lng: Optional[float] = None
    install_location_lat: Optional[float] = None
    monitor_range: Optional[str] = None
    device_status: Optional[str] = None
    data_storage_cycle: Optional[int] = None


class MonitorPoint(MonitorPointBase):
    monitor_point_id: str

    class Config:
        from_attributes = True


class IllegalRecordBase(BaseModel):
    behavior_type: str
    evidence_path: Optional[str] = None
    law_enforcement_id: Optional[str] = None
    monitor_point_id: str


class IllegalRecordCreate(IllegalRecordBase):
    record_id: str


class IllegalRecordUpdate(BaseModel):
    behavior_type: Optional[str] = None
    evidence_path: Optional[str] = None
    law_enforcement_id: Optional[str] = None
    monitor_point_id: Optional[str] = None
    handle_status: Optional[str] = None
    handle_result: Optional[str] = None
    punishment_basis: Optional[str] = None


class IllegalRecord(BaseModel):
    record_id: str
    behavior_type: str
    occur_time: datetime
    area_number: str
    evidence_path: str
    handle_status: str
    law_enforcement_id: Optional[str] = None
    handle_result: Optional[str] = None
    punishment_basis: Optional[str] = None
    monitor_point_id: str

    class Config:
        from_attributes = True


class Dispatch(BaseModel):
    dispatch_id: str
    record_id: str
    law_enforcement_id: str
    dispatch_time: datetime
    response_time: Optional[datetime] = None
    complete_time: Optional[datetime] = None
    dispatch_status: str

    class Config:
        from_attributes = True


class DispatchStatusUpdate(BaseModel):
    dispatch_status: str = Field(..., description="调度状态")
