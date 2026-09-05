"""Generate an opening film with Veo 3.1 (Gemini API). PAID — ask Hampus before running.
Usage: python3 execution/veo_gen.py <model> <out.mp4> "<prompt>"
Models: veo-3.1-fast-generate-preview (~$1/8s clip), veo-3.1-generate-preview, veo-3.1-lite-generate-preview
Post: ffmpeg -an -crf 24 -movflags +faststart, scp to VPS /opt/fira/media/, set theme.openingVideo."""
import json, sys, time, urllib.request, urllib.error
from dotenv import dotenv_values
ENV = "/Users/hampusgrune/Library/Mobile Documents/com~apple~CloudDocs/Cursus Capital/Business/clients/happa-matcha/.env"
KEY = dotenv_values(ENV)["GEMINI_IMAGE_API_KEY"].strip()
BASE = "https://generativelanguage.googleapis.com/v1beta"
H = {"x-goog-api-key": KEY, "Content-Type": "application/json"}

model = sys.argv[1]; out = sys.argv[2]; prompt = sys.argv[3]
body = {"instances": [{"prompt": prompt}],
        "parameters": {"aspectRatio": "9:16", "resolution": "720p", "durationSeconds": 8}}
def call(url, data=None, raw=False):
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data else None, headers=H)
    try:
        r = urllib.request.urlopen(req, timeout=120)
        return r.read() if raw else json.load(r)
    except urllib.error.HTTPError as e:
        print("HTTP", e.code, e.read()[:400].decode(errors="replace")); sys.exit(1)

op = call(f"{BASE}/models/{model}:predictLongRunning", body)
name = op["name"]; print("submitted:", name.split("/")[-1][:12], "…")
t0 = time.time()
while True:
    time.sleep(12)
    st = call(f"{BASE}/{name}")
    if st.get("done"):
        break
    print(f"  …{int(time.time()-t0)}s")
    if time.time() - t0 > 900: print("timeout"); sys.exit(1)
if "error" in st: print("ERROR", st["error"]); sys.exit(1)
resp = st.get("response", {})
vids = resp.get("generateVideoResponse", {}).get("generatedSamples") or resp.get("generatedSamples") or []
if not vids: print("no video in response:", json.dumps(resp)[:500]); sys.exit(1)
uri = vids[0]["video"]["uri"]
data = call(uri, raw=True)
open(out, "wb").write(data)
print(f"saved {out} {len(data)//1024} KB in {int(time.time()-t0)}s")
