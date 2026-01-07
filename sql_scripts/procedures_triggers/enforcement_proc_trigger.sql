USE NationalParkDB;
GO

-- 避免重复创建
IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'sp_CreateDispatchForBehavior')
DROP PROCEDURE sp_CreateDispatchForBehavior;
GO

CREATE PROCEDURE sp_CreateDispatchForBehavior
    @record_id VARCHAR(30)  
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @area_number VARCHAR(20);      
    DECLARE @current_time DATETIME = GETDATE(); 
    DECLARE @dispatch_count INT = 0;        

    IF NOT EXISTS (SELECT 1 FROM [非法行为记录表] WHERE [record_id] = @record_id)
    BEGIN
        RAISERROR('非法行为记录不存在', 16, 1);
        RETURN;
    END

    -- 获取该记录的区域编号
    SELECT @area_number = [area_number]
    FROM [非法行为记录表]
    WHERE [record_id] = @record_id;

    IF EXISTS (SELECT 1 FROM [执法调度信息表] WHERE [record_id] = @record_id)
    BEGIN
        PRINT '调度任务已存在，跳过创建。';
        RETURN;
    END

    -- 批量创建调度任务（优先区域匹配，无则兜底随机选1人）
    INSERT INTO [执法调度信息表] (
        [dispatch_id],         
        [record_id],           
        [law_enforcement_id],   
        [dispatch_time],        
        [response_time],        
        [complete_time],       
        [dispatch_status]      
    )
    SELECT 
        -- 生成唯一调度编号（如DISP001）
        'DISP' + RIGHT('000' + CAST(ROW_NUMBER() OVER (ORDER BY s.[law_enforcement_id]) AS VARCHAR), 3) AS dispatch_id,
        @record_id AS record_id,
        s.[law_enforcement_id],
        @current_time AS dispatch_time,
        NULL AS response_time,
        NULL AS complete_time,
        '待响应' AS dispatch_status
    FROM [执法人员信息表] s
    WHERE s.[department] LIKE '%' + @area_number + '%' 
    ORDER BY s.[law_enforcement_id]
    OFFSET 0 ROWS FETCH NEXT 3 ROWS ONLY;  -- 最多3人协同

    -- 获取本次插入的记录数
    SET @dispatch_count = @@ROWCOUNT;

    -- 随机选1人兜底
    IF @dispatch_count = 0
    BEGIN
        INSERT INTO [执法调度信息表] (
            [dispatch_id],
            [record_id],
            [law_enforcement_id],
            [dispatch_time],
            [response_time],
            [complete_time],
            [dispatch_status]
        )
        SELECT 
            'DISP' + RIGHT('000' + CAST(ROW_NUMBER() OVER (ORDER BY NEWID()) AS VARCHAR), 3) AS dispatch_id,
            @record_id AS record_id,
            s.[law_enforcement_id],
            @current_time AS dispatch_time,
            NULL AS response_time,
            NULL AS complete_time,
            '待响应' AS dispatch_status
        FROM [执法人员信息表] s
        ORDER BY NEWID()  -- 随机排序
        OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY;  

        -- 更新总记录数
        SET @dispatch_count = @@ROWCOUNT;
    END

    PRINT '调度任务创建成功，共生成' + CAST(@dispatch_count AS VARCHAR) + '条记录';
END;
GO

PRINT N'存储过程 sp_CreateDispatchForBehavior 创建成功！';
GO

-- 执法效能报告
IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'sp_GenerateEnforcementReport')
    DROP PROCEDURE sp_GenerateEnforcementReport;
GO

CREATE PROCEDURE sp_GenerateEnforcementReport
    @start_date DATE,
    @end_date DATE
AS
BEGIN
    SET NOCOUNT ON;

    IF @start_date IS NULL OR @end_date IS NULL OR @start_date > @end_date
    BEGIN
        RAISERROR('请输入有效的起止日期（开始日期 ≤ 结束日期）', 16, 1);
        RETURN;
    END

    SELECT 
        r.[area_number] AS 区域编号,
        COUNT(r.[record_id]) AS 案件总数,
        AVG(CAST(DATEDIFF(SECOND, r.[occur_time], d.[dispatch_time]) AS FLOAT) / 60) AS 平均响应时长_分钟,
        CAST(SUM(CASE WHEN r.[handle_status] = N'已结案' THEN 1 ELSE 0 END) AS FLOAT) * 100 / NULLIF(COUNT(*), 0) AS 结案率_百分比,
        SUM(CASE WHEN r.[handle_status] != N'已结案' AND DATEDIFF(HOUR, r.[occur_time], GETDATE()) > 24 THEN 1 ELSE 0 END) AS 超期未处理数
    FROM [非法行为记录表] r
    LEFT JOIN [执法调度信息表] d ON r.[record_id] = d.[record_id]
    WHERE CAST(r.[occur_time] AS DATE) BETWEEN @start_date AND @end_date
    GROUP BY r.[area_number]
    ORDER BY 案件总数 DESC;
END;
GO

PRINT N'存储过程 sp_GenerateEnforcementReport 创建成功！';
GO


-- 查询超期案件
IF EXISTS (SELECT 1 FROM sys.procedures WHERE name = 'sp_GetOverdueEnforcementTasks')
    DROP PROCEDURE sp_GetOverdueEnforcementTasks;
GO

CREATE PROCEDURE sp_GetOverdueEnforcementTasks
    @threshold_hours INT = 24
AS
BEGIN
    SET NOCOUNT ON;

    IF @threshold_hours <= 0 SET @threshold_hours = 24;

    SELECT 
        r.[record_id] AS 案件编号,
        r.[behavior_type] AS 行为类型,
        r.[occur_time] AS 发生时间,
        d.[law_enforcement_id] AS 执法人员ID,
        s.[staff_name] AS 执法人员姓名,
        DATEDIFF(HOUR, r.[occur_time], GETDATE()) AS 超时时长_小时
    FROM [非法行为记录表] r
    INNER JOIN [执法调度信息表] d ON r.[record_id] = d.[record_id]
    INNER JOIN [执法人员信息表] s ON d.[law_enforcement_id] = s.[law_enforcement_id]
    WHERE r.[handle_status] != N'已结案'
      AND d.[dispatch_status] IN (N'待响应')
      AND DATEDIFF(HOUR, r.[occur_time], GETDATE()) > @threshold_hours
    ORDER BY 超时时长_小时 DESC;
END;
GO

PRINT N'存储过程 sp_GetOverdueEnforcementTasks 创建成功！';
GO


--  自动同步结案状态
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'tr_UpdateHandleStatus')
DROP TRIGGER tr_UpdateHandleStatus;
GO

CREATE TRIGGER tr_UpdateHandleStatus
ON [执法调度信息表]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- 仅当调度状态字段被更新，且更新后状态为“已完成”时触发
    IF UPDATE([dispatch_status]) AND EXISTS (SELECT 1 FROM inserted WHERE [dispatch_status] = '已完成')
    BEGIN
        DECLARE @record_id VARCHAR(30);
        
        SELECT @record_id = [record_id] FROM inserted;

        -- 统计关联的所有调度任务状态
        DECLARE @total_dispatch INT;    
        DECLARE @finished_dispatch INT; 

        SELECT 
            @total_dispatch = COUNT(*),
            @finished_dispatch = SUM(CASE WHEN [dispatch_status] = '已完成' THEN 1 ELSE 0 END)
        FROM [执法调度信息表]
        WHERE [record_id] = @record_id;

        -- 若所有调度任务均已完成，更新非法行为记录状态为“已结案”
        IF @total_dispatch = @finished_dispatch AND @total_dispatch > 0
        BEGIN
            UPDATE [非法行为记录表]
            SET [handle_status] = '已结案'  
            WHERE [record_id] = @record_id; 

            PRINT '非法行为记录' + @record_id + '已同步更新为“已结案”';
        END
    END
END;
GO

PRINT N'触发器 tr_UpdateHandleStatus 创建成功！';
GO

--  派单合法性校验
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'tr_ValidateDispatchAssignment')
    DROP TRIGGER tr_ValidateDispatchAssignment;
GO

CREATE TRIGGER tr_ValidateDispatchAssignment
ON [执法调度信息表]
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- 校验每条插入记录
    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN [非法行为记录表] r ON i.[record_id] = r.[record_id]
        INNER JOIN [视频监控点信息表] c ON r.[monitor_point_id] = c.[monitor_point_id]  
        INNER JOIN [执法人员信息表] s ON i.[law_enforcement_id] = s.[law_enforcement_id]
        WHERE s.[department] NOT LIKE '%' + c.[area_number] + '%'
    )
    BEGIN
        RAISERROR('派单失败：执法人员责任区域不匹配！', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END

    INSERT INTO [执法调度信息表]
    SELECT * FROM inserted;
END;
GO

PRINT N'触发器 tr_ValidateDispatchAssignment 创建成功！';
GO