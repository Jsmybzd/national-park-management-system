-- biodiversity_proc_trigger.sql
USE NationalParkDB;
GO

-- ============================
-- 幂等：先删除旧对象
-- ============================

IF OBJECT_ID(N'[SP_生成物种监测报告]', N'P') IS NOT NULL
    DROP PROCEDURE [SP_生成物种监测报告];
GO

IF OBJECT_ID(N'[TR_监测数据完整性检查]', N'TR') IS NOT NULL
    DROP TRIGGER [TR_监测数据完整性检查];
GO

IF OBJECT_ID(N'[TR_防止删除有记录的物种]', N'TR') IS NOT NULL
    DROP TRIGGER [TR_防止删除有记录的物种];
GO

IF OBJECT_ID(N'[FN_计算物种监测频率]', N'FN') IS NOT NULL
    DROP FUNCTION [FN_计算物种监测频率];
GO

-- ============================
-- 存储过程：生成物种监测报告
-- ============================

CREATE PROCEDURE [SP_生成物种监测报告]
    @开始日期 DATE = NULL,
    @结束日期 DATE = NULL,
    @区域ID INT = NULL,
    @保护等级 NVARCHAR(20) = NULL,
    @输出类型 NVARCHAR(20) = N'详细'
AS
BEGIN
    SET NOCOUNT ON;

    IF @开始日期 IS NULL
        SET @开始日期 = DATEADD(MONTH, -1, GETDATE());
    IF @结束日期 IS NULL
        SET @结束日期 = GETDATE();

    IF @开始日期 > @结束日期
    BEGIN
        RAISERROR(N'开始日期不能晚于结束日期', 16, 1);
        RETURN;
    END

    IF @输出类型 NOT IN (N'详细', N'摘要')
        SET @输出类型 = N'详细';

    IF @输出类型 = N'摘要'
    BEGIN
        SELECT
            COUNT(DISTINCT m.species_id) AS 监测物种总数,
            COUNT(m.id) AS 监测记录总数,
            SUM(ISNULL(m.[count], 0)) AS 观测个体总数,
            COUNT(DISTINCT m.recorder_id) AS 参与监测人数,
            MIN(m.time) AS 最早监测时间,
            MAX(m.time) AS 最近监测时间,
            AVG(m.[count]) AS 平均观测数量
        FROM 物种监测记录表 m
        INNER JOIN 物种表 s ON m.species_id = s.id
        WHERE m.time BETWEEN @开始日期 AND @结束日期
            AND m.state = N'有效'
            AND (@区域ID IS NULL OR EXISTS (
                SELECT 1 FROM 区域物种关联表 sa
                WHERE sa.area_id = @区域ID AND sa.species_id = s.id
            ))
            AND (@保护等级 IS NULL OR s.protect_level = @保护等级);
    END
    ELSE
    BEGIN
        SELECT
            s.chinese_name AS 物种名称,
            s.protect_level AS 保护等级,
            m.time AS 监测时间,
            m.monitoring_method AS 监测方式,
            m.[count] AS 观测数量,
            m.latitude AS 纬度,
            m.longitude AS 经度,
            m.behavior AS 行为描述,
            m.state AS 记录状态,
            CASE
                WHEN m.[count] > LAG(m.[count]) OVER (PARTITION BY m.species_id ORDER BY m.time)
                THEN N'上升'
                WHEN m.[count] < LAG(m.[count]) OVER (PARTITION BY m.species_id ORDER BY m.time)
                THEN N'下降'
                ELSE N'稳定'
            END AS 数量趋势
        FROM 物种监测记录表 m
        INNER JOIN 物种表 s ON m.species_id = s.id
        WHERE m.time BETWEEN @开始日期 AND @结束日期
            AND m.state = N'有效'
            AND (@区域ID IS NULL OR EXISTS (
                SELECT 1 FROM 区域物种关联表 sa
                WHERE sa.area_id = @区域ID AND sa.species_id = s.id
            ))
            AND (@保护等级 IS NULL OR s.protect_level = @保护等级)
        ORDER BY m.time DESC, s.protect_level;
    END
END
GO

-- ============================
-- 触发器：监测数据完整性检查
-- ============================

CREATE TRIGGER [TR_监测数据完整性检查]
ON 物种监测记录表
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1 FROM inserted
        WHERE time > GETDATE()
            OR [count] < 0
            OR monitoring_method NOT IN (N'红外相机', N'人工巡查', N'无人机')
            OR state NOT IN (N'有效', N'待核实')
    )
    BEGIN
        RAISERROR(N'数据完整性检查失败', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END

    IF EXISTS (
        SELECT 1 FROM inserted i
        WHERE NOT EXISTS (SELECT 1 FROM 物种表 WHERE id = i.species_id)
            OR NOT EXISTS (SELECT 1 FROM [用户] WHERE id = i.recorder_id)
    )
    BEGIN
        RAISERROR(N'物种或记录人不存在', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END

    IF UPDATE([count]) OR UPDATE(state)
    BEGIN
        UPDATE s
        SET updated_at = GETDATE()
        FROM 物种表 s
        INNER JOIN inserted i ON s.id = i.species_id;
    END
END
GO

-- ============================
-- 触发器：防止删除有记录的物种
-- ============================

CREATE TRIGGER [TR_防止删除有记录的物种]
ON 物种表
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1 FROM deleted d
        WHERE EXISTS (SELECT 1 FROM 物种监测记录表 WHERE species_id = d.id)
            OR EXISTS (SELECT 1 FROM 区域物种关联表 WHERE species_id = d.id)
    )
    BEGIN
        RAISERROR(N'该物种存在相关记录，不能删除', 16, 1);
        RETURN;
    END

    DELETE FROM 物种表
    WHERE id IN (SELECT id FROM deleted);
END
GO

-- ============================
-- 函数：计算物种监测频率
-- ============================

CREATE FUNCTION [FN_计算物种监测频率]
(
    @物种ID INT,
    @开始日期 DATE = NULL,
    @结束日期 DATE = NULL
)
RETURNS DECIMAL(10,2)
AS
BEGIN
    IF @开始日期 IS NULL
        SET @开始日期 = DATEADD(YEAR, -1, GETDATE());
    IF @结束日期 IS NULL
        SET @结束日期 = GETDATE();

    DECLARE @记录数量 INT;
    DECLARE @月数 DECIMAL(10,2);

    SELECT @记录数量 = COUNT(*)
    FROM 物种监测记录表
    WHERE species_id = @物种ID
        AND time BETWEEN @开始日期 AND @结束日期
        AND state = N'有效';

    SET @月数 = DATEDIFF(DAY, @开始日期, @结束日期) / 30.0;

    IF @月数 <= 0 RETURN 0;

    RETURN @记录数量 / @月数;
END
GO

PRINT N'生物多样性编程对象创建完成';
GO
