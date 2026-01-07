-- environment_tables.sql
USE NationalParkDB;
GO

-- ============================================
-- 生态环境监测业务线表结构（中文表名，复用共享表）
-- 依赖：区域表、监测设备表、用户
-- ============================================

-- 1) 环境监测指标表
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = N'环境监测指标表' AND xtype = 'U')
BEGIN
    CREATE TABLE 环境监测指标表 (
        index_id NVARCHAR(20) PRIMARY KEY,
        index_name NVARCHAR(50) NOT NULL,
        unit NVARCHAR(20) NOT NULL,
        upper_threshold FLOAT NOT NULL,
        lower_threshold FLOAT NOT NULL,
        monitor_frequency NVARCHAR(10) NOT NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT CK_环境指标_频率 CHECK (monitor_frequency IN (N'小时', N'日', N'周'))
    );
    PRINT N'环境监测指标表创建成功';
END
ELSE
BEGIN
    PRINT N'环境监测指标表已存在';
END
GO

-- 2) 环境监测数据表
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = N'环境监测数据表' AND xtype = 'U')
BEGIN
    CREATE TABLE 环境监测数据表 (
        data_id NVARCHAR(30) PRIMARY KEY,
        index_id NVARCHAR(20) NOT NULL,
        device_id INT NOT NULL,
        collect_time DATETIME NOT NULL,
        monitor_value FLOAT NOT NULL,
        area_id INT NOT NULL,
        data_quality NVARCHAR(10) NOT NULL DEFAULT N'中',
        is_abnormal BIT DEFAULT 0,
        abnormal_reason NVARCHAR(100) NULL,
        audit_status NVARCHAR(10) DEFAULT N'未审核',
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),

        CONSTRAINT CK_环境数据_质量 CHECK (data_quality IN (N'优', N'良', N'中', N'差')),
        CONSTRAINT FK_环境数据_指标 FOREIGN KEY (index_id) REFERENCES 环境监测指标表(index_id),
        CONSTRAINT FK_环境数据_设备 FOREIGN KEY (device_id) REFERENCES 监测设备表(id),
        CONSTRAINT FK_环境数据_区域 FOREIGN KEY (area_id) REFERENCES 区域表(id)
    );
    PRINT N'环境监测数据表创建成功';
END
ELSE
BEGIN
    PRINT N'环境监测数据表已存在';
END
GO

-- 3) 设备校准记录表
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name = N'设备校准记录表' AND xtype = 'U')
BEGIN
    CREATE TABLE 设备校准记录表 (
        record_id NVARCHAR(30) PRIMARY KEY,
        device_id INT NOT NULL,
        calibration_time DATETIME NOT NULL,
        calibrator_id INT NOT NULL,
        calibration_result NVARCHAR(10) NOT NULL,
        calibration_desc NVARCHAR(MAX) NULL,
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),

        CONSTRAINT CK_校准记录_结果 CHECK (calibration_result IN (N'合格', N'不合格')),
        CONSTRAINT FK_校准记录_设备 FOREIGN KEY (device_id) REFERENCES 监测设备表(id),
        CONSTRAINT FK_校准记录_人员 FOREIGN KEY (calibrator_id) REFERENCES [用户](id)
    );
    PRINT N'设备校准记录表创建成功';
END
ELSE
BEGIN
    PRINT N'设备校准记录表已存在';
END
GO

-- ============================================
-- 索引（幂等）
-- ============================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_环境数据_采集时间' AND object_id = OBJECT_ID(N'环境监测数据表'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_环境数据_采集时间 ON 环境监测数据表(collect_time);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_环境数据_设备指标' AND object_id = OBJECT_ID(N'环境监测数据表'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_环境数据_设备指标 ON 环境监测数据表(device_id, index_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_环境数据_异常' AND object_id = OBJECT_ID(N'环境监测数据表'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_环境数据_异常 ON 环境监测数据表(is_abnormal);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_环境数据_区域时间' AND object_id = OBJECT_ID(N'环境监测数据表'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_环境数据_区域时间 ON 环境监测数据表(area_id, collect_time);
END
GO

PRINT N'环境监测表结构与索引初始化完成';
GO
