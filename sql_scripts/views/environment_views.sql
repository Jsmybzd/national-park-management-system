-- environment_views.sql
USE NationalParkDB;
GO

PRINT N'开始创建环境监测视图...';
GO

-- ============================================
-- 生态环境监测业务线视图（4个）
-- ============================================

-- 视图1：异常环境数据汇总视图（数据分析师专用）
IF EXISTS (SELECT * FROM sysobjects WHERE name = N'v_abnormal_environment_data' AND xtype = 'V')
    DROP VIEW v_abnormal_environment_data;
GO

CREATE VIEW v_abnormal_environment_data AS
SELECT
    d.data_id,
    i.index_name,
    d.device_id,
    de.[type] AS device_type,
    d.collect_time,
    d.monitor_value,
    i.upper_threshold,
    i.lower_threshold,
    a.[name] AS area_name,
    a.[type] AS area_type,
    d.data_quality,
    d.abnormal_reason
FROM 环境监测数据表 d
JOIN 环境监测指标表 i ON d.index_id = i.index_id
JOIN 监测设备表 de ON d.device_id = de.id
JOIN 区域表 a ON d.area_id = a.id
WHERE d.is_abnormal = 1;
GO

PRINT N'✓ v_abnormal_environment_data 创建完成';
GO

-- 视图2：设备运行状态统计视图（技术人员专用）
IF EXISTS (SELECT * FROM sysobjects WHERE name = N'v_device_status_statistics' AND xtype = 'V')
    DROP VIEW v_device_status_statistics;
GO

CREATE VIEW v_device_status_statistics AS
SELECT
    de.id AS device_id,
    de.[type] AS device_type,
    a.[name] AS area_name,
    a.[type] AS area_type,
    de.[status] AS run_status,
    de.calibration_cycle,
    de.last_calibration_time,
    DATEDIFF(DAY, de.last_calibration_time, GETDATE()) AS days_since_calibration,
    CASE
        WHEN de.last_calibration_time IS NULL THEN N'超期未校准'
        WHEN DATEDIFF(DAY, de.last_calibration_time, GETDATE()) > de.calibration_cycle THEN N'超期未校准'
        ELSE N'校准正常'
    END AS calibration_status
FROM 监测设备表 de
LEFT JOIN 区域表 a ON de.deployment_area_id = a.id;
GO

PRINT N'✓ v_device_status_statistics 创建完成';
GO

-- 视图3：区域环境质量汇总视图（公园管理人员专用）
IF EXISTS (SELECT * FROM sysobjects WHERE name = N'v_area_environment_quality' AND xtype = 'V')
    DROP VIEW v_area_environment_quality;
GO

CREATE VIEW v_area_environment_quality AS
SELECT
    a.id AS area_id,
    a.[name] AS area_name,
    a.[type] AS area_type,
    COUNT(d.data_id) AS total_data_count,
    SUM(CASE WHEN d.data_quality IN (N'优', N'良') THEN 1 ELSE 0 END) AS qualified_data_count,
    SUM(CASE WHEN d.is_abnormal = 1 THEN 1 ELSE 0 END) AS abnormal_data_count,
    CASE WHEN COUNT(d.data_id) = 0 THEN 0
         ELSE ROUND(SUM(CASE WHEN d.data_quality IN (N'优', N'良') THEN 1 ELSE 0 END) * 100.0 / COUNT(d.data_id), 2)
    END AS qualified_rate,
    CASE WHEN COUNT(d.data_id) = 0 THEN 0
         ELSE ROUND(SUM(CASE WHEN d.is_abnormal = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(d.data_id), 2)
    END AS abnormal_rate
FROM 区域表 a
LEFT JOIN 环境监测数据表 d ON a.id = d.area_id
GROUP BY a.id, a.[name], a.[type];
GO

PRINT N'✓ v_area_environment_quality 创建完成';
GO

-- 视图4：设备校准记录详情视图（技术人员专用）
IF EXISTS (SELECT * FROM sysobjects WHERE name = N'v_calibration_record_detail' AND xtype = 'V')
    DROP VIEW v_calibration_record_detail;
GO

CREATE VIEW v_calibration_record_detail AS
SELECT
    cr.record_id,
    de.id AS device_id,
    de.[type] AS device_type,
    a.[name] AS area_name,
    cr.calibration_time,
    cr.calibrator_id,
    cr.calibration_result,
    cr.calibration_desc,
    de.[status] AS current_status
FROM 设备校准记录表 cr
JOIN 监测设备表 de ON cr.device_id = de.id
LEFT JOIN 区域表 a ON de.deployment_area_id = a.id;
GO

PRINT N'✓ v_calibration_record_detail 创建完成';
GO

PRINT N'环境监测视图创建完成';
GO
