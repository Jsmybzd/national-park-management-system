# schemas.py
from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional

# 科研项目
class ResearchProjectBase(BaseModel):
    project_id: str
    project_name: str
    leader_id: str
    apply_unit: str
    approval_date: date
    conclusion_date: Optional[date] = None
    status: str = "在研"
    research_field: str

class ResearchProjectCreate(ResearchProjectBase):
    pass

class ResearchProject(ResearchProjectBase):
    class Config:
        from_attributes = True


# 数据采集记录
class DataCollectionBase(BaseModel):
    collection_id: str
    project_id: str
    collector_id: str
    collection_time: datetime
    area_id: str
    content: str
    data_source: str
    remarks: Optional[str] = None

class DataCollectionCreate(DataCollectionBase):
    pass

class DataCollection(DataCollectionBase):
    class Config:
        from_attributes = True


# 科研成果
class ResearchAchievementBase(BaseModel):
    achievement_id: str
    project_id: str
    achievement_type: str
    title: str
    publish_date: date
    share_permission: str
    file_path: str

class ResearchAchievementCreate(ResearchAchievementBase):
    pass

class ResearchAchievement(ResearchAchievementBase):
    class Config:
        from_attributes = True


# 授权访问
class AuthorizedAccessBase(BaseModel):
    achievement_id: str
    user_id: str
    authorize_time: Optional[datetime] = None

class AuthorizedAccessCreate(AuthorizedAccessBase):
    pass

class AuthorizedAccess(AuthorizedAccessBase):
    access_id: int
    class Config:
        from_attributes = True


# 新增响应模型（从models.py迁移过来）
class ProjectAuditResponse(BaseModel):
    status: str
    message: str
    audit_user: Optional[str] = None
    project_info: Optional[ResearchProject] = None

class CollectionCreateResponse(BaseModel):
    status: str
    message: str
    collection_info: Optional[DataCollection] = None