"""
执法监管API路由
处理执法人员管理、监控点管理、非法行为记录、执法调度等功能
支持系统管理员、公园管理人员、执法人员等角色
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc, and_
from datetime import datetime, timedelta

from app.db import get_db
from app.core import models  # 导入核心模型（User）
from app.core.api import get_current_user  # 复用core的认证依赖

# 导入本地模块
from . import schemas
from .queries import EnforcementQueries


# ========== 核心配置（和core/api.py完全一致） ==========
router = APIRouter(prefix="/enforcement", tags=["执法监管"])
__all__ = ["router"]  # 关键：暴露router，让_optional_router能读到


# ========== 权限检查函数（复用core的角色逻辑） ==========
def _require_roles(user: models.User, allowed: List[str], detail: str = "权限不足"):
    """检查用户角色是否符合要求"""
    if user.role_type not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


# ========== 执法人员管理接口 ==========
@router.get("/staff", response_model=List[schemas.Staff])
def list_staff(
    department: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),  # 复用core的认证
):
    """获取执法人员列表"""
    _require_roles(current_user, ["系统管理员", "公园管理人员", "执法人员"], "需要执法人员/管理人员权限")
    return EnforcementQueries.list_staff(db, department)


@router.get("/staff/{law_enforcement_id}", response_model=schemas.Staff)
def get_staff(
    law_enforcement_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取单个执法人员信息"""
    _require_roles(current_user, ["系统管理员", "公园管理人员", "执法人员"], "需要执法人员/管理人员权限")
    staff = EnforcementQueries.get_staff(db, law_enforcement_id)
    if not staff:
        raise HTTPException(status_code=404, detail="执法人员不存在")
    return staff


@router.post("/staff", response_model=schemas.Staff, status_code=201)
def create_staff(
    payload: schemas.StaffCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """创建执法人员"""
    _require_roles(current_user, ["系统管理员", "公园管理人员"], "需要系统管理员或公园管理人员权限")
    existing = EnforcementQueries.get_staff(db, payload.law_enforcement_id)
    if existing:
        raise HTTPException(status_code=400, detail="执法人员ID已存在")
    return EnforcementQueries.create_staff(db, payload)


@router.put("/staff/{law_enforcement_id}", response_model=schemas.Staff)
def update_staff(
    law_enforcement_id: str,
    payload: schemas.StaffUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """更新执法人员信息"""
    _require_roles(current_user, ["系统管理员", "公园管理人员"], "需要系统管理员或公园管理人员权限")
    updated = EnforcementQueries.update_staff(db, law_enforcement_id, payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="执法人员不存在")
    return updated


@router.delete("/staff/{law_enforcement_id}")
def delete_staff(
    law_enforcement_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """删除执法人员"""
    _require_roles(current_user, ["系统管理员"], "需要系统管理员权限")
    ok = EnforcementQueries.delete_staff(db, law_enforcement_id)
    if not ok:
        raise HTTPException(status_code=404, detail="执法人员不存在")
    return {"success": True}


# ========== 监控点管理接口 ==========
@router.get("/monitor", response_model=List[schemas.MonitorPoint])
def list_monitor_points(
    area_number: Optional[str] = Query(None),
    device_status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取监控点列表"""
    _require_roles(current_user, ["系统管理员", "公园管理人员", "执法人员"], "需要执法人员/管理人员权限")
    return EnforcementQueries.list_monitor_points(db, area_number, device_status)


@router.get("/monitor/{monitor_point_id}", response_model=schemas.MonitorPoint)
def get_monitor_point(
    monitor_point_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取单个监控点信息"""
    _require_roles(current_user, ["系统管理员", "公园管理人员", "执法人员"], "需要执法人员/管理人员权限")
    mp = EnforcementQueries.get_monitor_point(db, monitor_point_id)
    if not mp:
        raise HTTPException(status_code=404, detail="监控点不存在")
    return mp


@router.post("/monitor", response_model=schemas.MonitorPoint, status_code=201)
def create_monitor_point(
    payload: schemas.MonitorPointCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """创建监控点"""
    _require_roles(current_user, ["系统管理员", "公园管理人员"], "需要系统管理员或公园管理人员权限")
    existing = EnforcementQueries.get_monitor_point(db, payload.monitor_point_id)
    if existing:
        raise HTTPException(status_code=400, detail="监控点ID已存在")
    return EnforcementQueries.create_monitor_point(db, payload)


@router.post("/monitor/batch")
def batch_create_monitor_points(
    payload: List[schemas.MonitorPointCreate],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """批量创建监控点"""
    _require_roles(current_user, ["系统管理员", "公园管理人员"], "需要系统管理员或公园管理人员权限")
    success_data = []
    fail_data = []
    for idx, item in enumerate(payload):
        try:
            if EnforcementQueries.get_monitor_point(db, item.monitor_point_id):
                raise ValueError("监控点ID已存在")
            created = EnforcementQueries.create_monitor_point(db, item)
            success_data.append(schemas.MonitorPoint.model_validate(created).model_dump())
        except Exception as e:
            fail_data.append({"index": idx + 1, "error": str(e)})
    return {
        "success_count": len(success_data),
        "fail_count": len(fail_data),
        "success_data": success_data,
        "fail_data": fail_data,
    }


@router.put("/monitor/{monitor_point_id}", response_model=schemas.MonitorPoint)
def update_monitor_point(
    monitor_point_id: str,
    payload: schemas.MonitorPointUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """更新监控点信息"""
    _require_roles(current_user, ["系统管理员", "公园管理人员"], "需要系统管理员或公园管理人员权限")
    updated = EnforcementQueries.update_monitor_point(db, monitor_point_id, payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="监控点不存在")
    return updated


@router.delete("/monitor/{monitor_point_id}")
def delete_monitor_point(
    monitor_point_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """删除监控点"""
    _require_roles(current_user, ["系统管理员"], "需要系统管理员权限")
    ok = EnforcementQueries.delete_monitor_point(db, monitor_point_id)
    if not ok:
        raise HTTPException(status_code=404, detail="监控点不存在")
    return {"success": True}


# ========== 非法行为记录接口 ==========
@router.get("/records", response_model=List[schemas.IllegalRecord])
def list_records(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取非法行为记录列表"""
    _require_roles(current_user, ["系统管理员", "公园管理人员", "执法人员"], "需要执法人员/管理人员权限")
    return EnforcementQueries.list_illegal_records(db)


@router.get("/records/{record_id}", response_model=schemas.IllegalRecord)
def get_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """获取单个非法行为记录"""
    _require_roles(current_user, ["系统管理员", "公园管理人员", "执法人员"], "需要执法人员/管理人员权限")
    r = EnforcementQueries.get_illegal_record(db, record_id)
    if not r:
        raise HTTPException(status_code=404, detail="记录不存在")
    return r


@router.post("/records", response_model=schemas.IllegalRecord, status_code=201)
def create_record(
    payload: schemas.IllegalRecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """创建非法行为记录"""
    _require_roles(current_user, ["系统管理员", "公园管理人员", "执法人员"], "需要执法人员/管理人员权限")
    if EnforcementQueries.get_illegal_record(db, payload.record_id):
        raise HTTPException(status_code=400, detail="记录ID已存在")
    try:
        return EnforcementQueries.create_illegal_record(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/records/{record_id}", response_model=schemas.IllegalRecord)
def update_record(
    record_id: str,
    payload: schemas.IllegalRecordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """更新非法行为记录"""
    _require_roles(current_user, ["系统管理员", "公园管理人员", "执法人员"], "需要执法人员/管理人员权限")
    try:
        updated = EnforcementQueries.update_illegal_record(db, record_id, payload.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not updated:
        raise HTTPException(status_code=404, detail="记录不存在")
    return updated


@router.delete("/records/{record_id}")
def delete_record(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """删除非法行为记录"""
    _require_roles(current_user, ["系统管理员"], "需要系统管理员权限")
    ok = EnforcementQueries.delete_illegal_record(db, record_id)
    if not ok:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"success": True}


# ========== 执法调度接口 ==========
@router.get("/dispatch", response_model=List[schemas.Dispatch])
def query_dispatches(
    dispatch_id: Optional[str] = Query(None),
    record_id: Optional[str] = Query(None),
    law_enforcement_id: Optional[str] = Query(None),
    status_value: Optional[str] = Query(None, alias="status"),
    start_time: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_time: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """查询执法调度记录"""
    _require_roles(current_user, ["系统管理员", "公园管理人员", "执法人员"], "需要执法人员/管理人员权限")

    start_dt = None
    end_dt = None
    if start_time:
        try:
            start_dt = datetime.strptime(start_time, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="start_time格式错误，需为YYYY-MM-DD")
    if end_time:
        try:
            end_dt = datetime.strptime(end_time, "%Y-%m-%d") + timedelta(days=1) - timedelta(seconds=1)
        except ValueError:
            raise HTTPException(status_code=400, detail="end_time格式错误，需为YYYY-MM-DD")

    dispatches = EnforcementQueries.query_dispatches(
        db,
        dispatch_id=dispatch_id,
        record_id=record_id,
        law_enforcement_id=law_enforcement_id,
        status=status_value,
        start_time=start_dt,
        end_time=end_dt,
    )
    if dispatch_id and not dispatches:
        raise HTTPException(status_code=404, detail="调度记录不存在")
    return dispatches


@router.get("/dispatch/create-by-procedure/{record_id}", response_model=schemas.Dispatch, status_code=201)
def create_dispatch_by_procedure(
    record_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """创建执法调度（现固定分配给 EF006）"""
    _require_roles(current_user, ["系统管理员", "公园管理人员"], "需要系统管理员或公园管理人员权限")
    try:
        dispatch = EnforcementQueries.create_dispatch_for_record(db, record_id)
        return dispatch
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"调度失败：{str(e)}")


@router.put("/dispatch/{dispatch_id}/status", response_model=schemas.Dispatch)
def update_dispatch_status(
    dispatch_id: str,
    payload: schemas.DispatchStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """更新调度状态"""
    _require_roles(current_user, ["系统管理员", "公园管理人员", "执法人员"], "需要执法人员/管理人员权限")
    updated = EnforcementQueries.update_dispatch_status(db, dispatch_id, payload.dispatch_status)
    if not updated:
        raise HTTPException(status_code=404, detail="调度记录不存在")
    return updated


@router.delete("/dispatch/{dispatch_id}", status_code=204)
def delete_dispatch(
    dispatch_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """删除调度记录"""
    _require_roles(current_user, ["系统管理员"], "需要系统管理员权限")
    ok = EnforcementQueries.delete_dispatch(db, dispatch_id)
    if not ok:
        raise HTTPException(status_code=404, detail="调度记录不存在")
    return None