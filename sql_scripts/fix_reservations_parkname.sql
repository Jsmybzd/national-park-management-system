-- 修复预约表：添加公园名称列
USE NationalParkDB;
GO

-- 添加 ParkName 列（存储公园名称）
IF COL_LENGTH(N'dbo.Reservations', N'ParkName') IS NULL
BEGIN
    ALTER TABLE dbo.Reservations ADD ParkName NVARCHAR(100) NULL;
    PRINT N'已添加 ParkName 列';
END
GO

-- 添加 UserId 列（关联创建预约的用户）
IF COL_LENGTH(N'dbo.Reservations', N'UserId') IS NULL
BEGIN
    ALTER TABLE dbo.Reservations ADD UserId INT NULL;
    PRINT N'已添加 UserId 列';
END
GO

-- 验证
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Reservations';
GO
