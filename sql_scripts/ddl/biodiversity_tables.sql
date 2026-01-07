-- sql_scripts/ddl/biodiversity_tables.sql
/*
生物多样性监测业务线建表语句
包含物种信息、监测记录、区域物种关联表
显式指定中文排序规则
*/

USE NationalParkDB;
GO

PRINT N'创建生物多样性表（显式指定中文排序规则）';
PRINT N'==================================================';

-- 1. 物种表
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name=N'物种表' AND xtype='U')
BEGIN
    CREATE TABLE 物种表 (
        id INT PRIMARY KEY IDENTITY(1,1),

        -- 中文名称：必须使用NVARCHAR + 中文排序规则
        chinese_name NVARCHAR(100) COLLATE Chinese_PRC_CI_AS NOT NULL,

        -- 拉丁名称：使用拉丁排序规则
        latin_name NVARCHAR(100) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,

        -- 物种分类：全部使用中文排序规则
        kingdom NVARCHAR(50) COLLATE Chinese_PRC_CI_AS NULL,
        phylum NVARCHAR(50) COLLATE Chinese_PRC_CI_AS NULL,
        class_name NVARCHAR(50) COLLATE Chinese_PRC_CI_AS NULL,
        [order] NVARCHAR(50) COLLATE Chinese_PRC_CI_AS NULL,
        family NVARCHAR(50) COLLATE Chinese_PRC_CI_AS NULL,
        genus NVARCHAR(50) COLLATE Chinese_PRC_CI_AS NULL,
        species NVARCHAR(50) COLLATE Chinese_PRC_CI_AS NULL,

        -- 保护级别：中文内容
        protect_level NVARCHAR(20) COLLATE Chinese_PRC_CI_AS DEFAULT N'无'
            CHECK (protect_level IN (N'国家一级', N'国家二级', N'无')),

        -- 生态信息：中文内容
        live_habit NVARCHAR(MAX) COLLATE Chinese_PRC_CI_AS NULL,
        distribution_range NVARCHAR(MAX) COLLATE Chinese_PRC_CI_AS NULL,

        -- 创建时间
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE()
    );

    PRINT N'物种表创建成功（中文排序规则已指定）';
END
ELSE
BEGIN
    PRINT N'物种表已存在';

    -- 检查当前排序规则
    PRINT N'当前物种表列的排序规则:';
    SELECT
        c.name as 列名,
        ty.name as 数据类型,
        c.collation_name as 排序规则,
        CASE
            WHEN c.name IN ('chinese_name', 'kingdom', 'phylum', 'class_name', 'order',
                          'family', 'genus', 'species', 'protect_level', 'live_habit', 'distribution_range')
                 AND c.collation_name = N'Chinese_PRC_CI_AS' THEN N'✅ 正确'
            WHEN c.name = 'latin_name' AND c.collation_name LIKE N'SQL_Latin1%' THEN N'✅ 正确'
            ELSE N'❌ 需要修复'
        END as 状态
    FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    WHERE t.name = N'物种表'
      AND c.collation_name IS NOT NULL
    ORDER BY c.column_id;
END
GO

-- 物种表索引（幂等创建）
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_chinese_name' AND object_id = OBJECT_ID(N'物种表'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_chinese_name ON 物种表(chinese_name);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_protect_level' AND object_id = OBJECT_ID(N'物种表'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_protect_level ON 物种表(protect_level);
END
GO

-- 2. 物种监测记录表
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name=N'物种监测记录表' AND xtype='U')
BEGIN
    CREATE TABLE 物种监测记录表 (
        id INT PRIMARY KEY IDENTITY(1,1),
        species_id INT NOT NULL,
        device_id INT NULL,
        time DATETIME NOT NULL,

        -- 监测地点
        latitude FLOAT NULL,
        longitude FLOAT NULL,

        -- 监测方式：中文内容
        monitoring_method NVARCHAR(20) COLLATE Chinese_PRC_CI_AS NOT NULL
            CHECK (monitoring_method IN (N'红外相机', N'人工巡查', N'无人机')),

        -- 监测内容：中文描述
        image_path NVARCHAR(500) COLLATE Chinese_PRC_CI_AS NULL,
        [count] INT NULL,
        behavior NVARCHAR(MAX) COLLATE Chinese_PRC_CI_AS NULL,

        -- 数据状态：中文内容
        state NVARCHAR(10) COLLATE Chinese_PRC_CI_AS DEFAULT N'待核实'
            CHECK (state IN (N'有效', N'待核实')),

        -- 记录人
        recorder_id INT NOT NULL,

        -- 创建时间
        created_at DATETIME DEFAULT GETDATE(),
        updated_at DATETIME DEFAULT GETDATE(),

        -- 外键约束
        CONSTRAINT FK_物种监测记录_物种 FOREIGN KEY (species_id)
            REFERENCES 物种表(id) ON DELETE CASCADE,
        CONSTRAINT FK_物种监测记录_设备 FOREIGN KEY (device_id)
            REFERENCES 监测设备表(id) ON DELETE SET NULL,
        CONSTRAINT FK_物种监测记录_记录人 FOREIGN KEY (recorder_id)
            REFERENCES [用户](id) ON DELETE NO ACTION
    );

    PRINT N'物种监测记录表创建成功（中文排序规则已指定）';
END
ELSE
    PRINT N'物种监测记录表已存在';
GO

-- 物种监测记录表索引（幂等创建）
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_time' AND object_id = OBJECT_ID(N'物种监测记录表'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_time ON 物种监测记录表(time);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_species_id' AND object_id = OBJECT_ID(N'物种监测记录表'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_species_id ON 物种监测记录表(species_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_recorder_id' AND object_id = OBJECT_ID(N'物种监测记录表'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_recorder_id ON 物种监测记录表(recorder_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_state' AND object_id = OBJECT_ID(N'物种监测记录表'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_state ON 物种监测记录表(state);
END
GO

-- 3. 区域物种关联表
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name=N'区域物种关联表' AND xtype='U')
BEGIN
    CREATE TABLE 区域物种关联表 (
        id INT PRIMARY KEY IDENTITY(1,1),
        area_id INT NOT NULL,
        species_id INT NOT NULL,
        is_main BIT DEFAULT 0,

        -- 创建时间
        created_at DATETIME DEFAULT GETDATE(),

        -- 外键约束
        CONSTRAINT FK_区域物种_区域 FOREIGN KEY (area_id)
            REFERENCES 区域表(id) ON DELETE CASCADE,
        CONSTRAINT FK_区域物种_物种 FOREIGN KEY (species_id)
            REFERENCES 物种表(id) ON DELETE CASCADE,

        -- 唯一约束：一个物种在一个区域只能有一条记录
        CONSTRAINT UQ_区域物种 UNIQUE (area_id, species_id)
    );

    PRINT N'区域物种关联表创建成功';
END
ELSE
    PRINT N'区域物种关联表已存在';
GO

-- 区域物种关联表索引（幂等创建）
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_area_id' AND object_id = OBJECT_ID(N'区域物种关联表'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_area_id ON 区域物种关联表(area_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_species_id' AND object_id = OBJECT_ID(N'区域物种关联表'))
BEGIN
    CREATE NONCLUSTERED INDEX idx_species_id ON 区域物种关联表(species_id);
END
GO

-- ========== 插入示例数据 ==========
PRINT N'开始插入示例数据...';

-- 1. 插入物种数据（至少20条）
IF (SELECT COUNT(*) FROM 物种表) = 0
BEGIN
    -- 哺乳动物
    INSERT INTO 物种表 (chinese_name, latin_name, kingdom, phylum, class_name, [order], family, genus, species, protect_level, live_habit, distribution_range) VALUES
    (N'大熊猫', 'Ailuropoda melanoleuca', N'动物界', N'脊索动物门', N'哺乳纲', N'食肉目', N'熊科', N'大熊猫属', N'大熊猫', N'国家一级', N'独居，栖息于海拔2600-3500米的竹林中', N'四川、陕西、甘肃'),
    (N'金丝猴', 'Rhinopithecus roxellana', N'动物界', N'脊索动物门', N'哺乳纲', N'灵长目', N'猴科', N'仰鼻猴属', N'川金丝猴', N'国家一级', N'群居，树栖，以嫩叶、花、果实为食', N'四川、甘肃、湖北、陕西'),
    (N'雪豹', 'Panthera uncia', N'动物界', N'脊索动物门', N'哺乳纲', N'食肉目', N'猫科', N'豹属', N'雪豹', N'国家一级', N'独居，夜间活动，栖息于高山雪线附近', N'青藏高原及周边山区'),
    (N'东北虎', 'Panthera tigris altaica', N'动物界', N'脊索动物门', N'哺乳纲', N'食肉目', N'猫科', N'豹属', N'虎', N'国家一级', N'独居，领地意识强，夜间狩猎', N'黑龙江、吉林'),
    (N'亚洲象', 'Elephas maximus', N'动物界', N'脊索动物门', N'哺乳纲', N'长鼻目', N'象科', N'亚洲象属', N'亚洲象', N'国家一级', N'群居，日行性，以植物为食', N'云南南部'),
    (N'藏羚羊', 'Pantholops hodgsonii', N'动物界', N'脊索动物门', N'哺乳纲', N'偶蹄目', N'牛科', N'藏羚属', N'藏羚羊', N'国家一级', N'群居，迁徙，适应高寒环境', N'青藏高原'),
    (N'麋鹿', 'Elaphurus davidianus', N'动物界', N'脊索动物门', N'哺乳纲', N'偶蹄目', N'鹿科', N'麋鹿属', N'麋鹿', N'国家一级', N'群居，栖息于湿地和沼泽', N'江苏、湖北、湖南'),
    (N'中华穿山甲', 'Manis pentadactyla', N'动物界', N'脊索动物门', N'哺乳纲', N'鳞甲目', N'穿山甲科', N'穿山甲属', N'中华穿山甲', N'国家一级', N'夜行性，穴居，以蚂蚁和白蚁为食', N'南方各省'),
    (N'黑颈鹤', 'Grus nigricollis', N'动物界', N'脊索动物门', N'鸟纲', N'鹤形目', N'鹤科', N'鹤属', N'黑颈鹤', N'国家一级', N'迁徙，栖息于高原湿地', N'青藏高原'),
    (N'朱鹮', 'Nipponia nippon', N'动物界', N'脊索动物门', N'鸟纲', N'鹈形目', N'鹮科', N'朱鹮属', N'朱鹮', N'国家一级', N'栖息于水田、河滩，以小鱼虾为食', N'陕西洋县'),

    -- 鸟类
    (N'丹顶鹤', 'Grus japonensis', N'动物界', N'脊索动物门', N'鸟纲', N'鹤形目', N'鹤科', N'鹤属', N'丹顶鹤', N'国家一级', N'栖息于沼泽、湿地，冬季迁徙', N'东北、长江下游'),
    (N'白鹤', 'Grus leucogeranus', N'动物界', N'脊索动物门', N'鸟纲', N'鹤形目', N'鹤科', N'鹤属', N'白鹤', N'国家一级', N'迁徙鸟类，栖息于浅水湿地', N'鄱阳湖越冬'),
    (N'中华秋沙鸭', 'Mergus squamatus', N'动物界', N'脊索动物门', N'鸟纲', N'雁形目', N'鸭科', N'秋沙鸭属', N'中华秋沙鸭', N'国家一级', N'栖息于清澈河流，潜水捕鱼', N'东北、长江流域'),
    (N'黄腹角雉', 'Tragopan caboti', N'动物界', N'脊索动物门', N'鸟纲', N'鸡形目', N'雉科', N'角雉属', N'黄腹角雉', N'国家一级', N'林栖，不善飞行，以植物为食', N'浙江、福建、江西'),

    -- 两栖爬行类
    (N'大鲵', 'Andrias davidianus', N'动物界', N'脊索动物门', N'两栖纲', N'有尾目', N'隐鳃鲵科', N'大鲵属', N'大鲵', N'国家二级', N'栖息于清澈溪流，夜行性', N'南方山区'),
    (N'瑶山鳄蜥', 'Shinisaurus crocodilurus', N'动物界', N'脊索动物门', N'爬行纲', N'蜥蜴目', N'鳄蜥科', N'鳄蜥属', N'瑶山鳄蜥', N'国家一级', N'半水栖，行动迟缓，以昆虫为食', N'广西大瑶山'),
    (N'四爪陆龟', 'Testudo horsfieldii', N'动物界', N'脊索动物门', N'爬行纲', N'龟鳖目', N'陆龟科', N'陆龟属', N'四爪陆龟', N'国家一级', N'栖息于荒漠草原，冬眠', N'新疆伊犁'),

    -- 鱼类
    (N'中华鲟', 'Acipenser sinensis', N'动物界', N'脊索动物门', N'辐鳍鱼纲', N'鲟形目', N'鲟科', N'鲟属', N'中华鲟', N'国家一级', N'洄游鱼类，栖息于大江河及近海', N'长江流域'),
    (N'白鲟', 'Psephurus gladius', N'动物界', N'脊索动物门', N'辐鳍鱼纲', N'鲟形目', N'匙吻鲟科', N'白鲟属', N'白鲟', N'国家一级', N'大型淡水鱼，以鱼类为食', N'长江流域'),
    (N'胭脂鱼', 'Myxocyprinus asiaticus', N'动物界', N'脊索动物门', N'辐鳍鱼纲', N'鲤形目', N'胭脂鱼科', N'胭脂鱼属', N'胭脂鱼', N'国家二级', N'中下层鱼类，杂食性', N'长江、闽江'),

    -- 昆虫
    (N'金斑喙凤蝶', 'Teinopalpus aureus', N'动物界', N'节肢动物门', N'昆虫纲', N'鳞翅目', N'凤蝶科', N'喙凤蝶属', N'金斑喙凤蝶', N'国家一级', N'日间活动，飞翔迅速，喜访花', N'福建、江西、广东');

    PRINT N'已插入20条物种数据（中文排序规则确保正确存储）';

    -- 验证插入的中文数据
    PRINT N'验证插入的中文数据:';
    SELECT TOP 5
        id,
        chinese_name,
        protect_level,
        CASE
            WHEN chinese_name LIKE N'%?%' THEN N'⚠️ 包含问号（可能乱码）'
            ELSE N'✅ 中文正常'
        END as 中文状态
    FROM 物种表
    ORDER BY id;
END
ELSE
BEGIN
    PRINT N'物种表已有数据，跳过插入';

    -- 验证现有中文数据
    PRINT N'验证现有物种中文数据:';
    SELECT TOP 5
        id,
        chinese_name,
        protect_level,
        LEN(chinese_name) as 字符长度,
        CASE
            WHEN chinese_name LIKE N'%?%' THEN N'⚠️ 包含问号（可能乱码）'
            ELSE N'✅ 中文正常'
        END as 中文状态
    FROM 物种表
    ORDER BY id;
END
GO

-- 2. 插入监测记录数据（至少20条）
IF (SELECT COUNT(*) FROM 物种监测记录表) = 0
BEGIN
    DECLARE @recorder_id INT;
    DECLARE @device_id INT;

    -- 获取生态监测员ID（主项目使用 role_type 字段）
    SELECT TOP 1 @recorder_id = id FROM [用户] WHERE role_type = N'生态监测员';
    IF @recorder_id IS NULL
        SET @recorder_id = 3;  -- 默认使用ID=3的用户（monitor001）

    -- 获取红外相机设备ID
    SELECT TOP 1 @device_id = id FROM 监测设备表 WHERE type = N'红外相机';

    INSERT INTO 物种监测记录表 (species_id, device_id, time, latitude, longitude, monitoring_method, image_path, [count], behavior, state, recorder_id) VALUES
    -- 大熊猫监测记录
    (1, @device_id, DATEADD(DAY, -1, GETDATE()), 30.123456, 102.123456, N'红外相机', N'/images/panda_001.jpg', 2, N'两只成年大熊猫在竹林觅食', N'待核实', @recorder_id),
    (1, @device_id, DATEADD(DAY, -3, GETDATE()), 30.234567, 102.234567, N'红外相机', N'/images/panda_002.jpg', 1, N'发现新鲜粪便和取食痕迹', N'有效', @recorder_id),
    (1, NULL, DATEADD(DAY, -5, GETDATE()), 30.345678, 102.345678, N'人工巡查', NULL, 3, N'家族活动，两只成体一只幼崽', N'待核实', @recorder_id),

    -- 金丝猴监测记录
    (2, NULL, DATEADD(DAY, -2, GETDATE()), 32.123456, 103.123456, N'人工巡查', N'/images/golden_monkey_001.jpg', 15, N'猴群在林间跳跃觅食', N'有效', @recorder_id),
    (2, @device_id, DATEADD(DAY, -7, GETDATE()), 32.234567, 103.234567, N'红外相机', NULL, 8, N'夜间休息状态', N'待核实', @recorder_id),

    -- 雪豹监测记录
    (3, @device_id, DATEADD(DAY, -10, GETDATE()), 35.123456, 85.123456, N'红外相机', N'/images/snow_leopard_001.jpg', 1, N'成年雪豹在岩石上休息', N'有效', @recorder_id),
    (3, NULL, DATEADD(DAY, -15, GETDATE()), 35.234567, 85.234567, N'人工巡查', NULL, NULL, N'发现雪豹足迹和捕食痕迹', N'待核实', @recorder_id),

    -- 东北虎监测记录
    (4, @device_id, DATEADD(DAY, -20, GETDATE()), 43.123456, 128.123456, N'红外相机', N'/images/tiger_001.jpg', 1, N'成年雄虎巡视领地', N'有效', @recorder_id),
    (4, @device_id, DATEADD(DAY, -25, GETDATE()), 43.234567, 128.234567, N'无人机', N'/images/tiger_002.jpg', 2, N'两只东北虎相遇后分开', N'待核实', @recorder_id),

    -- 亚洲象监测记录
    (5, NULL, DATEADD(DAY, -4, GETDATE()), 22.123456, 101.123456, N'人工巡查', N'/images/elephant_001.jpg', 8, N'象群在河边饮水', N'有效', @recorder_id),
    (5, NULL, DATEADD(DAY, -8, GETDATE()), 22.234567, 101.234567, N'无人机', N'/images/elephant_002.jpg', 12, N'象群迁徙经过保护区', N'待核实', @recorder_id),

    -- 藏羚羊监测记录
    (6, @device_id, DATEADD(DAY, -12, GETDATE()), 34.123456, 88.123456, N'红外相机', N'/images/antelope_001.jpg', 50, N'藏羚羊群在草原觅食', N'有效', @recorder_id),
    (6, NULL, DATEADD(DAY, -18, GETDATE()), 34.234567, 88.234567, N'无人机', N'/images/antelope_002.jpg', 120, N'大规模迁徙开始', N'有效', @recorder_id),

    -- 麋鹿监测记录
    (7, NULL, DATEADD(DAY, -6, GETDATE()), 33.123456, 119.123456, N'人工巡查', N'/images/deer_001.jpg', 25, N'麋鹿在湿地活动', N'待核实', @recorder_id),
    (7, @device_id, DATEADD(DAY, -9, GETDATE()), 33.234567, 119.234567, N'红外相机', N'/images/deer_002.jpg', 18, N'夜间觅食行为', N'有效', @recorder_id),

    -- 黑颈鹤监测记录
    (9, NULL, DATEADD(DAY, -11, GETDATE()), 31.123456, 92.123456, N'人工巡查', N'/images/crane_001.jpg', 8, N'黑颈鹤在湿地觅食', N'有效', @recorder_id),
    (9, NULL, DATEADD(DAY, -14, GETDATE()), 31.234567, 92.234567, N'无人机', N'/images/crane_002.jpg', 15, N'鹤群飞行', N'待核实', @recorder_id),

    -- 朱鹮监测记录
    (10, NULL, DATEADD(DAY, -16, GETDATE()), 33.123456, 107.123456, N'人工巡查', N'/images/ibis_001.jpg', 6, N'朱鹮在水田觅食', N'有效', @recorder_id),
    (10, @device_id, DATEADD(DAY, -19, GETDATE()), 33.234567, 107.234567, N'红外相机', N'/images/ibis_002.jpg', 4, N'夜间栖息', N'有效', @recorder_id),

    -- 丹顶鹤监测记录
    (11, NULL, DATEADD(DAY, -21, GETDATE()), 45.123456, 126.123456, N'人工巡查', N'/images/red_crane_001.jpg', 3, N'丹顶鹤在沼泽地', N'待核实', @recorder_id);

    PRINT N'已插入20条监测记录数据（中文描述确保正确存储）';
END
ELSE
    PRINT N'监测记录表已有数据，跳过插入';
GO

-- 3. 插入区域物种关联数据
IF (SELECT COUNT(*) FROM 区域物种关联表) = 0
BEGIN
    -- 关联物种到区域（示例：区域1~3）
    INSERT INTO 区域物种关联表 (area_id, species_id, is_main) VALUES
    -- 区域1的主要物种
    (1, 1, 1),  -- 大熊猫
    (1, 2, 0),  -- 金丝猴
    (1, 3, 0),  -- 雪豹
    (1, 4, 0),  -- 东北虎

    -- 区域2的主要物种
    (2, 5, 1),  -- 亚洲象
    (2, 6, 0),  -- 藏羚羊
    (2, 7, 0),  -- 麋鹿

    -- 区域3的主要物种
    (3, 9, 1),  -- 黑颈鹤
    (3, 10, 0), -- 朱鹮
    (3, 11, 0); -- 丹顶鹤

    PRINT N'已插入区域物种关联数据';
END
ELSE
    PRINT N'区域物种关联表已有数据，跳过插入';
GO

PRINT N'所有示例数据插入完成！';
PRINT N'==================================================';
GO
