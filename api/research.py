from fastapi import APIRouter, HTTPException, Depends, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime, date
from database import get_db
# 导入加了DB_前缀的数据库模型
from models import DB_ResearchProject, DB_DataCollection, DB_ResearchAchievement, DB_AuthorizedAccess
from schemas import (
    ResearchProjectCreate, ResearchProject,
    DataCollectionCreate, DataCollection,
    ResearchAchievementCreate, ResearchAchievement,
    AuthorizedAccessCreate, AuthorizedAccess,
    ProjectAuditResponse, CollectionCreateResponse
)

router = APIRouter(prefix="/research", tags=["科研数据支撑"])

# -------------------------- 公共工具函数 --------------------------
def check_project_id_exists(project_id: str, db: Session) -> bool:
    """检查项目编号是否已存在"""
    return db.query(DB_ResearchProject).filter(DB_ResearchProject.project_id == project_id).first() is not None

def check_collection_id_exists(collection_id: str, db: Session) -> bool:
    """检查采集编号是否已存在"""
    return db.query(DB_DataCollection).filter(DB_DataCollection.collection_id == collection_id).first() is not None

# -------------------------- 科研项目管理 --------------------------
@router.post("/projects", response_model=ResearchProject, summary="创建科研项目（直接创建）")
def create_project(project: ResearchProjectCreate, db: Session = Depends(get_db)):
    try:
        if check_project_id_exists(project.project_id, db):
            raise HTTPException(status_code=400, detail="项目编号已存在")
        
        # 转换日期类型
        approval_date = project.approval_date
        if isinstance(approval_date, str):
            approval_date = datetime.strptime(approval_date, "%Y-%m-%d").date()
        
        # 使用DB_前缀的数据库模型
        new_project = DB_ResearchProject(
            project_id=project.project_id,
            project_name=project.project_name,
            leader_id=project.leader_id,
            apply_unit=project.apply_unit,
            approval_date=approval_date,
            conclusion_date=project.conclusion_date,
            status=project.status,
            research_field=project.research_field
        )
        db.add(new_project)
        db.commit()
        db.refresh(new_project)
        return new_project
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据库操作异常：创建项目失败: {str(e)}")
    except HTTPException as e:
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"未知异常：创建项目失败: {str(e)}")

@router.get("/projects/{project_id}", response_model=ResearchProject, summary="查询单个科研项目")
def get_project(project_id: str, db: Session = Depends(get_db)):
    # 使用DB_前缀的数据库模型
    project = db.query(DB_ResearchProject).filter(DB_ResearchProject.project_id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project

# -------------------------- 项目申请审核 --------------------------
def submit_and_audit_project(
    project_apply_info: ResearchProjectCreate,
    audit_user_id: str,        
    is_approved: bool,         
    db: Session                
) -> dict:
    try:
        if not all([project_apply_info.project_id, project_apply_info.project_name, 
                   project_apply_info.leader_id, project_apply_info.apply_unit, 
                   project_apply_info.approval_date, project_apply_info.research_field]):
            return {
                "status": "failed",
                "message": "项目申请失败：缺少必传字段",
                "audit_user": audit_user_id,
                "project_info": None
            }
        
        if check_project_id_exists(project_apply_info.project_id, db):
            return {
                "status": "failed",
                "message": f"项目申请失败：项目编号「{project_apply_info.project_id}」已存在",
                "audit_user": audit_user_id,
                "project_info": None
            }
        
        if not is_approved:
            return {
                "status": "failed",
                "message": f"项目「{project_apply_info.project_name}」审核未通过，未生成项目信息",
                "audit_user": audit_user_id,
                "project_info": None
            }
        
        # 转换日期类型
        approval_date = project_apply_info.approval_date
        if isinstance(approval_date, str):
            approval_date = datetime.strptime(approval_date, "%Y-%m-%d").date()
        
        # 使用DB_前缀的数据库模型
        new_project = DB_ResearchProject(
            project_id=project_apply_info.project_id,
            project_name=project_apply_info.project_name,
            leader_id=project_apply_info.leader_id,
            apply_unit=project_apply_info.apply_unit,
            approval_date=approval_date,
            conclusion_date=None,
            status="在研",
            research_field=project_apply_info.research_field
        )
        db.add(new_project)
        db.commit()
        db.refresh(new_project)
        
        project_info = {
            "project_id": new_project.project_id,
            "project_name": new_project.project_name,
            "leader_id": new_project.leader_id,
            "apply_unit": new_project.apply_unit,
            "approval_date": new_project.approval_date.isoformat() if new_project.approval_date else None,
            "conclusion_date": new_project.conclusion_date.isoformat() if new_project.conclusion_date else None,
            "status": new_project.status,
            "research_field": new_project.research_field
        }
        
        return {
            "status": "success",
            "message": f"项目「{new_project.project_name}」审核通过，已生成科研项目信息",
            "audit_user": audit_user_id,
            "project_info": project_info
        }
    
    except SQLAlchemyError as e:
        db.rollback()
        return {
            "status": "error",
            "message": f"数据库操作异常：项目申请审核失败: {str(e)}",
            "audit_user": audit_user_id,
            "project_info": None
        }
    except Exception as e:
        db.rollback()
        return {
            "status": "error",
            "message": f"未知异常：项目申请审核失败: {str(e)}",
            "audit_user": audit_user_id,
            "project_info": None
        }

@router.post("/projects/apply-audit", response_model=ProjectAuditResponse, summary="项目申请提交+审核（核心功能）")
def api_submit_and_audit_project(
    project_apply_info: ResearchProjectCreate = Body(
        examples=[
            {
                "summary": "正常示例",
                "value": {
                    "project_id": "XM021",
                    "project_name": "华南虎野化训练研究",
                    "leader_id": "U021",
                    "apply_unit": "广东野生动物保护中心",
                    "approval_date": "2024-09-01",
                    "status": "在研",
                    "research_field": "物种保护"
                }
            }
        ]
    ),
    audit_user_id: str = Body(
        examples=[
            {
                "summary": "正常示例",
                "value": "U999"
            }
        ]
    ),
    is_approved: bool = Body(
        examples=[
            {
                "summary": "正常示例",
                "value": True
            }
        ]
    ),
    db: Session = Depends(get_db)
):
    result = submit_and_audit_project(
        project_apply_info=project_apply_info,
        audit_user_id=audit_user_id,
        is_approved=is_approved,
        db=db
    )
    return result

# -------------------------- 数据采集记录管理 --------------------------
@router.post("/collections", response_model=DataCollection, summary="创建采集记录（直接创建）")
def create_collection(collection: DataCollectionCreate, db: Session = Depends(get_db)):
    try:
        # 使用DB_前缀的数据库模型
        project = db.query(DB_ResearchProject).filter(DB_ResearchProject.project_id == collection.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="关联项目不存在")
        if project.status == "已结题":
            raise HTTPException(status_code=400, detail="项目已结题，无法新增采集记录")
        
        if check_collection_id_exists(collection.collection_id, db):
            raise HTTPException(status_code=400, detail="采集编号已存在")
        
        # 转换时间类型
        collection_time = collection.collection_time
        if isinstance(collection_time, str):
            collection_time = datetime.fromisoformat(collection_time)
        
        # 使用DB_前缀的数据库模型
        new_collection = DB_DataCollection(
            collection_id=collection.collection_id,
            project_id=collection.project_id,
            collector_id=collection.collector_id,
            collection_time=collection_time,
            area_id=collection.area_id,
            content=collection.content,
            data_source=collection.data_source,
            remarks=collection.remarks
        )
        db.add(new_collection)
        db.commit()
        db.refresh(new_collection)
        return new_collection
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据库操作异常：创建采集记录失败: {str(e)}")
    except HTTPException as e:
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"未知异常：创建采集记录失败: {str(e)}")

@router.put("/collections/{collection_id}/remarks", summary="更新采集记录备注")
def update_collection_remarks(collection_id: str, remarks: str, db: Session = Depends(get_db)):
    try:
        # 使用DB_前缀的数据库模型
        collection = db.query(DB_DataCollection).filter(DB_DataCollection.collection_id == collection_id).first()
        if not collection:
            raise HTTPException(status_code=404, detail="采集记录不存在")
        
        collection.remarks = remarks
        db.commit()
        return {"message": "备注更新成功"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据库操作异常：更新备注失败: {str(e)}")
    except HTTPException as e:
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"未知异常：更新备注失败: {str(e)}")

# -------------------------- 采集数据录入/调用 --------------------------
def create_collection_record(
    collection_info: DataCollectionCreate,
    data_type: str,
    db: Session
) -> dict:
    try:
        if not all([collection_info.collection_id, collection_info.project_id, 
                   collection_info.collector_id, collection_info.collection_time, 
                   collection_info.area_id, collection_info.content]):
            return {
                "status": "failed",
                "message": "采集记录创建失败：缺少必传字段",
                "collection_info": None
            }
        
        if data_type not in ["input", "call"]:
            return {
                "status": "failed",
                "message": "数据类型仅支持：input(实地录入)/call(系统调用)",
                "collection_info": None
            }
        
        # 使用DB_前缀的数据库模型
        project = db.query(DB_ResearchProject).filter(DB_ResearchProject.project_id == collection_info.project_id).first()
        if not project:
            return {
                "status": "failed",
                "message": f"采集记录创建失败：关联项目「{collection_info.project_id}」不存在",
                "collection_info": None
            }
        if project.status == "已结题":
            return {
                "status": "failed",
                "message": f"采集记录创建失败：项目「{project.project_name}」已结题，仅可补充备注，不可新增采集记录",
                "collection_info": None
            }
        
        if check_collection_id_exists(collection_info.collection_id, db):
            return {
                "status": "failed",
                "message": f"采集记录创建失败：采集编号「{collection_info.collection_id}」已存在",
                "collection_info": None
            }
        
        # 转换时间类型
        collection_time = collection_info.collection_time
        if isinstance(collection_time, str):
            collection_time = datetime.fromisoformat(collection_time)
        
        data_source_map = {"input": "实地采集", "call": "系统调用"}
        # 使用DB_前缀的数据库模型
        new_collection = DB_DataCollection(
            collection_id=collection_info.collection_id,
            project_id=collection_info.project_id,
            collector_id=collection_info.collector_id,
            collection_time=collection_time,
            area_id=collection_info.area_id,
            content=collection_info.content,
            data_source=data_source_map[data_type],
            remarks=collection_info.remarks or ""
        )
        db.add(new_collection)
        db.commit()
        db.refresh(new_collection)
        
        collection_info = {
            "collection_id": new_collection.collection_id,
            "project_id": new_collection.project_id,
            "collector_id": new_collection.collector_id,
            "collection_time": new_collection.collection_time.isoformat() if new_collection.collection_time else None,
            "area_id": new_collection.area_id,
            "content": new_collection.content,
            "data_source": new_collection.data_source,
            "remarks": new_collection.remarks or ""
        }
        
        return {
            "status": "success",
            "message": f"{'录入' if data_type=='input' else '调用'}采集数据成功，已生成采集记录",
            "collection_info": collection_info
        }
    
    except SQLAlchemyError as e:
        db.rollback()
        return {
            "status": "error",
            "message": f"数据库操作异常：采集记录创建失败: {str(e)}",
            "collection_info": None
        }
    except Exception as e:
        db.rollback()
        return {
            "status": "error",
            "message": f"未知异常：采集记录创建失败: {str(e)}",
            "collection_info": None
        }

@router.post("/collections/create", response_model=CollectionCreateResponse, summary="录入/调用采集数据生成记录（核心功能）")
def api_create_collection_record(
    collection_info: DataCollectionCreate = Body(  # 嵌套接收
        examples=[
            {
                "summary": "正常示例",
                "value": {
                    "collection_id": "CJ021",
                    "project_id": "XM021",
                    "collector_id": "U021",
                    "collection_time": "2024-09-05T10:00:00",
                    "area_id": "AQ021",
                    "content": "华南虎行为观察记录：XH001-XH020",
                    "data_source": "实地采集",
                    "remarks": "首次野化训练数据"
                }
            }
        ]
    ),
    data_type: str = Query(
        default="input",
        examples=[
            {
                "summary": "正常示例",
                "value": "input"
            }
        ],
        description="数据类型：input(实地录入)/call(系统调用)"
    ),
    db: Session = Depends(get_db)
):
    result = create_collection_record(
        collection_info=collection_info,
        data_type=data_type,
        db=db
    )
    return result

# -------------------------- 科研成果管理 --------------------------
@router.post("/achievements", response_model=ResearchAchievement, summary="创建科研成果")
def create_achievement(achievement: ResearchAchievementCreate, db: Session = Depends(get_db)):
    try:
        # 使用DB_前缀的数据库模型
        project = db.query(DB_ResearchProject).filter(DB_ResearchProject.project_id == achievement.project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="关联项目不存在")
        
        # 使用DB_前缀的数据库模型
        db_achievement = db.query(DB_ResearchAchievement).filter(DB_ResearchAchievement.achievement_id == achievement.achievement_id).first()
        if db_achievement:
            raise HTTPException(status_code=400, detail="成果编号已存在")
        
        # 转换日期类型
        publish_date = achievement.publish_date
        if isinstance(publish_date, str):
            publish_date = datetime.strptime(publish_date, "%Y-%m-%d").date()
        
        # 使用DB_前缀的数据库模型
        new_achievement = DB_ResearchAchievement(
            achievement_id=achievement.achievement_id,
            project_id=achievement.project_id,
            achievement_type=achievement.achievement_type,
            title=achievement.title,
            publish_date=publish_date,
            share_permission=achievement.share_permission,
            file_path=achievement.file_path
        )
        db.add(new_achievement)
        db.commit()
        db.refresh(new_achievement)
        return new_achievement
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据库操作异常：创建成果记录失败: {str(e)}")
    except HTTPException as e:
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"未知异常：创建成果记录失败: {str(e)}")

@router.get("/achievements/{achievement_id}", response_model=ResearchAchievement, summary="查询单个科研成果（含权限校验）")
def get_achievement(
    achievement_id: str,
    user_id: str = Query(..., description="访问用户ID"),
    db: Session = Depends(get_db)
):
    # 使用DB_前缀的数据库模型
    achievement = db.query(DB_ResearchAchievement).filter(DB_ResearchAchievement.achievement_id == achievement_id).first()
    if not achievement:
        raise HTTPException(status_code=404, detail="成果不存在")
    
    if achievement.share_permission == "保密":
        # 使用DB_前缀的数据库模型
        authorized = db.query(DB_AuthorizedAccess).filter(
            DB_AuthorizedAccess.achievement_id == achievement_id,
            DB_AuthorizedAccess.user_id == user_id
        ).first()
        if not authorized:
            raise HTTPException(status_code=403, detail="无权限访问保密成果")
    return achievement

# -------------------------- 授权管理 --------------------------
@router.post("/authorizations", response_model=AuthorizedAccess, summary="新增保密成果授权访问")
def authorize_access(auth: AuthorizedAccessCreate, db: Session = Depends(get_db)):
    try:
        # 使用DB_前缀的数据库模型
        achievement = db.query(DB_ResearchAchievement).filter(DB_ResearchAchievement.achievement_id == auth.achievement_id).first()
        if not achievement:
            raise HTTPException(status_code=404, detail="成果不存在")
        if achievement.share_permission != "保密":
            raise HTTPException(status_code=400, detail="仅保密成果需要授权")
        
        # 使用DB_前缀的数据库模型
        existing_auth = db.query(DB_AuthorizedAccess).filter(
            DB_AuthorizedAccess.achievement_id == auth.achievement_id,
            DB_AuthorizedAccess.user_id == auth.user_id
        ).first()
        if existing_auth:
            raise HTTPException(status_code=400, detail="该用户已获得此成果的授权")
        
        # 若未指定授权时间，使用当前时间
        authorize_time = auth.authorize_time or datetime.now()
        
        # 使用DB_前缀的数据库模型
        new_auth = DB_AuthorizedAccess(
            achievement_id=auth.achievement_id,
            user_id=auth.user_id,
            authorize_time=authorize_time
        )
        db.add(new_auth)
        db.commit()
        db.refresh(new_auth)
        return new_auth
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"数据库操作异常：授权失败: {str(e)}")
    except HTTPException as e:
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"未知异常：授权失败: {str(e)}")