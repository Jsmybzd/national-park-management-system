-- biodiversity_views.sql
-- 生物多样性模块：视图和索引设计方案

USE NationalParkDB;
GO

PRINT N'开始创建生物多样性视图和索引...';
GO

-- ============================================
-- 视图设计方案（4个核心视图）
-- ============================================

-- 视图1：物种综合信息视图
-- 适用范围：用于物种信息查询和报表生成
IF EXISTS (SELECT * FROM sysobjects WHERE name = N'V_物种综合信息' AND xtype = 'V')
    DROP VIEW V_物种综合信息;
GO

CREATE VIEW V_物种综合信息 AS
SELECT
    s.id AS 物种ID,
    s.chinese_name AS 物种名称,
    s.latin_name AS 拉丁学名,
    s.protect_level AS 保护等级,
    s.class_name AS 纲,
    s.[order] AS 目,
    COUNT(m.id) AS 监测次数,
    MAX(m.time) AS 最近监测时间,
    AVG(m.[count]) AS 平均观测数量
FROM 物种表 s
LEFT JOIN 物种监测记录表 m ON s.id = m.species_id
WHERE m.state = N'有效' OR m.state IS NULL
GROUP BY
    s.id, s.chinese_name, s.latin_name, s.protect_level,
    s.class_name, s.[order];
GO

PRINT N'✓ 视图1：V_物种综合信息 创建完成';
GO

-- 视图2：区域物种统计视图
-- 适用范围：区域管理、保护区规划
IF EXISTS (SELECT * FROM sysobjects WHERE name = N'V_区域生物统计' AND xtype = 'V')
    DROP VIEW V_区域生物统计;
GO

CREATE VIEW V_区域生物统计 AS
SELECT
    a.id AS 区域ID,
    a.name AS 区域名称,
    a.type AS 区域类型,
    COUNT(DISTINCT sa.species_id) AS 物种总数,
    SUM(CASE WHEN sa.is_main = 1 THEN 1 ELSE 0 END) AS 主要物种数,
    COUNT(DISTINCT CASE WHEN s.protect_level = N'国家一级' THEN s.id END) AS 一级保护物种数,
    COUNT(DISTINCT CASE WHEN s.protect_level = N'国家二级' THEN s.id END) AS 二级保护物种数,
    COUNT(DISTINCT m.id) AS 监测记录总数
FROM 区域表 a
LEFT JOIN 区域物种关联表 sa ON a.id = sa.area_id
LEFT JOIN 物种表 s ON sa.species_id = s.id
LEFT JOIN 物种监测记录表 m ON s.id = m.species_id
GROUP BY a.id, a.name, a.type;
GO

PRINT N'✓ 视图2：V_区域生物统计 创建完成';
GO

-- 视图3：监测活动统计视图
-- 适用范围：数据分析、监测计划制定
IF EXISTS (SELECT * FROM sysobjects WHERE name = N'V_监测趋势分析' AND xtype = 'V')
    DROP VIEW V_监测趋势分析;
GO

CREATE VIEW V_监测趋势分析 AS
SELECT
    YEAR(m.time) AS 监测年份,
    MONTH(m.time) AS 监测月份,
    DATEPART(QUARTER, m.time) AS 季度,
    m.monitoring_method AS 监测方式,
    s.class_name AS 物种纲目,
    s.protect_level AS 保护等级,
    COUNT(m.id) AS 记录数量,
    SUM(CASE WHEN m.state = N'有效' THEN 1 ELSE 0 END) AS 有效记录数,
    SUM(CASE WHEN m.state = N'待核实' THEN 1 ELSE 0 END) AS 待核实记录数,
    SUM(ISNULL(m.[count], 0)) AS 观测个体总数,
    COUNT(DISTINCT m.recorder_id) AS 参与监测人数,
    COUNT(DISTINCT m.device_id) AS 使用设备数,
    MIN(m.time) AS 最早记录时间,
    MAX(m.time) AS 最晚记录时间
FROM 物种监测记录表 m
INNER JOIN 物种表 s ON m.species_id = s.id
WHERE m.time IS NOT NULL
GROUP BY
    YEAR(m.time),
    MONTH(m.time),
    DATEPART(QUARTER, m.time),
    m.monitoring_method,
    s.class_name,
    s.protect_level;
GO

PRINT N'✓ 视图3：V_监测趋势分析 创建完成';
GO

-- 视图4：濒危物种监测视图
-- 适用范围：保护重点物种监控、预警
IF EXISTS (SELECT * FROM sysobjects WHERE name = N'V_濒危物种监控' AND xtype = 'V')
    DROP VIEW V_濒危物种监控;
GO

CREATE VIEW V_濒危物种监控 AS
SELECT
    s.id AS 物种ID,
    s.chinese_name AS 物种名称,
    s.latin_name AS 拉丁学名,
    s.protect_level AS 保护等级,
    m.time AS 监测时间,
    m.[count] AS 观测数量,
    m.monitoring_method AS 监测方式,
    m.latitude AS 纬度,
    m.longitude AS 经度,
    m.state AS 记录状态,
    LAG(m.[count]) OVER (PARTITION BY s.id ORDER BY m.time) AS 上次观测数量,
    DATEDIFF(DAY,
        LAG(m.time) OVER (PARTITION BY s.id ORDER BY m.time),
        m.time
    ) AS 距上次监测天数
FROM 物种表 s
INNER JOIN 物种监测记录表 m ON s.id = m.species_id
WHERE s.protect_level IN (N'国家一级', N'国家二级')
    AND m.state = N'有效'
    AND m.time >= DATEADD(YEAR, -3, GETDATE());
GO

PRINT N'✓ 视图4：V_濒危物种监控 创建完成';
GO

-- ============================================
-- 索引设计方案（4个优化索引）
-- ============================================

PRINT N'';
PRINT N'创建优化索引...';

-- 索引1：物种监测记录表的时间索引
-- 适用范围：加速按时间的监测记录查询
IF EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_物种监测_时间')
    DROP INDEX IX_物种监测_时间 ON 物种监测记录表;
GO

CREATE NONCLUSTERED INDEX IX_物种监测_时间
ON 物种监测记录表 (time DESC)
INCLUDE (species_id, monitoring_method, [count], state);
GO

PRINT N'✓ 索引1：IX_物种监测_时间 创建完成';

-- 索引2：物种表的保护等级查询索引
-- 适用范围：加速按保护等级筛选物种
IF EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_物种_保护等级')
    DROP INDEX IX_物种_保护等级 ON 物种表;
GO

CREATE NONCLUSTERED INDEX IX_物种_保护等级
ON 物种表 (protect_level)
INCLUDE (chinese_name, latin_name, class_name, [order]);
GO

PRINT N'✓ 索引2：IX_物种_保护等级 创建完成';

-- 索引3：物种监测记录表的物种ID索引
-- 适用范围：加速按物种查询监测记录
IF EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_物种监测_物种')
    DROP INDEX IX_物种监测_物种 ON 物种监测记录表;
GO

CREATE NONCLUSTERED INDEX IX_物种监测_物种
ON 物种监测记录表 (species_id, time DESC)
INCLUDE ([count], monitoring_method, state);
GO

PRINT N'✓ 索引3：IX_物种监测_物种 创建完成';

-- 索引4：区域物种关联表的联合索引
-- 适用范围：优化区域-物种关联查询性能
IF EXISTS (SELECT * FROM sys.indexes WHERE name = N'IX_区域物种_联合')
    DROP INDEX IX_区域物种_联合 ON 区域物种关联表;
GO

CREATE NONCLUSTERED INDEX IX_区域物种_联合
ON 区域物种关联表 (area_id, species_id)
INCLUDE (is_main);
GO

PRINT N'✓ 索引4：IX_区域物种_联合 创建完成';

PRINT N'';
PRINT N'==================================================';
PRINT N'生物多样性视图和索引创建完成！';
PRINT N'';
PRINT N'视图设计方案：';
PRINT N'  1. V_物种综合信息 - 物种信息综合查询';
PRINT N'  2. V_区域生物统计 - 区域生物多样性统计';
PRINT N'  3. V_监测趋势分析 - 监测活动趋势分析';
PRINT N'  4. V_濒危物种监控 - 濒危物种监控预警';
PRINT N'';
PRINT N'索引设计方案：';
PRINT N'  1. IX_物种监测_时间 - 时间查询优化';
PRINT N'  2. IX_物种_保护等级 - 保护等级筛选优化';
PRINT N'  3. IX_物种监测_物种 - 物种查询优化';
PRINT N'  4. IX_区域物种_联合 - 关联查询优化';
PRINT N'==================================================';
GO
