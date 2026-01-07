USE NationalParkDB;
GO

-- ============================================
-- 科研数据模块示例数据
-- ============================================

-- 1. 插入科研项目数据
IF (SELECT COUNT(*) FROM dbo.[ResearchProjects]) < 3
BEGIN
    DELETE FROM dbo.[AuthorizedAccesses];
    DELETE FROM dbo.[ResearchAchievements];
    DELETE FROM dbo.[DataCollections];
    DELETE FROM dbo.[ResearchProjects];
    
    INSERT INTO dbo.[ResearchProjects] ([project_id], [project_name], [leader_id], [apply_unit], [approval_date], [conclusion_date], [status], [research_field]) VALUES
    ('PRJ_20240001', N'大熊猫栖息地生态修复研究', 'RS001', N'四川大学生命科学学院', '2024-01-15', NULL, N'在研', N'生态修复'),
    ('PRJ_20240002', N'国家公园珍稀鸟类多样性监测', 'RS002', N'中国科学院动物研究所', '2024-02-20', NULL, N'在研', N'物种保护'),
    ('PRJ_20240003', N'森林碳汇能力评估与预测模型', 'RS003', N'北京林业大学', '2023-06-01', '2024-06-01', N'已结题', N'环境监测'),
    ('PRJ_20240004', N'野生动物迁徙廊道规划研究', 'RS001', N'四川大学生命科学学院', '2024-03-10', NULL, N'在研', N'物种保护'),
    ('PRJ_20240005', N'濒危植物就地保护技术研究', 'RS004', N'中国科学院植物研究所', '2023-09-01', NULL, N'暂停', N'物种保护'),
    ('PRJ_20240006', N'生态系统服务功能价值评估', 'RS002', N'中国科学院动物研究所', '2024-04-01', NULL, N'在研', N'生物多样性');
    
    PRINT N'已插入6条科研项目数据';
END
GO

-- 2. 插入数据采集记录
IF (SELECT COUNT(*) FROM dbo.[DataCollections]) < 5
BEGIN
    DELETE FROM dbo.[DataCollections];
    
    INSERT INTO dbo.[DataCollections] ([collection_id], [project_id], [collector_id], [collection_time], [area_id], [content], [data_source], [remarks]) VALUES
    ('COL_20240101', 'PRJ_20240001', 'RS001', '2024-01-20 09:30:00', 'A1', N'样本编号: SP001-SP015，采集大熊猫粪便样本15份，用于DNA分析', N'实地采集', N'天气晴朗，采集顺利'),
    ('COL_20240102', 'PRJ_20240001', 'RS005', '2024-02-15 14:00:00', 'A2', N'样本编号: SP016-SP025，采集竹林土壤样本10份', N'实地采集', N'记录土壤湿度和温度'),
    ('COL_20240103', 'PRJ_20240002', 'RS002', '2024-03-01 07:00:00', 'B1', N'监测数据编号: MD001，调用红外相机监测数据，识别到珍稀鸟类12种', N'系统调用', N'调用2024年2月监测数据'),
    ('COL_20240104', 'PRJ_20240002', 'RS006', '2024-03-10 06:30:00', 'B2', N'调查记录: 观测到金雕1只，朱鹮3只，详细记录见附件', N'实地采集', N'春季迁徙观测'),
    ('COL_20240105', 'PRJ_20240003', 'RS003', '2023-08-15 10:00:00', 'C1', N'监测数据编号: MD002-MD010，调用森林碳通量监测站数据', N'系统调用', N'数据时间范围2023年6-8月'),
    ('COL_20240106', 'PRJ_20240004', 'RS001', '2024-04-01 08:00:00', 'A1', N'调查记录: 野生动物足迹调查，发现黑熊、野猪、麂子活动痕迹', N'实地采集', NULL),
    ('COL_20240107', 'PRJ_20240004', 'RS007', '2024-04-05 09:00:00', 'A3', N'监测数据编号: MD011，调用GPS项圈数据，分析野生动物活动轨迹', N'系统调用', N'数据来自3只装有项圈的野生动物'),
    ('COL_20240108', 'PRJ_20240006', 'RS002', '2024-04-20 11:00:00', 'B1', N'调查记录: 生态系统服务功能问卷调查，访谈当地居民30人', N'实地采集', N'社会经济调查部分');
    
    PRINT N'已插入8条数据采集记录';
END
GO

-- 3. 插入科研成果数据
IF (SELECT COUNT(*) FROM dbo.[ResearchAchievements]) < 3
BEGIN
    DELETE FROM dbo.[AuthorizedAccesses];
    DELETE FROM dbo.[ResearchAchievements];
    
    INSERT INTO dbo.[ResearchAchievements] ([achievement_id], [project_id], [achievement_type], [title], [publish_date], [share_permission], [file_path]) VALUES
    ('ACH_20240001', 'PRJ_20240003', N'论文', N'中国西南地区森林碳汇能力时空变化研究', '2024-05-15', N'公开', '/research/papers/forest_carbon_2024.pdf'),
    ('ACH_20240002', 'PRJ_20240003', N'报告', N'国家公园森林碳汇能力评估报告（2023年度）', '2024-06-01', N'内部共享', '/research/reports/carbon_assessment_2023.pdf'),
    ('ACH_20240003', 'PRJ_20240002', N'论文', N'基于红外相机的珍稀鸟类活动节律研究', '2024-04-10', N'公开', '/research/papers/bird_monitoring_2024.pdf'),
    ('ACH_20240004', 'PRJ_20240001', N'专利', N'一种大熊猫粪便DNA快速提取方法', '2024-03-20', N'保密', '/research/patents/panda_dna_extraction.pdf'),
    ('ACH_20240005', 'PRJ_20240004', N'报告', N'野生动物迁徙廊道规划初步方案', '2024-04-25', N'内部共享', '/research/reports/wildlife_corridor_plan.pdf'),
    ('ACH_20240006', 'PRJ_20240003', N'软件著作权', N'森林碳汇预测模型软件V1.0', '2024-05-30', N'保密', '/research/software/carbon_model_v1.exe');
    
    PRINT N'已插入6条科研成果数据';
END
GO

-- 4. 插入授权访问记录（针对保密成果）
IF (SELECT COUNT(*) FROM dbo.[AuthorizedAccesses]) < 2
BEGIN
    DELETE FROM dbo.[AuthorizedAccesses];
    
    -- 为保密成果添加授权记录
    INSERT INTO dbo.[AuthorizedAccesses] ([achievement_id], [user_id], [authorize_time]) VALUES
    ('ACH_20240004', 'RS001', GETDATE()),
    ('ACH_20240004', 'RS005', GETDATE()),
    ('ACH_20240006', 'RS003', GETDATE()),
    ('ACH_20240006', 'RS002', GETDATE());
    
    PRINT N'已插入4条授权访问记录';
END
GO

PRINT N'科研数据模块示例数据插入完成';
GO
