"""
realtime.py — Socket.IO relay nhúng thẳng vào FastAPI (KHÔNG cần server Node :3001).

Đủ để DEMO luồng PIN: khách đặt xe (giọng nói) ──> tài xế nhận cuốc ──> đến nơi
──> đọc PIN ──> tài xế nhập PIN ──> "lên xe an toàn".

Khớp đúng "hợp đồng" sự kiện mà frontend đang dùng:
  Khách (useVoiceApp/socket.js)         Tài xế (DriverView.jsx)
  emit  passenger-waiting {userId,name,accessibility}
  on    driver-accepted {driverName,licensePlate}
  on    driver-arrived  {driverName,licensePlate,pin}
  on    pin-verified / trip-completed
                                        emit driver-online {userId}
                                        emit driver-accept {userId}
                                        emit driver-arrive {userId}
                                        emit verify-pin {pin}
                                        emit trip-completed {userId}
                                        on   new-ride / ride-confirmed / pin-display
                                        on   pin-verified / pin-failed

Trạng thái giữ trong RAM, mô hình 1 chuyến đang chạy tại một thời điểm — vừa đủ cho
demo hackathon (1 khách + 1 tài xế). Nhiều chuyến song song KHÔNG nằm trong phạm vi.

Nếu KHÔNG có tài xế thật nào online, một "tài xế mô phỏng" (_simulate_driver) sẽ tự
chạy hết luồng để người xem một mình vẫn thấy trọn chuyến đi.
"""
import math
import random
import socketio

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")


def _haversine_m(lat1, lng1, lat2, lng2):
    """Distance in METERS between two lat/lng points (for the 'last 10m' UI)."""
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

# ---- state (1 chuyến đang hoạt động) -------------------------------------
_drivers: set[str] = set()       # sid của các tài xế đang online
_trip: dict = {}                 # {passenger_sid, passenger_name, accessibility, pin, driver_name, plate}

# Thông tin tài xế hiển thị cho khách. Đổi tuỳ thích — chỉ để demo.
_DEMO_DRIVERS = [
    {"name": "Anh Tuấn", "plate": "59-H1 234.56"},
    {"name": "Anh Minh", "plate": "51-F2 678.90"},
    {"name": "Chị Lan", "plate": "59-X3 112.23"},
]


def _coords(data):
    """Pull a {lat,lng} pair out of a socket payload, or None if missing/invalid."""
    data = data or {}
    lat, lng = data.get("lat"), data.get("lng")
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        return {"lat": float(lat), "lng": float(lng)}
    return None


def _driver_name(user_id):
    """Best-effort: lấy tên thật của tài xế từ Mongo; lỗi thì dùng mặc định."""
    try:
        from db import get_user
        u = get_user(user_id) or {}
        name = u.get("full_name") or u.get("name")
        if name:
            return name
    except Exception:
        pass
    return None


@sio.event
async def connect(sid, environ):
    pass


@sio.event
async def disconnect(sid):
    _drivers.discard(sid)
    if _trip.get("passenger_sid") == sid:
        _trip.clear()


@sio.on("driver-online")
async def driver_online(sid, data):
    _drivers.add(sid)
    # Nếu đang có khách chờ sẵn -> báo ngay cho tài xế vừa online.
    if _trip.get("passenger_sid"):
        await sio.emit("new-ride", {"accessibility": _trip.get("accessibility", "")}, to=sid)


@sio.on("passenger-waiting")
async def passenger_waiting(sid, data):
    data = data or {}
    drv = random.choice(_DEMO_DRIVERS)
    _trip.clear()
    _trip.update({
        "passenger_sid": sid,
        "passenger_name": data.get("name") or "Hành khách",
        "accessibility": data.get("accessibility", ""),
        "pin": f"{random.randint(0, 9999):04d}",
        "driver_name": drv["name"],
        "plate": drv["plate"],
        # Rider's pickup GPS — lets the driver see the distance to the (blind)
        # passenger for the "last 10 metres" find-each-other step. May be None.
        "passenger_loc": _coords(data),
    })
    nonce = _trip["nonce"] = random.randint(1, 1_000_000_000)
    # Báo cho mọi tài xế online là có cuốc mới.
    payload = {"accessibility": _trip["accessibility"]}
    for d in list(_drivers):
        await sio.emit("new-ride", payload, to=d)
    # Solo-reviewer fallback: KHÔNG có tài xế thật nào online -> tài xế mô phỏng
    # tự chạy hết luồng để người xem 1 mình (vd HR quét CV) thấy trọn chuyến đi.
    if not _drivers:
        sio.start_background_task(_simulate_driver, sid, nonce)


async def _simulate_driver(passenger_sid, nonce):
    """No human driver online -> auto-drive the trip so a solo viewer sees the
    full flow: accept -> approach -> arrive + PIN -> auto-verify -> complete.
    Bails if the trip changes (real driver accepts, passenger leaves, or a new
    booking starts)."""
    def alive():
        return _trip.get("passenger_sid") == passenger_sid and _trip.get("nonce") == nonce

    await sio.sleep(3)
    if not alive() or _trip.get("accepted"):
        return
    _trip["accepted"] = True
    _trip["simulated"] = True
    name, plate = _trip["driver_name"], _trip["plate"]
    await sio.emit("driver-accepted", {"driverName": name, "licensePlate": plate}, to=passenger_sid)

    # Approaching: a couple of decreasing distances so the rider hears reassurance
    # and (after arrival) the locator beacon ramps up.
    for meters, wait in ((40, 6), (10, 5)):
        await sio.sleep(wait)
        if not alive():
            return
        await sio.emit("driver-distance", {"meters": meters}, to=passenger_sid)

    await sio.sleep(3)
    if not alive():
        return
    await sio.emit("driver-arrived",
                   {"driverName": name, "licensePlate": plate, "pin": _trip["pin"]},
                   to=passenger_sid)

    # Let the rider hear the PIN read aloud (twice), then auto-confirm boarding.
    await sio.sleep(15)
    if not alive():
        return
    await sio.emit("pin-verified", {}, to=passenger_sid)

    await sio.sleep(7)
    if not alive():
        return
    await sio.emit("trip-completed", {}, to=passenger_sid)
    _trip.clear()


@sio.on("driver-location")
async def driver_location(sid, data):
    """Driver's live GPS. Relay the driver↔passenger distance to BOTH sides so
    the driver screen shows 'cách khách ~X m' and the (blind) passenger's phone
    tunes its locator beacon (louder/faster as the driver gets closer)."""
    if not _trip.get("passenger_sid"):
        return
    loc = _coords(data)
    if not loc:
        return
    _trip["driver_loc"] = loc
    ploc = _trip.get("passenger_loc")
    if not ploc:
        return
    meters = round(_haversine_m(loc["lat"], loc["lng"], ploc["lat"], ploc["lng"]))
    await sio.emit("ride-distance", {"meters": meters}, to=sid)                       # driver
    await sio.emit("driver-distance", {"meters": meters}, to=_trip["passenger_sid"])  # passenger


@sio.on("driver-accept")
async def driver_accept(sid, data):
    if not _trip.get("passenger_sid"):
        return
    _trip["accepted"] = True   # a real driver took it -> stop any simulated driver
    name = _driver_name((data or {}).get("userId")) or _trip["driver_name"]
    _trip["driver_name"] = name
    # -> Khách: "đã có tài xế nhận chuyến" (CHƯA lộ PIN).
    await sio.emit("driver-accepted",
                   {"driverName": name, "licensePlate": _trip["plate"]},
                   to=_trip["passenger_sid"])
    # -> Tài xế: hiện tên khách.
    await sio.emit("ride-confirmed",
                   {"passengerName": _trip["passenger_name"], "accessibility": _trip["accessibility"]},
                   to=sid)


@sio.on("driver-arrive")
async def driver_arrive(sid, data):
    if not _trip.get("passenger_sid"):
        return
    # -> Khách: đọc tên TX + biển số + ĐỌC PIN.
    await sio.emit("driver-arrived",
                   {"driverName": _trip["driver_name"],
                    "licensePlate": _trip["plate"],
                    "pin": _trip["pin"]},
                   to=_trip["passenger_sid"])
    # -> Tài xế: mở bàn phím nhập PIN.
    await sio.emit("pin-display",
                   {"passengerName": _trip["passenger_name"], "accessibility": _trip["accessibility"]},
                   to=sid)


@sio.on("verify-pin")
async def verify_pin(sid, data):
    if not _trip.get("passenger_sid"):
        return
    entered = str((data or {}).get("pin", ""))
    if entered == _trip["pin"]:
        await sio.emit("pin-verified", {}, to=sid)                       # tài xế
        await sio.emit("pin-verified", {}, to=_trip["passenger_sid"])    # khách
    else:
        await sio.emit("pin-failed", {}, to=sid)


@sio.on("trip-completed")
async def trip_completed(sid, data):
    if _trip.get("passenger_sid"):
        await sio.emit("trip-completed", {}, to=_trip["passenger_sid"])
    _trip.clear()


def attach(app):
    """Bọc FastAPI app: /socket.io/* -> Socket.IO, còn lại -> FastAPI."""
    return socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="socket.io")
