-- environment_proc_trigger.sql
USE NationalParkDB;
GO

PRINT N'开始创建环境监测存储过程与触发器...';
GO

-- ============================
-- 幂等：删除旧对象
-- ============================

IF OBJECT_ID(N'[sp_mark_abnormal_data]', N'P') IS NOT NULL
    DROP PROCEDURE [sp_mark_abnormal_data];
GO

IF OBJECT_ID(N'[sp_generate_daily_quality_report]', N'P') IS NOT NULL
    DROP PROCEDURE [sp_generate_daily_quality_report];
GO

IF OBJECT_ID(N'[tr_check_abnormal_on_insert]', N'TR') IS NOT NULL
    DROP TRIGGER [tr_check_abnormal_on_insert];
GO

IF OBJECT_ID(N'[tr_mark_data_quality_on_device_fault]', N'TR') IS NOT NULL
    DROP TRIGGER [tr_mark_data_quality_on_device_fault];
GO

IF OBJECT_ID(N'[tr_update_device_calibration_time]', N'TR') IS NOT NULL
    DROP TRIGGER [tr_update_device_calibration_time];
GO

-- ============================
-- 存储过程1：自动标记异常数据
-- ============================

CREATE PROCEDURE sp_mark_abnormal_data
    @days INT = 1
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE ed
    SET ed.is_abnormal = 1,
        ed.abnormal_reason = CASE
            WHEN ed.monitor_value > mi.upper_threshold
                THEN N'监测值' + CAST(ed.monitor_value AS NVARCHAR(50)) + N'超过上限阈值' + CAST(mi.upper_threshold AS NVARCHAR(50))
            WHEN ed.monitor_value < mi.lower_threshold
                THEN N'监测值' + CAST(ed.monitor_value AS NVARCHAR(50)) + N'低于下限阈值' + CAST(mi.lower_threshold AS NVARCHAR(50))
            ELSE ed.abnormal_reason
        END,
        ed.updated_at = GETDATE()
    FROM 环境监测数据表 ed
    JOIN 环境监测指标表 mi ON ed.index_id = mi.index_id
    WHERE ed.collect_time >= DATEADD(DAY, -@days, GETDATE())
        AND ed.is_abnormal = 0
        AND (ed.monitor_value > mi.upper_threshold OR ed.monitor_value < mi.lower_threshold);

    PRINT N'已标记异常数据：' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + N'条';
END;
GO

-- ============================
-- 存储过程2：生成环境质量日报
-- ============================

CREATE PROCEDURE sp_generate_daily_quality_report
    @report_date DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @report_date IS NULL
        SET @report_date = CAST(GETDATE() AS DATE);

    DECLARE @start_date DATETIME = CAST(@report_date AS DATETIME);
    DECLARE @end_date DATETIME = DATEADD(DAY, 1, @start_date);

    SELECT
        a.id AS area_id,
        a.name AS area_name,
        a.type AS area_type,
        COUNT(ed.data_id) AS total_data_count,
        SUM(CASE WHEN ed.data_quality = N'优' THEN 1 ELSE 0 END) AS excellent_count,
        SUM(CASE WHEN ed.data_quality = N'良' THEN 1 ELSE 0 END) AS good_count,
        SUM(CASE WHEN ed.data_quality = N'中' THEN 1 ELSE 0 END) AS medium_count,
        SUM(CASE WHEN ed.data_quality = N'差' THEN 1 ELSE 0 END) AS poor_count,
        SUM(CASE WHEN ed.is_abnormal = 1 THEN 1 ELSE 0 END) AS abnormal_count,
        AVG(ed.monitor_value) AS avg_value,
        MIN(ed.monitor_value) AS min_value,
        MAX(ed.monitor_value) AS max_value,
        @report_date AS report_date
    FROM 区域表 a
    LEFT JOIN 环境监测数据表 ed ON a.id = ed.area_id
        AND ed.collect_time >= @start_date
        AND ed.collect_time < @end_date
    GROUP BY a.id, a.name, a.type
    ORDER BY a.type, a.name;

    PRINT N'生成环境质量日报完成，日期：' + CAST(@report_date AS NVARCHAR(20));
END;
GO

-- ============================
-- 触发器1：插入环境数据时自动检查异常
-- ============================

CREATE TRIGGER tr_check_abnormal_on_insert
ON 环境监测数据表
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE ed
    SET ed.is_abnormal = CASE
            WHEN i.monitor_value > mi.upper_threshold THEN 1
            WHEN i.monitor_value < mi.lower_threshold THEN 1
            ELSE 0
        END,
        ed.abnormal_reason = CASE
            WHEN i.monitor_value > mi.upper_threshold
                THEN N'监测值' + CAST(i.monitor_value AS NVARCHAR(50)) + N'超过上限阈值' + CAST(mi.upper_threshold AS NVARCHAR(50))
            WHEN i.monitor_value < mi.lower_threshold
                THEN N'监测值' + CAST(i.monitor_value AS NVARCHAR(50)) + N'低于下限阈值' + CAST(mi.lower_threshold AS NVARCHAR(50))
            ELSE NULL
        END,
        ed.updated_at = GETDATE()
    FROM 环境监测数据表 ed
    INNER JOIN inserted i ON ed.data_id = i.data_id
    INNER JOIN 环境监测指标表 mi ON i.index_id = mi.index_id;
END;
GO

-- ============================
-- 触发器2：设备状态变更为故障时，自动标记相关数据为差
-- ============================

CREATE TRIGGER tr_mark_data_quality_on_device_fault
ON 监测设备表
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF UPDATE(status)
    BEGIN
        UPDATE ed
        SET ed.data_quality = N'差',
            ed.updated_at = GETDATE()
        FROM 环境监测数据表 ed
        INNER JOIN inserted i ON ed.device_id = i.id
        INNER JOIN deleted d ON i.id = d.id
        WHERE i.status = N'故障'
            AND d.status <> N'故障'
            AND ed.collect_time >= DATEADD(HOUR, -1, GETDATE());
    END
END;
GO

-- ============================
-- 触发器3：设备校准记录插入后，自动更新设备校准时间
-- ============================

CREATE TRIGGER tr_update_device_calibration_time
ON 设备校准记录表
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE md
    SET md.last_calibration_time = i.calibration_time,
        md.updated_at = GETDATE()
    FROM 监测设备表 md
    INNER JOIN inserted i ON md.id = i.device_id;
END;
GO

PRINT N'环境监测存储过程与触发器创建完成';
GO
