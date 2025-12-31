# -------------------------- 完整的 models.py --------------------------
from sqlalchemy import Column, String, DateTime, Date, Text, ForeignKey, Integer
from sqlalchemy.sql import func
from database import Base

# 科研项目表（数据库模型，加DB_前缀避免冲突）
class DB_ResearchProject(Base):
    __tablename__ = "ResearchProjects"
    
    project_id = Column(String(50), primary_key=True, index=True)
    project_name = Column(String(200), nullable=False)
    leader_id = Column(String(50), nullable=False)
    apply_unit = Column(String(100), nullable=False)
    approval_date = Column(Date, nullable=False)
    conclusion_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="在研")
    research_field = Column(String(50), nullable=False)

# 数据采集记录表
class DB_DataCollection(Base):
    __tablename__ = "DataCollections"
    
    collection_id = Column(String(50), primary_key=True, index=True)
    project_id = Column(String(50), ForeignKey("ResearchProjects.project_id"), nullable=False)
    collector_id = Column(String(50), nullable=False)
    collection_time = Column(DateTime, nullable=False)
    area_id = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    data_source = Column(String(20), nullable=False)
    remarks = Column(Text, nullable=True)

# 科研成果表
class DB_ResearchAchievement(Base):
    __tablename__ = "ResearchAchievements"
    
    achievement_id = Column(String(50), primary_key=True, index=True)
    project_id = Column(String(50), ForeignKey("ResearchProjects.project_id"), nullable=False)
    achievement_type = Column(String(20), nullable=False)
    title = Column(String(200), nullable=False)
    publish_date = Column(Date, nullable=False)
    share_permission = Column(String(20), nullable=False)
    file_path = Column(String(255), nullable=False)

# 授权访问表
class DB_AuthorizedAccess(Base):
    __tablename__ = "AuthorizedAccesses"
    
    # 关键：Integer 已导入，此处无语法错误
    access_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    achievement_id = Column(String(50), ForeignKey("ResearchAchievements.achievement_id"), nullable=False)
    user_id = Column(String(50), nullable=False)
    authorize_time = Column(DateTime, default=func.now(), nullable=False)