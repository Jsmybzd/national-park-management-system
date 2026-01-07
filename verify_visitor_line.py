import argparse
import datetime as _dt
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from subprocess import Popen


@dataclass
class HttpResult:
    status: int
    data: object


def _request_json(method: str, url: str, payload: object | None = None, token: str | None = None, timeout: float = 15.0) -> HttpResult:
    headers = {
        "Accept": "application/json",
    }
    data = None

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"

    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            content_type = resp.headers.get("Content-Type", "")
            if raw and "application/json" in content_type:
                return HttpResult(resp.status, json.loads(raw.decode("utf-8")))
            if raw:
                # best-effort json
                try:
                    return HttpResult(resp.status, json.loads(raw.decode("utf-8")))
                except Exception:
                    return HttpResult(resp.status, raw.decode("utf-8", errors="replace"))
            return HttpResult(resp.status, None)
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            body = ""
        raise RuntimeError(f"HTTP {e.code} for {method} {url}: {body}") from e


def _request_json_soft(method: str, url: str, payload: object | None = None, token: str | None = None, timeout: float = 15.0) -> HttpResult:
    headers = {
        "Accept": "application/json",
    }
    data = None

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"

    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            content_type = resp.headers.get("Content-Type", "")
            if raw and "application/json" in content_type:
                return HttpResult(resp.status, json.loads(raw.decode("utf-8")))
            if raw:
                try:
                    return HttpResult(resp.status, json.loads(raw.decode("utf-8")))
                except Exception:
                    return HttpResult(resp.status, raw.decode("utf-8", errors="replace"))
            return HttpResult(resp.status, None)
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            body = ""
        try:
            parsed = json.loads(body) if body else None
        except Exception:
            parsed = body
        return HttpResult(e.code, parsed)


def _wait_for_server(base: str, timeout_s: int) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            r = _request_json("GET", f"{base}/health", timeout=3.0)
            if r.status == 200:
                return True
        except Exception:
            time.sleep(0.5)
    return False


def _start_uvicorn(cwd: str, host: str, port: int) -> Popen:
    cmd = [
        sys.executable,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        host,
        "--port",
        str(port),
    ]
    return Popen(cmd, cwd=cwd)


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify Visitor Intelligent Management business line")
    parser.add_argument("--base", default="http://127.0.0.1:8007", help="Base URL, e.g. http://127.0.0.1:8007")
    parser.add_argument("--start-server", action="store_true", help="Start uvicorn automatically if server is not reachable")
    parser.add_argument("--project-root", default=".", help="Project root cwd for starting uvicorn")
    parser.add_argument("--wait", type=int, default=25, help="Seconds to wait for server startup")

    parser.add_argument("--smoke", action="store_true", help="Run lightweight smoke checks only")
    parser.add_argument("--seed-environment", action="store_true", help="Seed one sample environment monitor index if none exists")
    parser.add_argument("--seed-enforcement", action="store_true", help="Seed and verify enforcement module end-to-end (procedure+trigger)")
    parser.add_argument("--seed-research", action="store_true", help="Seed and verify research module end-to-end (auth + triggers)")

    parser.add_argument("--visitor-name", default="张三")
    parser.add_argument("--visitor-phone", default="13800000007")
    parser.add_argument("--visitor-id-card", default="110101199001011234")

    parser.add_argument("--manager-name", default="李四")
    parser.add_argument("--manager-phone", default="13800000005")

    parser.add_argument("--analyst-name", default="数据分析师")
    parser.add_argument("--analyst-phone", default="13800000002")

    parser.add_argument("--admin-name", default="系统管理员")
    parser.add_argument("--admin-phone", default="13800000001")

    args = parser.parse_args()

    base: str = args.base.rstrip("/")

    proc: Popen | None = None
    if not _wait_for_server(base, timeout_s=2):
        if not args.start_server:
            print(f"[FAIL] server not reachable: {base}")
            print("       hint: start with: python -m uvicorn app.main:app --host 127.0.0.1 --port 8007")
            return 1

        parsed = urllib.parse.urlparse(base)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        print(f"[INFO] starting uvicorn at {host}:{port} ...")
        proc = _start_uvicorn(args.project_root, host, port)
        if not _wait_for_server(base, timeout_s=args.wait):
            print(f"[FAIL] server did not become ready in {args.wait}s: {base}")
            try:
                proc.terminate()
            except Exception:
                pass
            return 1

    try:
        # basic docs page existence
        _request_json("GET", f"{base}/api/docs", timeout=10.0)
        print("[OK] docs reachable: /api/docs")

        # visitor login
        login_v = _request_json(
            "POST",
            f"{base}/api/core/login",
            payload={"phone": args.visitor_phone, "name": args.visitor_name},
            timeout=15.0,
        ).data
        vtoken = login_v.get("token")
        if not vtoken:
            raise RuntimeError("visitor login response missing token")
        print(f"[OK] visitor login: role={login_v.get('role_type')} token_len={len(vtoken)}")

        vprofile = _request_json("GET", f"{base}/api/core/profile", token=vtoken).data
        if not (isinstance(vprofile, dict) and vprofile.get("phone") == args.visitor_phone):
            raise RuntimeError(f"visitor profile mismatch: {vprofile}")
        print(f"[OK] visitor profile: id={vprofile.get('id')} role={vprofile.get('role_type')}")

        # flow control status
        flows = _request_json("GET", f"{base}/api/visitor/flow-controls", token=vtoken).data
        print(f"[OK] flow-controls count={len(flows)}")

        monitor_indices = _request_json("GET", f"{base}/api/environment/monitor-indices", timeout=15.0).data
        if not isinstance(monitor_indices, list):
            raise RuntimeError(f"monitor-indices did not return a list: {monitor_indices}")
        print(f"[OK] environment monitor-indices count={len(monitor_indices)}")

        if args.smoke and args.seed_environment and len(monitor_indices) == 0:
            login_a = _request_json(
                "POST",
                f"{base}/api/core/login",
                payload={"phone": args.analyst_phone, "name": args.analyst_name},
                timeout=15.0,
            ).data
            atoken = login_a.get("token")
            if not atoken:
                raise RuntimeError("analyst login response missing token")

            aprofile = _request_json("GET", f"{base}/api/core/profile", token=atoken).data
            if not (isinstance(aprofile, dict) and aprofile.get("phone") == args.analyst_phone):
                raise RuntimeError(f"analyst profile mismatch: {aprofile}")
            print(f"[OK] analyst profile: id={aprofile.get('id')} role={aprofile.get('role_type')}")

            create_payload = {
                "index_id": "IDX_PM25",
                "index_name": "空气质量PM2.5",
                "unit": "ug/m3",
                "upper_threshold": 75.0,
                "lower_threshold": 0.0,
                "monitor_frequency": "小时",
            }
            created = _request_json_soft(
                "POST",
                f"{base}/api/environment/monitor-indices",
                payload=create_payload,
                token=atoken,
                timeout=15.0,
            )
            if created.status not in (200, 201, 400):
                raise RuntimeError(f"create monitor-index failed: status={created.status} body={created.data}")

            monitor_indices = _request_json("GET", f"{base}/api/environment/monitor-indices", timeout=15.0).data
            if not (isinstance(monitor_indices, list) and len(monitor_indices) >= 1):
                raise RuntimeError(f"monitor-indices still empty after seeding: {monitor_indices}")
            print(f"[OK] environment monitor-indices after seed count={len(monitor_indices)}")

        if args.smoke and args.seed_enforcement:
            login_admin = _request_json(
                "POST",
                f"{base}/api/core/login",
                payload={"phone": args.admin_phone, "name": args.admin_name},
                timeout=15.0,
            ).data
            admintoken = login_admin.get("token")
            if not admintoken:
                raise RuntimeError("admin login response missing token")

            admin_profile = _request_json("GET", f"{base}/api/core/profile", token=admintoken).data
            if not (isinstance(admin_profile, dict) and admin_profile.get("phone") == args.admin_phone):
                raise RuntimeError(f"admin profile mismatch: {admin_profile}")
            print(f"[OK] admin profile: id={admin_profile.get('id')} role={admin_profile.get('role_type')}")

            staff_id = "S001"
            monitor_id = "MON001"
            record_id = "REC001"
            area_number = "A001"

            staff_get = _request_json_soft("GET", f"{base}/api/enforcement/staff/{staff_id}", token=admintoken)
            if staff_get.status == 404:
                staff_create = {
                    "law_enforcement_id": staff_id,
                    "staff_name": "执法员1",
                    "department": f"{area_number}-部门",
                    "permission": "",
                    "contact": "13800000003",
                    "equipment_number": "EQ001",
                }
                created_staff = _request_json_soft(
                    "POST",
                    f"{base}/api/enforcement/staff",
                    payload=staff_create,
                    token=admintoken,
                )
                if created_staff.status not in (200, 201):
                    raise RuntimeError(f"create staff failed: status={created_staff.status} body={created_staff.data}")

            mp_get = _request_json_soft("GET", f"{base}/api/enforcement/monitor/{monitor_id}", token=admintoken)
            if mp_get.status == 404:
                mp_create = {
                    "monitor_point_id": monitor_id,
                    "area_number": area_number,
                    "install_location_lng": 116.403874,
                    "install_location_lat": 39.914888,
                    "monitor_range": "",
                    "device_status": "正常",
                    "data_storage_cycle": 90,
                }
                created_mp = _request_json_soft(
                    "POST",
                    f"{base}/api/enforcement/monitor",
                    payload=mp_create,
                    token=admintoken,
                )
                if created_mp.status not in (200, 201):
                    raise RuntimeError(f"create monitor point failed: status={created_mp.status} body={created_mp.data}")

            rec_get = _request_json_soft("GET", f"{base}/api/enforcement/records/{record_id}", token=admintoken)
            if rec_get.status == 404:
                rec_create = {
                    "record_id": record_id,
                    "behavior_type": "非法砍伐",
                    "monitor_point_id": monitor_id,
                    "evidence_path": "/evidence/demo.jpg",
                    "law_enforcement_id": None,
                }
                created_rec = _request_json_soft(
                    "POST",
                    f"{base}/api/enforcement/records",
                    payload=rec_create,
                    token=admintoken,
                )
                if created_rec.status not in (200, 201):
                    raise RuntimeError(f"create illegal record failed: status={created_rec.status} body={created_rec.data}")

            dispatches = _request_json_soft(
                "GET",
                f"{base}/api/enforcement/dispatch/create-by-procedure/{record_id}",
                token=admintoken,
                timeout=20.0,
            )
            if dispatches.status not in (200, 201):
                raise RuntimeError(f"create dispatch by procedure failed: status={dispatches.status} body={dispatches.data}")
            if not isinstance(dispatches.data, list) or len(dispatches.data) == 0:
                raise RuntimeError(f"dispatch list empty: {dispatches.data}")
            print(f"[OK] enforcement dispatch created count={len(dispatches.data)}")

            for d in dispatches.data:
                did = d.get("dispatch_id")
                if not did:
                    continue
                upd = _request_json_soft(
                    "PUT",
                    f"{base}/api/enforcement/dispatch/{did}/status",
                    payload={"dispatch_status": "已完成"},
                    token=admintoken,
                )
                if upd.status not in (200, 201):
                    raise RuntimeError(f"update dispatch status failed: status={upd.status} body={upd.data}")

            rec_after = _request_json("GET", f"{base}/api/enforcement/records/{record_id}", token=admintoken).data
            if not (isinstance(rec_after, dict) and rec_after.get("handle_status") == "已结案"):
                raise RuntimeError(f"illegal record not closed after finishing dispatches: {rec_after}")
            print("[OK] enforcement procedure+trigger verified (record closed)")

        if args.smoke and args.seed_research:
            login_admin = _request_json(
                "POST",
                f"{base}/api/core/login",
                payload={"phone": args.admin_phone, "name": args.admin_name},
                timeout=15.0,
            ).data
            admintoken = login_admin.get("token")
            if not admintoken:
                raise RuntimeError("admin login response missing token")

            admin_profile = _request_json("GET", f"{base}/api/core/profile", token=admintoken).data
            if not (isinstance(admin_profile, dict) and admin_profile.get("phone") == args.admin_phone):
                raise RuntimeError(f"admin profile mismatch: {admin_profile}")

            visitor_profile = _request_json("GET", f"{base}/api/core/profile", token=vtoken).data
            vid = str(visitor_profile.get("id"))

            project_id = "RP001"
            collection_id = "COL001"
            achievement_id = "ACH001"

            proj_get = _request_json_soft("GET", f"{base}/api/research/projects/{project_id}", token=admintoken)
            if proj_get.status == 404:
                proj_create = {
                    "project_id": project_id,
                    "project_name": "科研项目示例",
                    "leader_id": "L001",
                    "apply_unit": "研究单位",
                    "approval_date": "2025-01-01",
                    "conclusion_date": None,
                    "status": "在研",
                    "research_field": "生态保护",
                }
                created_proj = _request_json_soft(
                    "POST",
                    f"{base}/api/research/projects",
                    payload=proj_create,
                    token=admintoken,
                )
                if created_proj.status not in (200, 201):
                    raise RuntimeError(f"create research project failed: status={created_proj.status} body={created_proj.data}")

            col_get = _request_json_soft("GET", f"{base}/api/research/collections/{collection_id}", token=admintoken)
            if col_get.status == 404:
                col_create = {
                    "collection_id": collection_id,
                    "project_id": project_id,
                    "collector_id": "C001",
                    "collection_time": _dt.datetime.now().isoformat(timespec="seconds"),
                    "area_id": "A001",
                    "content": "采集内容示例",
                    "data_source": "实地采集",
                    "remarks": "",
                }
                created_col = _request_json_soft(
                    "POST",
                    f"{base}/api/research/collections",
                    payload=col_create,
                    token=admintoken,
                )
                if created_col.status not in (200, 201):
                    raise RuntimeError(f"create collection failed: status={created_col.status} body={created_col.data}")

            ach_get = _request_json_soft("GET", f"{base}/api/research/achievements/{achievement_id}", token=admintoken)
            if ach_get.status == 200:
                # Ensure idempotent reruns: previous successful runs may have left authorizations,
                # which would make the "before authorization" check pass unexpectedly.
                del_existing = _request_json_soft(
                    "DELETE",
                    f"{base}/api/research/achievements/{achievement_id}",
                    token=admintoken,
                )
                if del_existing.status not in (200, 201, 404):
                    raise RuntimeError(
                        f"cleanup existing achievement failed: status={del_existing.status} body={del_existing.data}"
                    )
                ach_get = HttpResult(404, None)
            if ach_get.status == 404:
                ach_create = {
                    "achievement_id": achievement_id,
                    "project_id": project_id,
                    "achievement_type": "论文",
                    "title": "成果示例",
                    "publish_date": "2025-01-02",
                    "share_permission": "保密",
                    "file_path": "/files/demo.pdf",
                }
                created_ach = _request_json_soft(
                    "POST",
                    f"{base}/api/research/achievements",
                    payload=ach_create,
                    token=admintoken,
                )
                if created_ach.status not in (200, 201):
                    raise RuntimeError(f"create achievement failed: status={created_ach.status} body={created_ach.data}")

            visitor_access_before = _request_json_soft(
                "GET",
                f"{base}/api/research/achievements/{achievement_id}",
                token=vtoken,
            )
            if visitor_access_before.status != 403:
                raise RuntimeError(f"expected visitor access to be forbidden before authorization, got: {visitor_access_before.status} body={visitor_access_before.data}")

            auth_create = _request_json_soft(
                "POST",
                f"{base}/api/research/authorizations",
                payload={"achievement_id": achievement_id, "user_id": vid, "authorize_time": None},
                token=admintoken,
            )
            if auth_create.status not in (200, 201, 400):
                raise RuntimeError(f"authorize access failed: status={auth_create.status} body={auth_create.data}")

            visitor_access_after = _request_json_soft(
                "GET",
                f"{base}/api/research/achievements/{achievement_id}",
                token=vtoken,
            )
            if visitor_access_after.status not in (200, 201):
                raise RuntimeError(f"expected visitor access after authorization, got: {visitor_access_after.status} body={visitor_access_after.data}")

            upd_perm = _request_json_soft(
                "PUT",
                f"{base}/api/research/achievements/{achievement_id}",
                payload={"share_permission": "公开"},
                token=admintoken,
            )
            if upd_perm.status != 400:
                raise RuntimeError(f"expected trigger to deny share_permission change, got: {upd_perm.status} body={upd_perm.data}")

            del_ach = _request_json_soft(
                "DELETE",
                f"{base}/api/research/achievements/{achievement_id}",
                payload={},
                token=admintoken,
            )
            if del_ach.status not in (200, 201):
                raise RuntimeError(f"delete achievement failed: status={del_ach.status} body={del_ach.data}")

            auth_list = _request_json_soft(
                "GET",
                f"{base}/api/research/authorizations?achievement_id={achievement_id}",
                token=admintoken,
            )
            if auth_list.status not in (200, 201):
                raise RuntimeError(f"list authorizations failed: status={auth_list.status} body={auth_list.data}")
            if isinstance(auth_list.data, list) and len(auth_list.data) != 0:
                raise RuntimeError(f"expected cascade delete to remove authorizations, got: {auth_list.data}")

            print("[OK] research auth + triggers verified")

        if args.smoke:
            login_m = _request_json(
                "POST",
                f"{base}/api/core/login",
                payload={"phone": args.manager_phone, "name": args.manager_name},
                timeout=15.0,
            ).data
            mtoken = login_m.get("token")
            if not mtoken:
                raise RuntimeError("manager login response missing token")
            mprofile = _request_json("GET", f"{base}/api/core/profile", token=mtoken).data
            if not (isinstance(mprofile, dict) and mprofile.get("phone") == args.manager_phone):
                raise RuntimeError(f"manager profile mismatch: {mprofile}")
            print(f"[OK] manager profile: id={mprofile.get('id')} role={mprofile.get('role_type')}")

            print("[PASS] smoke checks passed")
            return 0

        # create reservation
        reserve_date = (_dt.date.today() + _dt.timedelta(days=1)).isoformat()
        create_payload = {
            "visitor_name": args.visitor_name,
            "id_card_no": args.visitor_id_card,
            "phone": None,
            "reserve_date": reserve_date,
            "time_slot": "上午",
            "party_size": 2,
            "ticket_amount": None,
        }
        created = _request_json("POST", f"{base}/api/visitor/reservations", payload=create_payload, token=vtoken).data
        rid = created.get("reservation_id")
        if not rid:
            raise RuntimeError("create reservation response missing reservation_id")
        print(f"[OK] create reservation: reservation_id={rid}")

        # list my reservations
        my = _request_json("GET", f"{base}/api/visitor/reservations/me", token=vtoken).data
        if not isinstance(my, list):
            raise RuntimeError("/reservations/me did not return a list")
        print(f"[OK] list my reservations: count={len(my)}")

        # cancel reservation
        qs = urllib.parse.urlencode({"id_card_no": args.visitor_id_card})
        canceled = _request_json("POST", f"{base}/api/visitor/reservations/{rid}/cancel?{qs}", payload={}, token=vtoken).data
        if not (isinstance(canceled, dict) and canceled.get("success") is True):
            raise RuntimeError(f"cancel failed: {canceled}")
        print("[OK] cancel reservation: success=True")

        # manager login
        login_m = _request_json(
            "POST",
            f"{base}/api/core/login",
            payload={"phone": args.manager_phone, "name": args.manager_name},
            timeout=15.0,
        ).data
        mtoken = login_m.get("token")
        if not mtoken:
            raise RuntimeError("manager login response missing token")
        print(f"[OK] manager login: role={login_m.get('role_type')} token_len={len(mtoken)}")

        mprofile = _request_json("GET", f"{base}/api/core/profile", token=mtoken).data
        if not (isinstance(mprofile, dict) and mprofile.get("phone") == args.manager_phone):
            raise RuntimeError(f"manager profile mismatch: {mprofile}")
        print(f"[OK] manager profile: id={mprofile.get('id')} role={mprofile.get('role_type')}")

        # list all reservations
        all_res = _request_json("GET", f"{base}/api/visitor/reservations", token=mtoken).data
        print(f"[OK] list all reservations: count={len(all_res)}")

        # list out-of-route tracks
        oor = _request_json("GET", f"{base}/api/visitor/tracks/out-of-route", token=mtoken).data
        print(f"[OK] out-of-route tracks: count={len(oor)}")

        print("[PASS] visitor business line is working")
        return 0

    except Exception as e:
        print(f"[FAIL] {e}")
        return 1

    finally:
        if proc is not None:
            try:
                proc.terminate()
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
