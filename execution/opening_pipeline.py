"""Fira opening-film pipeline (PAID — ask Hampus before running).
  still <out.png> "<prompt>"                 gemini-3.1-flash-image, 9:16  (~$0.04)
  i2v   <in.png> <out.mp4> "<prompt>" [model] Veo 3.1 image-to-video, 9:16 720p 8s, keeps audio (~$1 fast)
Key: GEMINI_IMAGE_API_KEY in clients/happa-matcha/.env (never printed)."""
import base64, json, sys, time, urllib.request, urllib.error
from pathlib import Path
from dotenv import dotenv_values
ENV = Path(__file__).resolve().parents[2] / "happa-matcha" / ".env"
KEY = dotenv_values(ENV)["GEMINI_IMAGE_API_KEY"].strip()
BASE = "https://generativelanguage.googleapis.com/v1beta"
H = {"x-goog-api-key": KEY, "Content-Type": "application/json"}

def call(url, data=None, raw=False):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data else None, headers=H)
    try:
        r = urllib.request.urlopen(req, timeout=180)
        return r.read() if raw else json.load(r)
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read()[:400].decode(errors="replace")); sys.exit(1)

def still(out, prompt, model="gemini-3.1-flash-image"):
    body = {"contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": "9:16"}}}
    d = call(f"{BASE}/models/{model}:generateContent", body)
    for part in d["candidates"][0]["content"]["parts"]:
        if "inlineData" in part:
            Path(out).write_bytes(base64.b64decode(part["inlineData"]["data"]))
            print(f"saved {out} ({part['inlineData']['mimeType']})"); return
    print("no image:", json.dumps(d)[:300]); sys.exit(1)

def i2v(src, out, prompt, model="veo-3.1-fast-generate-preview"):
    img = Path(src).read_bytes()
    mime = "image/png" if img[:4] == b"\x89PNG" else "image/jpeg"
    body = {"instances": [{"prompt": prompt, "image": {"bytesBase64Encoded": base64.b64encode(img).decode(), "mimeType": mime}}],
            "parameters": {"aspectRatio": "9:16", "resolution": "720p", "durationSeconds": 8}}
    op = call(f"{BASE}/models/{model}:predictLongRunning", body)
    name = op["name"]; t0 = time.time(); print("submitted")
    while True:
        time.sleep(12)
        st = call(f"{BASE}/{name}")
        if st.get("done"): break
        if time.time() - t0 > 900: print("timeout"); sys.exit(1)
    if "error" in st: print("ERROR", st["error"]); sys.exit(1)
    resp = st.get("response", {})
    vids = resp.get("generateVideoResponse", {}).get("generatedSamples") or resp.get("generatedSamples") or []
    if not vids: print("no video:", json.dumps(resp)[:400]); sys.exit(1)
    Path(out).write_bytes(call(vids[0]["video"]["uri"], raw=True))
    print(f"saved {out} in {int(time.time()-t0)}s")

if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "still": still(sys.argv[2], sys.argv[3])
    elif cmd == "i2v": i2v(sys.argv[2], sys.argv[3], sys.argv[4], *sys.argv[5:6])
