-- 全模块种子数据
USE NationalParkDB;
GO

PRINT N'=== 插入种子数据 ===';

-- ============================================
-- 1. 共享表：区域表、监测设备表
-- ============================================
IF NOT EXISTS (SELECT 1 FROM 区域表 WHERE id = 1)
BEGIN
    SET IDENTITY_INSERT 区域表 ON;
    INSERT INTO 区域表 (id, area_name, area_type, area_level, parent_id, longitude, latitude, boundary_geojson, description)
    VALUES 
        (1, N'核心保护区', N'保护区', 1, NULL, 103.5, 30.2, NULL, N'国家公园核心区域'),
        (2, N'缓冲区A', N'缓冲区', 2, 1, 103.6, 30.3, NULL, N'东部缓冲区'),
        (3, N'缓冲区B', N'缓冲区', 2, 1, 103.4, 30.1, NULL, N'西部缓冲区'),
        (4, N'实验区', N'实验区', 2, NULL, 103.7, 30.4, NULL, N'科研实验区'),
        (5, N'游客服务区', N'服务区', 3, NULL, 103.55, 30.25, NULL, N'游客接待服务区');
    SET IDENTITY_INSERT 区域表 OFF;
    PRINT N'区域表数据插入成功';
END
GO

IF NOT EXISTS (SELECT 1 FROM 监测设备表 WHERE id = 1)
BEGIN
    SET IDENTITY_INSERT 监测设备表 ON;
    INSERT INTO 监测设备表 (id, device_name, device_type, status, install_time, area_id, longitude, latitude)
    VALUES 
        (1, N'红外相机A01', N'红外相机', N'正常', '2024-01-01', 1, 103.51, 30.21),
        (2, N'红外相机A02', N'红外相机', N'正常', '2024-01-01', 1, 103.52, 30.22),
        (3, N'气象站B01', N'气象站', N'正常', '2024-01-05', 2, 103.61, 30.31),
        (4, N'水质监测仪C01', N'水质监测', N'正常', '2024-01-10', 3, 103.41, 30.11),
        (5, N'声音采集器D01', N'声音采集', N'维护中', '2024-02-01', 4, 103.71, 30.41);
    SET IDENTITY_INSERT 监测设备表 OFF;
    PRINT N'监测设备表数据插入成功';
END
GO

-- ============================================
-- 2. 生物多样性模块：物种表
-- ============================================
IF NOT EXISTS (SELECT 1 FROM 物种表 WHERE chinese_name = N'大熊猫')
BEGIN
    INSERT INTO 物种表 (chinese_name, latin_name, kingdom, phylum, class_name, [order], family, genus, species, protect_level, live_habit, distribution_range)
    VALUES 
        (N'大熊猫', N'Ailuropoda melanoleuca', N'动物界', N'脊索动物门', N'哺乳纲', N'食肉目', N'熊科', N'大熊猫属', N'大熊猫', N'国家一级', N'独居，以竹子为主食', N'四川、陕西、甘肃'),
        (N'金丝猴', N'Rhinopithecus roxellana', N'动物界', N'脊索动物门', N'哺乳纲', N'灵长目', N'猴科', N'仰鼻猴属', N'川金丝猴', N'国家一级', N'群居，杂食性', N'四川、陕西、甘肃、湖北'),
        (N'朱鹮', N'Nipponia nippon', N'动物界', N'脊索动物门', N'鸟纲', N'鹳形目', N'鹮科', N'朱鹮属', N'朱鹮', N'国家一级', N'涉禽，栖息于湿地', N'陕西洋县'),
        (N'羚牛', N'Budorcas taxicolor', N'动物界', N'脊索动物门', N'哺乳纲', N'偶蹄目', N'牛科', N'羚牛属', N'羚牛', N'国家一级', N'群居，食草', N'四川、陕西、甘肃'),
        (N'红腹锦鸡', N'Chrysolophus pictus', N'动物界', N'脊索动物门', N'鸟纲', N'鸡形目', N'雉科', N'锦鸡属', N'红腹锦鸡', N'国家二级', N'地栖鸟类', N'中国中部山区'),
        (N'黑熊', N'Ursus thibetanus', N'动物界', N'脊索动物门', N'哺乳纲', N'食肉目', N'熊科', N'熊属', N'亚洲黑熊', N'国家二级', N'杂食性，冬眠', N'东北、西南山区'),
        (N'猕猴', N'Macaca mulatta', N'动物界', N'脊索动物门', N'哺乳纲', N'灵长目', N'猴科', N'猕猴属', N'猕猴', N'国家二级', N'群居，杂食', N'广泛分布'),
        (N'白鹇', N'Lophura nycthemera', N'动物界', N'脊索动物门', N'鸟纲', N'鸡形目', N'雉科', N'鹇属', N'白鹇', N'国家二级', N'林栖雉类', N'南方山区');
    PRINT N'物种表数据插入成功';
END
GO

-- ============================================
-- 3. 环境监测模块：监测指标
-- ============================================
IF NOT EXISTS (SELECT 1 FROM 环境监测指标表 WHERE index_id = N'ENV001')
BEGIN
    INSERT INTO 环境监测指标表 (index_id, index_name, unit, upper_threshold, lower_threshold, monitor_frequency)
    VALUES 
        (N'ENV001', N'空气温度', N'℃', 40, -20, N'小时'),
        (N'ENV002', N'空气湿度', N'%', 100, 0, N'小时'),
        (N'ENV003', N'PM2.5', N'μg/m³', 75, 0, N'小时'),
        (N'ENV004', N'水温', N'℃', 35, 0, N'日'),
        (N'ENV005', N'水质pH值', N'', 9, 6, N'日'),
        (N'ENV006', N'溶解氧', N'mg/L', 20, 2, N'日'),
        (N'ENV007', N'噪音分贝', N'dB', 70, 20, N'小时'),
        (N'ENV008', N'土壤湿度', N'%', 100, 0, N'日');
    PRINT N'环境监测指标表数据插入成功';
END
GO

-- ============================================
-- 4. 科研模块：项目、采集、成果
-- ============================================
IF NOT EXISTS (SELECT 1 FROM ResearchProjects WHERE project_id = 'PRJ001')
BEGIN
    INSERT INTO ResearchProjects (project_id, project_name, leader_id, apply_unit, approval_date, conclusion_date, status, research_field)
    VALUES 
        ('PRJ001', N'大熊猫栖息地恢复研究', '1', N'中国科学院', '2024-01-15', NULL, N'在研', N'生态学'),
        ('PRJ002', N'金丝猴种群动态监测', '1', N'北京大学', '2024-02-01', NULL, N'在研', N'动物学'),
        ('PRJ003', N'高山植被碳汇评估', '1', N'清华大学', '2023-06-01', '2024-06-01', N'结题', N'植物学'),
        ('PRJ004', N'气候变化对物种分布影响', '1', N'中国科学院', '2024-03-01', NULL, N'在研', N'气候学'),
        ('PRJ005', N'珍稀鸟类繁殖行为研究', '1', N'四川大学', '2024-04-15', NULL, N'在研', N'鸟类学');
    PRINT N'科研项目表数据插入成功';
END
GO

IF NOT EXISTS (SELECT 1 FROM DataCollections WHERE collection_id = 'COL001')
BEGIN
    INSERT INTO DataCollections (collection_id, project_id, collector_id, collection_time, area_id, content, data_source, remarks)
    VALUES 
        ('COL001', 'PRJ001', '1', '2024-01-20 09:30:00', '1', N'大熊猫粪便样本采集', N'实地采集', N'核心区东部'),
        ('COL002', 'PRJ001', '1', '2024-01-25 14:00:00', '2', N'大熊猫活动痕迹记录', N'实地采集', N'发现竹子啃食痕迹'),
        ('COL003', 'PRJ002', '1', '2024-02-10 10:00:00', '1', N'金丝猴群体影像采集', N'系统调用', N'红外相机自动采集'),
        ('COL004', 'PRJ003', '1', '2023-08-15 08:00:00', '4', N'植被样方调查数据', N'实地采集', N'高山草甸区域'),
        ('COL005', 'PRJ004', '1', '2024-03-20 11:00:00', '3', N'气象数据采集', N'系统调用', N'气象站自动记录');
    PRINT N'数据采集表数据插入成功';
END
GO

IF NOT EXISTS (SELECT 1 FROM ResearchAchievements WHERE achievement_id = 'ACH001')
BEGIN
    INSERT INTO ResearchAchievements (achievement_id, project_id, title, achievement_type, share_permission, abstract, keywords, first_author, complete_time, journal_or_publisher)
    VALUES 
        ('ACH001', 'PRJ003', N'秦岭高山草甸碳汇能力评估报告', N'论文', N'公开', N'本研究评估了秦岭地区高山草甸的碳汇能力...', N'碳汇,高山草甸,秦岭', N'张三', '2024-05-20', N'生态学报'),
        ('ACH002', 'PRJ001', N'大熊猫栖息地质量评价方法', N'专利', N'保密', N'一种基于遥感和GIS的大熊猫栖息地评价方法...', N'大熊猫,栖息地,评价方法', N'李四', '2024-04-10', N'国家知识产权局'),
        ('ACH003', 'PRJ002', N'川金丝猴社会结构研究进展', N'论文', N'公开', N'综述了川金丝猴社会结构的研究历史和最新进展...', N'金丝猴,社会结构,灵长类', N'王五', '2024-03-15', N'动物学研究');
    PRINT N'科研成果表数据插入成功';
END
GO

-- ============================================
-- 5. 执法模块：执法人员
-- ============================================
IF OBJECT_ID(N'dbo.执法人员表', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM 执法人员表 WHERE law_enforcement_id = N'LAW001')
    BEGIN
        INSERT INTO 执法人员表 (law_enforcement_id, staff_name, department, position, phone, badge_number)
        VALUES 
            (N'LAW001', N'赵队长', N'执法大队', N'大队长', N'13900001001', N'B001'),
            (N'LAW002', N'钱警官', N'执法大队', N'警员', N'13900001002', N'B002'),
            (N'LAW003', N'孙警官', N'执法大队', N'警员', N'13900001003', N'B003'),
            (N'LAW004', N'李警官', N'巡护中队', N'中队长', N'13900001004', N'B004'),
            (N'LAW005', N'周警官', N'巡护中队', N'警员', N'13900001005', N'B005');
        PRINT N'执法人员表数据插入成功';
    END
END
GO

PRINT N'=== 种子数据插入完成 ===';
GO
