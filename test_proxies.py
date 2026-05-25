"""
Test Suborbital proxies (from server/.env) and Webshare proxies.
Suborbital: 10 verification tests. Webshare: all proxies.
Output: Verified Proxies, Working Proxies, and errors only when they occur.
"""
import sys
import urllib.request
import concurrent.futures
from pathlib import Path

BASE = Path(__file__).parent
ENV_FILE = BASE / "server" / ".env"
PROXY_FILE = BASE / "Webshare 10 proxies.txt"
TEST_URL = "https://api.ipify.org?format=json"
TIMEOUT = 5
SUBORBITAL_TESTS = 10


def load_env(path: Path) -> dict:
    """Parse .env file into key=value dict."""
    out = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def parse_webshare_line(line: str) -> dict | None:
    """Parse ip:port:username:password format."""
    line = line.strip()
    if not line:
        return None
    parts = line.split(":")
    if len(parts) != 4:
        return None
    ip, port, user, pw = parts
    return {
        "url": f"http://{user}:{pw}@{ip}:{port}",
        "addr": f"{ip}:{port}",
    }


def test_one(proxy_url: str) -> tuple[bool, str]:
    """Test a single proxy URL. Returns (success, result_or_error)."""
    try:
        handler = urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url})
        opener = urllib.request.build_opener(handler)
        opener.addheaders = [("User-Agent", "Mozilla/5.0 (Test)")]
        req = urllib.request.Request(TEST_URL)
        with opener.open(req, timeout=TIMEOUT) as resp:
            return True, resp.read().decode().strip()
    except Exception as e:
        return False, str(e)


def main():
    env = load_env(ENV_FILE)
    sub_user = env.get("SUBORBIT_USERNAME", "")
    sub_pass = env.get("SUBORBIT_PASSWORD", "")
    sub_host = env.get("SUBORBIT_HOST", "")
    sub_port = env.get("SUBORBIT_PORT", "")

    verified = 0
    sub_errors = []

    if sub_user and sub_pass and sub_host and sub_port:
        sub_url = f"http://{sub_user}:{sub_pass}@{sub_host}:{sub_port}"
        for _ in range(SUBORBITAL_TESTS):
            ok, msg = test_one(sub_url)
            if ok:
                verified += 1
            else:
                sub_errors.append(msg)
    else:
        sub_errors.append("Missing SUBORBIT_* in server/.env")

    working_webshare = []
    webshare_errors = []
    total_webshare = 0

    if PROXY_FILE.exists():
        lines = PROXY_FILE.read_text(encoding="utf-8").splitlines()
        webshare = [(parse_webshare_line(l), l.strip()) for l in lines]
        webshare = [(p, raw) for p, raw in webshare if p]
        total_webshare = len(webshare)

        with concurrent.futures.ThreadPoolExecutor(max_workers=15) as ex:
            futures = {ex.submit(test_one, p["url"]): (p, raw) for p, raw in webshare}
            for fut in concurrent.futures.as_completed(futures):
                p, raw = futures[fut]
                ok, msg = fut.result()
                if ok:
                    working_webshare.append(p["addr"])
                else:
                    webshare_errors.append((p["addr"], msg))
    else:
        webshare_errors.append(("", f"File not found: {PROXY_FILE}"))
    sys.stdout.write(f"Suborbital: {verified} / {SUBORBITAL_TESTS} working\n")
    sys.stdout.write(f"Webshare: {len(working_webshare)} / {total_webshare if total_webshare else '0'} working\n")
    sys.stdout.flush()
    if sub_errors:
        for e in sub_errors:
            sys.stdout.write(f"Error: {e}\n")
            sys.stdout.flush()
    if webshare_errors:
        for addr, e in webshare_errors:
            sys.stdout.write(f"Error: {addr}: {e}\n" if addr else f"Error: {e}\n")
            sys.stdout.flush()


if __name__ == "__main__":
    sys.stdout.write("Testing proxies...\n")
    sys.stdout.flush()
    main()
    sys.stdout.write("Done.\n")
    sys.stdout.flush()
