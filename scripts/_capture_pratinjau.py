import time, os, json, hmac, base64, hashlib
from playwright.sync_api import sync_playwright

OWNER_ID = "cmt2bwnfe000g4o72n2oa2qjx"
SECRET = os.environ.get("SESSION_SECRET") or os.environ.get("CRON_SECRET")
BASE = "http://localhost:3100"
OUT = "dogfood-output/pratinjau"
MAX_AGE = 60 * 60 * 24 * 30

def make_token(uid):
    exp = int(time.time() * 1000) + MAX_AGE * 1000
    body = base64.urlsafe_b64encode(f"{uid}.{exp}".encode()).rstrip(b"=").decode()
    sig = hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"

SCREENS = [
    ("/app", "01-dashboard", "Dashboard Ringkas", "Pantau pekerjaan, pengingat & omzet dari satu layar."),
    ("/app/pelanggan", "02-pelanggan", "Daftar Pelanggan", "Semua pelanggan tercatat rapi, siap dihubungi."),
    ("/app/pekerjaan", "03-pekerjaan", "Kelola Pekerjaan", "Jadwalkan & pantau pekerjaan teknisi real-time."),
    ("/app/layanan", "04-layanan", "Katalog Layanan & Harga", "Harga konsisten, termasuk harga khusus pelanggan."),
    ("/app/faktur", "05-faktur", "Invoice & Proforma", "Faktur profesional otomatis, kirim lewat WhatsApp."),
    ("/app/laporan", "06-laporan", "Laporan Keuangan", "Piutang, penerimaan, dan insentif teknisi otomatis."),
    ("/app/teknisi", "07-teknisi", "Kelola Tim Teknisi", "Atur teknisi & lihat performa masing-masing."),
    ("/app/unit", "08-unit", "Unit AC Pelanggan", "Riwayat tiap unit AC lengkap dengan jadwal servis."),
]

os.makedirs(OUT, exist_ok=True)
tok = make_token(OWNER_ID)
manifest = []
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.new_context(viewport={"width":402,"height":874}, device_scale_factor=2, is_mobile=True)
    ctx.add_cookies([{"name":"aircon_tech","value":tok,"url":BASE}])
    pg = ctx.new_page()
    errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    for route, file, title, caption in SCREENS:
        try:
            r = pg.goto(f"{BASE}{route}", wait_until="networkidle", timeout=30000)
            pg.wait_for_timeout(1200)
            st = r.status if r else 0
            pg.screenshot(path=f"{OUT}/{file}.png", full_page=True)
            blen = len(pg.inner_text("body"))
            manifest.append({"route":route,"file":f"{file}.png","title":title,"caption":caption,"status":st,"bodyLen":blen})
            print(f"  {file}: HTTP {st}, teks {blen} char")
        except Exception as e:
            print(f"  {file}: GAGAL {str(e)[:80]}")
            manifest.append({"route":route,"file":f"{file}.png","title":title,"caption":caption,"error":str(e)[:120]})
    open(f"{OUT}/manifest.json","w").write(json.dumps(manifest, indent=2))
    print("exceptions:", len(errs))
    ctx.close()
