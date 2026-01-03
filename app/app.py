# app.py
from flask import Flask, request, jsonify
from config import Config
from db_utils import db, DBUtils
from services.staff_service import LawEnforcementStaffService
from services.record_service import IllegalBehaviorRecordService
from services.dispatch_service import LawEnforcementDispatchService

# 初始化Flask应用
app = Flask(__name__)
# 加载配置
app.config.from_object(Config)
# 初始化SQLAlchemy
db.init_app(app)

# ------------------- 示例接口 -------------------
@app.route('/api/staff/<staff_id>', methods=['GET'])
def get_staff(staff_id):
    staff = LawEnforcementStaffService.get_staff_by_id(staff_id)
    if staff:
        return jsonify({"code": 200, "data": staff})
    return jsonify({"code": 404, "msg": "执法人员不存在"}), 404


if __name__ == '__main__':
    with app.app_context():  # 必须加上下文，否则无法操作数据库
        app.run(debug=True, host='0.0.0.0', port=5000)