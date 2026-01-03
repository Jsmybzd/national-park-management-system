from sqlalchemy import text

from app import db
from app.models import LawEnforcementDispatch, IllegalBehaviorRecord, LawEnforcementStaff
from datetime import datetime
import traceback

class DispatchService:
    """执法调度任务业务逻辑层（对接SQL Server存储过程+触发器）"""

    @staticmethod
    def get_by_conditions(dispatch_id=None, record_id=None, status=None, law_enforcement_id=None, start_time=None, end_time=None):
        """组合条件查询（直接操作数据库，性能更优）"""
        query = LawEnforcementDispatch.query
        if dispatch_id:
            query = query.filter(LawEnforcementDispatch.dispatch_id == dispatch_id)
        if record_id:
            query = query.filter(LawEnforcementDispatch.record_id == record_id)
        # 按状态筛选
        if status:
            query = query.filter(LawEnforcementDispatch.dispatch_status == status)
        # 按执法人员筛选
        if law_enforcement_id:
            query = query.filter(LawEnforcementDispatch.law_enforcement_id == law_enforcement_id)
        # 按时间范围筛选
        if start_time:
            query = query.filter(LawEnforcementDispatch.response_time >= start_time)
        if end_time:
            query = query.filter(LawEnforcementDispatch.complete_time <= end_time)
        return query.all()

    @staticmethod
    def create_by_procedure(record_id):
        if not record_id:
            raise ValueError("非法行为记录ID不能为空")

        try:
            # 修复：用text()包裹原生SQL
            sql = text("""
                EXEC sp_CreateDispatchForBehavior @record_id = :record_id;
            """)
            # 执行方式不变，params参数正常传
            db.session.execute(sql, params={"record_id": record_id.strip()})
            db.session.commit()

            dispatch_list = LawEnforcementDispatch.query.filter_by(record_id=record_id.strip()).all()
            if not dispatch_list:
                raise Exception("存储过程执行成功，但未创建任何调度任务（无匹配的执法人员）")
            return dispatch_list

        except Exception as e:
            db.session.rollback()
            error_msg = str(e)
            if "非法行为记录不存在" in error_msg:
                raise ValueError(error_msg)
            elif "调度任务已存在" in error_msg:
                raise ValueError("该非法记录已创建调度任务，无需重复派单")
            else:
                raise Exception(f"调用存储过程失败：{error_msg}\n{traceback.format_exc()}")

    @staticmethod
    def update_dispatch_status(dispatch_id, new_status):
        """
        更新调度状态（触发数据库触发器tr_UpdateHandleStatus）
        无需手动同步非法记录状态，由触发器自动处理
        :param dispatch_id: 调度ID
        :param new_status: 新状态（待响应/已响应/已完成/已取消）
        :return: 更新后的调度对象
        """
        valid_status = ['待响应', '已派单', '已响应', '已完成', '已取消']
        if new_status not in valid_status:
            raise ValueError(f"调度状态无效，仅支持：{', '.join(valid_status)}")

        dispatch = LawEnforcementDispatch.query.get(dispatch_id.strip())
        if not dispatch:
            return None

        try:
            # 1. 更新调度状态（触发触发器）
            dispatch.dispatch_status = new_status
            # 自动填充响应/完成时间
            if new_status == '已响应' and not dispatch.response_time:
                dispatch.response_time = datetime.now()
            elif new_status == '已完成' and not dispatch.complete_time:
                dispatch.complete_time = datetime.now()

            db.session.commit()
            return dispatch
        except Exception as e:
            db.session.rollback()
            raise Exception(f"更新调度状态失败：{str(e)}")

    @staticmethod
    def delete(dispatch_id):
        """删除调度任务（物理删除，生产环境建议逻辑删除）"""
        dispatch = LawEnforcementDispatch.query.get(dispatch_id.strip())
        if not dispatch:
            return False

        try:
            db.session.delete(dispatch)
            db.session.commit()
            return True
        except Exception as e:
            db.session.rollback()
            raise Exception(f"删除调度任务失败：{str(e)}")
