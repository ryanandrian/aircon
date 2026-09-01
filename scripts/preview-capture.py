#!/usr/bin/env python3
"""
preview-capture.py — Tangkap layar panel admin tenant untuk showcase /pratinjau (Aircon).

TUJUAN: hemat token — seluruh alur dogfood-capture-preview jadi SATU perintah, konsisten:
  - Ukuran SERAGAM ~1920x1200 pada ZOOM 125% (device_scale_factor 1.25, viewport CSS 1536x960)
    → output ~1920x1200, sama zoom dengan contoh owner.
  - VIEWPORT capture (BUKAN full_page) → tinggi terbatas, aman utk pelanggan/data besar.
  - Rapikan: URL localhost -> https://app.aircon.id, buang Next.js dev tools overlay.
  - Opsional: upload S3 (boto3) + buat/update PreviewItem (psycopg2).

PRASYARAT:
  - Dev server jalan (PORT default 3100) DGN dev-bypass middleware utk /app
    (devCapture: NODE_ENV!=production && cookie aircon_tech && path /app). HAPUS bypass sebelum commit.
  - Chromium CDP di 127.0.0.1:9222.
  - ENV: SESSION_SECRET / CRON_SECRET (mint cookie owner). Utk --upload: .secrets/vps-infra-credentials.txt (S3_*).
    Utk --save-preview: DIRECT_URL / DATABASE_URL.

PEMAKAIAN:
  python3 scripts/preview-capture.py --path /app/pelanggan/<id> --out dogfood-output/x.png \
    [--owner <userId>] [--port 3100] \
    [--upload] [--save-preview --title "Detail Pelanggan" --category "Pelanggan" --caption "..." --sort 3]

Owner demo default: cmt2bwnfe000g4o72n2oa2qjx (tenant demo-ac-jaya).
"""
import os, sys, time, hmac, base64, hashlib, argparse, re, random, pathlib

ap = argparse.ArgumentParser()
ap.add_argument("--path", required=True)
ap.add_argument("--out", default="dogfood-output/capture.png")
ap.add_argument("--owner", default="cmt2bwnfe000g4o72n2oa2qjx")
ap.add_argument("--port", default="3100")
ap.add_argument("--vw", type=int, default=1536)   # viewport CSS width
ap.add_argument("--vh", type=int, default=874)    # viewport CSS height -> output ~1093 @1.25 (rasio ~16:9 seperti contoh owner)
ap.add_argument("--dpr", type=float, default=1.25)  # zoom 125%
ap.add_argument("--upload", action="store_true")
ap.add_argument("--save-preview", dest="save_preview", action="store_true")
ap.add_argument("--title"); ap.add_argument("--category", default="Umum")
ap.add_argument("--caption", default=""); ap.add_argument("--sort", type=int, default=99)
ap.add_argument("--mobile", action="store_true")  # layar HP teknisi: bingkai di kanvas 1920x1093
ap.add_argument("--tech", default="")             # userId teknisi utk cookie (mode mobile /t)
a = ap.parse_args()

# Mode mobile: viewport HP + cookie teknisi. Hasil di-compose ke kanvas seragam nanti.
if a.mobile:
    a.vw = a.vw if "--vw" in " ".join(sys.argv) else 412
    a.vh = a.vh if "--vh" in " ".join(sys.argv) else 900
    a.dpr = a.dpr if "--dpr" in " ".join(sys.argv) else 2.0
    if a.tech:
        a.owner = a.tech  # cookie pakai userId teknisi (valid di /t)


BASE = f"http://localhost:{a.port}"
SECRET = os.environ.get("SESSION_SECRET") or os.environ.get("CRON_SECRET")
if not SECRET:
    sys.exit("ENV SESSION_SECRET / CRON_SECRET tak ada")

def mint(uid):
    exp = int(time.time() * 1000) + 1000 * 60 * 60 * 24 * 30
    b = base64.urlsafe_b64encode(f"{uid}.{exp}".encode()).rstrip(b"=").decode()
    return f"{b}." + hmac.new(SECRET.encode(), b.encode(), hashlib.sha256).hexdigest()

from playwright.sync_api import sync_playwright
pathlib.Path(a.out).parent.mkdir(parents=True, exist_ok=True)
errs = []
with sync_playwright() as p:
    br = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = br.new_context(viewport={"width": a.vw, "height": a.vh}, device_scale_factor=a.dpr)
    ctx.add_cookies([{"name": "aircon_tech", "value": mint(a.owner), "url": BASE}])
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(f"{BASE}{a.path}", wait_until="networkidle", timeout=60000)
    pg.wait_for_timeout(1200)
    pg.evaluate("""() => {
      document.querySelectorAll('nextjs-portal, [data-nextjs-toast]').forEach(x=>x.remove());
      const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const ns=[];
      while(w.nextNode()){ if(w.currentNode.nodeValue.includes('localhost:3000')) ns.push(w.currentNode); }
      ns.forEach(n=>n.nodeValue=n.nodeValue.replace(/https?:\\/\\/localhost:\\d+/g,'https://app.aircon.id'));
    }""")
    pg.wait_for_timeout(200)
    if a.mobile:
        raw = a.out.replace(".png", ".raw.png")
        pg.screenshot(path=raw)  # HP: viewport tetap (proporsi wajar), bukan full_page
        ctx.close()
    else:
        pg.screenshot(path=a.out)  # VIEWPORT saja (bounded), BUKAN full_page
        ctx.close()

# Mode mobile: compose screenshot HP ke kanvas 1920x1093 (HP di tengah, latar gradasi, sudut membulat + bayangan).
if a.mobile:
    from PIL import Image, ImageDraw, ImageFilter
    CW, CH = 1920, 1093
    phone = Image.open(raw).convert("RGBA")
    # tinggi HP target ~ 92% kanvas
    target_h = int(CH * 0.92)
    scale = target_h / phone.height
    target_w = int(phone.width * scale)
    phone = phone.resize((target_w, target_h), Image.LANCZOS)
    # sudut membulat
    radius = 46
    mask = Image.new("L", phone.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, phone.width, phone.height], radius=radius, fill=255)
    # kanvas gradasi biru lembut
    canvas = Image.new("RGB", (CW, CH), (238, 244, 251))
    top, bot = (224, 238, 250), (243, 247, 252)
    for y in range(CH):
        t = y / CH
        canvas.paste(tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)), [0, y, CW, y + 1])
    px = (CW - phone.width) // 2
    py = (CH - phone.height) // 2
    # bayangan
    shadow = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    sd = Image.new("RGBA", phone.size, (0, 0, 0, 0))
    ImageDraw.Draw(sd).rounded_rectangle([0, 0, phone.width, phone.height], radius=radius, fill=(15, 23, 42, 90))
    shadow.paste(sd, (px, py + 14), sd)
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow)
    canvas.paste(phone, (px, py), mask)
    canvas.convert("RGB").save(a.out)
    os.remove(raw)
print(f"CAPTURE OK -> {a.out} | {'MOBILE frame 1920x1093' if a.mobile else f'viewport {a.vw}x{a.vh}@{a.dpr}x (zoom {round(a.dpr*100)}%)'} | exceptions {len(errs)}")
for e in errs[:4]:
    print("ERR", e[:120])

if not (a.upload or a.save_preview):
    sys.exit(0)

# --- Upload S3 (boto3) ---
def secret(k):
    txt = open(".secrets/vps-infra-credentials.txt", encoding="utf8").read()
    m = re.search(rf'^\s*(?:export\s+)?{k}\s*=\s*["\']?([^"\'\n#]+)', txt, re.M)
    return m.group(1).strip() if m else None

import boto3
ENDPOINT, BUCKET = secret("S3_ENDPOINT"), secret("S3_BUCKET")
REGION = secret("S3_REGION") or "us-east-1"
PUBLIC_BASE = secret("S3_PUBLIC_BASE_URL") or f"{ENDPOINT.rstrip('/')}/{BUCKET}"
s3 = boto3.client("s3", endpoint_url=ENDPOINT, region_name=REGION,
                  aws_access_key_id=secret("S3_ACCESS_KEY_ID"), aws_secret_access_key=secret("S3_SECRET_ACCESS_KEY"))
rand = f"{int(time.time()*1000):x}-{random.randint(0x100000,0xffffff):x}"
key = f"assets/preview/{rand}.png"
with open(a.out, "rb") as f:
    s3.put_object(Bucket=BUCKET, Key=key, Body=f.read(), ContentType="image/png", ACL="public-read")
public_url = f"{PUBLIC_BASE.rstrip('/')}/{key}"
print(f"UPLOAD OK -> {public_url}")

# --- Simpan PreviewItem (psycopg2) ---
if a.save_preview:
    if not a.title:
        sys.exit("--save-preview butuh --title")
    import psycopg2
    dsn = os.environ.get("DIRECT_URL") or os.environ.get("DATABASE_URL")
    dsn = re.sub(r"\?.*$", "", dsn)  # buang query params prisma
    conn = psycopg2.connect(dsn); conn.autocommit = True
    cur = conn.cursor()
    cur.execute('SELECT id, "imageUrl" FROM "PreviewItem" WHERE title=%s LIMIT 1', (a.title,))
    row = cur.fetchone()
    if row:
        old_id, old_url = row
        if a.caption:
            cur.execute('UPDATE "PreviewItem" SET "imageUrl"=%s, caption=%s, "updatedAt"=now() WHERE id=%s', (public_url, a.caption, old_id))
        else:
            cur.execute('UPDATE "PreviewItem" SET "imageUrl"=%s, "updatedAt"=now() WHERE id=%s', (public_url, old_id))
        print(f"PREVIEW UPDATED -> {old_id} | {a.title} [{a.category}]")
        if old_url and old_url != public_url and f"/{BUCKET}/" in old_url:
            try:
                s3.delete_object(Bucket=BUCKET, Key=old_url.split(f"/{BUCKET}/", 1)[1])
                print("Gambar lama dihapus dari S3")
            except Exception as e:
                print("(gambar lama tak terhapus:", e, ")")
    else:
        # id: PreviewItem.id = @default(cuid()) di Prisma (bukan default DB) -> generate cuid-like di sini.
        import base64 as _b64
        ts = format(int(time.time() * 1000), "x")
        rnd = "".join(random.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(16))
        new_id = ("c" + ts + rnd)[:25].ljust(25, "0")
        cur.execute(
            'INSERT INTO "PreviewItem" (id, title, category, caption, "imageUrl", "sortOrder", published, "updatedAt") VALUES (%s,%s,%s,%s,%s,%s,true,now()) RETURNING id',
            (new_id, a.title, a.category, a.caption, public_url, a.sort))
        print(f"PREVIEW CREATED -> {cur.fetchone()[0]} | {a.title} [{a.category}]")
    cur.close(); conn.close()
