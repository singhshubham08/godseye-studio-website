"""Serve the static Godseye Studio site plus a working backend for chat and lead capture."""

import hashlib
import hmac
import http.cookies
import http.server
import json
import os
import socketserver
import sqlite3
import sys
import time
import urllib.parse
import urllib.request
from email.message import EmailMessage
from smtplib import SMTP

TECHFLUX_CSS = """
<style data-techflux-theme="true">
:root {
  --background: #040d1a;
  --foreground: #eaf7ff;
  --muted-foreground: #9cc9f1;
  --card: rgba(11, 26, 42, 0.82);
  --card-strong: #0e233f;
  --border: rgba(120, 191, 255, 0.28);
  --primary: #42b8ff;
  --primary-foreground: #041521;
  --gold: linear-gradient(135deg, #71ddff 0%, #2cb6ff 50%, #0a7cff 100%);
  --shadow: rgba(18, 106, 194, 0.3);
}

html {
  background: var(--background);
}

body {
  background:
    radial-gradient(circle at top left, rgba(66, 184, 255, 0.22), transparent 22%),
    radial-gradient(circle at bottom right, rgba(41, 117, 255, 0.18), transparent 28%),
    linear-gradient(135deg, #020b14 0%, #071a2e 32%, #0a1730 100%);
  color: var(--foreground) !important;
  font-family: "Inter", "Segoe UI", sans-serif;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: linear-gradient(rgba(138, 196, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(138, 196, 255, 0.04) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: radial-gradient(circle at center, black 25%, transparent 100%);
}

header,
header nav,
header > div,
main,
section,
footer,
article,
.card,
[class*="rounded-3xl"],
[class*="rounded-2xl"],
[class*="rounded-xl"] {
  border-color: var(--border) !important;
}

header {
  background: rgba(4, 14, 24, 0.72) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(125, 190, 255, 0.18);
}

header a,
header button,
main a,
main button,
footer a,
footer button {
  transition: all 180ms ease !important;
}

.bg-background,
body {
  background-color: var(--background) !important;
}

.bg-card,
.bg-card\\/80,
.bg-card\\/90,
.bg-card\\/95,
[class*="bg-card"] {
  background: linear-gradient(180deg, rgba(13, 32, 51, 0.94), rgba(9, 22, 38, 0.94)) !important;
  box-shadow: 0 20px 50px -24px rgba(28, 130, 232, 0.55) !important;
}

.bg-primary {
  background: linear-gradient(135deg, #71ddff 0%, #2cb6ff 50%, #0a7cff 100%) !important;
}

.bg-gold {
  background: linear-gradient(135deg, #71ddff 0%, #2cb6ff 50%, #0a7cff 100%) !important;
}

.text-foreground,
body,
main,
section,
article,
button,
a {
  color: var(--foreground) !important;
}

.text-muted-foreground,
.text-slate-300,
.text-slate-400,
.text-slate-500 {
  color: var(--muted-foreground) !important;
}

.text-primary-foreground {
  color: var(--primary-foreground) !important;
}

.border-border,
[class*="border-"] {
  border-color: var(--border) !important;
}

.shadow-2xl,
.shadow-xl,
.shadow-lg,
[class*="shadow-"] {
  box-shadow: 0 24px 60px -30px rgba(35, 118, 230, 0.45) !important;
}

button,
.rounded-full,
.rounded-xl,
.rounded-2xl,
.rounded-3xl {
  border: 1px solid rgba(138, 196, 255, 0.2) !important;
}

button:hover,
a:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

img {
  filter: saturate(1.08) contrast(1.05);
}
</style>
"""

TECHFLUX_LINK = '<link rel="stylesheet" href="/assets/techflux-upgrade.css" />'
ROOPSETU_LINK = '<link rel="stylesheet" href="/assets/roopsetu-portfolio.css" />'
ROOPSETU_SCRIPT = '<script src="/assets/roopsetu-portfolio.js"></script>'
TECHFLUX_SCRIPTS = '''
<script src="https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/framer-motion@11.11.9/dist/framer-motion.umd.js"></script>
<script src="/assets/techflux-upgrade.js"></script>
'''

ROUTES = {
    "/": "home.html",
    "/work": "work.html",
    "/services": "services.html",
    "/about": "about.html",
    "/contact": "contact.html",
    "/why-us": "why-us.html",
    "/privacy": "privacy.html",
    "/work/velora": "work-velora.html",
    "/work/bloomify": "work-bloomify.html",
    "/work/urbanedge": "work-urbanedge.html",
    "/work/technova": "work-technova.html",
}

PORT = int(os.environ.get("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8123))
DB_PATH = os.environ.get("GE_DB_PATH", os.path.join(os.getcwd(), "data", "godseye_leads.db"))
IS_RENDER = os.environ.get("RENDER") == "true"
ADMIN_USERNAME = os.environ.get("GE_ADMIN_USERNAME", "")
ADMIN_PASSWORD = os.environ.get("GE_ADMIN_PASSWORD", "")
SESSION_SECRET = os.environ.get("GE_SESSION_SECRET") or ("" if IS_RENDER else os.urandom(32).hex())
if IS_RENDER and not all((ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_SECRET)):
    raise RuntimeError("Set GE_ADMIN_USERNAME, GE_ADMIN_PASSWORD, and GE_SESSION_SECRET in Render.")
LOVABLE_API_KEY = os.environ.get("LOVABLE_API_KEY")
LOVABLE_API_URL = os.environ.get("LOVABLE_API_URL", "https://ai.lovable.dev/api/chat")
CHAT_SESSIONS = {}
RATE_LIMITS = {}
RATE_LIMIT_SECONDS = 5

SITE_SERVICES = {
    "website": "Website design and development for business sites, landing pages, ecommerce, custom apps, and conversion-focused builds.",
    "branding": "Brand identity, logo design, creative direction, and visual systems that make your brand memorable.",
    "automation": "AI automation and chatbot systems, workflow design, WhatsApp automations, and lead capture flows.",
    "marketing": "Digital marketing strategy, landing page optimization, SEO foundations, and campaign planning.",
    "team": "Our team can help scope the right solution based on your goals, timeline, and budget."
}


def ensure_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            service TEXT,
            project_description TEXT,
            budget TEXT,
            timeline TEXT,
            name TEXT,
            email TEXT,
            whatsapp TEXT,
            consent INTEGER,
            ip_address TEXT,
            created_at TEXT
        )
        """
    )
    conn.commit()
    conn.close()


def read_json_body(handler):
    length = int(handler.headers.get("Content-Length", "0") or "0")
    raw = handler.rfile.read(length) if length else b"{}"
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return {}


def send_json(handler, payload, status=200):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def sign_value(value):
    return hmac.new(SESSION_SECRET.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def set_auth_cookie(handler, username):
    cookie = http.cookies.SimpleCookie()
    cookie["ge_admin_session"] = f"{username}:{sign_value(username)}"
    cookie["ge_admin_session"]["path"] = "/"
    cookie["ge_admin_session"]["httponly"] = True
    cookie["ge_admin_session"]["samesite"] = "Lax"
    handler.send_header("Set-Cookie", cookie["ge_admin_session"].OutputString())


def get_admin_session(handler):
    raw_cookie = handler.headers.get("Cookie", "")
    cookie = http.cookies.SimpleCookie()
    cookie.load(raw_cookie)
    session = cookie.get("ge_admin_session")
    if not session:
        return None
    value = session.value
    if ":" not in value:
        return None
    username, sig = value.split(":", 1)
    if not hmac.compare_digest(sig, sign_value(username)):
        return None
    if username != ADMIN_USERNAME:
        return None
    return username


def valid_email(value):
    return bool(value) and "@" in value and "." in value


def get_client_ip(handler):
    forwarded = handler.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return handler.client_address[0]


def rate_limit_allowed(handler):
    ip = get_client_ip(handler)
    now = time.time()
    last = RATE_LIMITS.get(ip, 0)
    if now - last < RATE_LIMIT_SECONDS:
        return False
    RATE_LIMITS[ip] = now
    return True


def normalize_message(text):
    return (text or "").strip().lower()


def infer_service(message):
    msg = normalize_message(message)
    if any(token in msg for token in ["website", "website design", "landing page", "web design", "shop", "app development", "web development"]):
        return "website"
    if any(token in msg for token in ["branding", "logo", "brand", "identity", "visual design"]):
        return "branding"
    if any(token in msg for token in ["automation", "ai automation", "chatbot", "workflow", "whatsapp automation"]):
        return "automation"
    if any(token in msg for token in ["marketing", "seo", "growth", "ads", "campaign", "digital marketing"]):
        return "marketing"
    return None


def get_service_description(service):
    return SITE_SERVICES.get(service, SITE_SERVICES["team"])


def maybe_lovable_reply(prompt):
    if not LOVABLE_API_KEY:
        return None
    try:
        payload = json.dumps({
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
        }).encode("utf-8")
        req = urllib.request.Request(
            LOVABLE_API_URL,
            data=payload,
            headers={
                "Authorization": f"Bearer {LOVABLE_API_KEY}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if isinstance(data, dict):
                choices = data.get("choices") or []
                if choices:
                    msg = choices[0].get("message", {}).get("content")
                    if msg:
                        return str(msg).strip()
                content = data.get("content")
                if content:
                    return str(content).strip()
    except Exception:
        return None
    return None


def save_lead(session):
    if session.get("lead_saved"):
        return False
    if not session.get("consent"):
        return False
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        INSERT INTO leads (session_id, service, project_description, budget, timeline, name, email, whatsapp, consent, ip_address, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            session.get("session_id") or "",
            session.get("service") or "",
            session.get("project_description") or "",
            session.get("budget") or "",
            session.get("timeline") or "",
            session.get("name") or "",
            session.get("email") or "",
            session.get("whatsapp") or "",
            1,
            session.get("ip_address") or "",
            time.strftime("%Y-%m-%d %H:%M:%S")
        )
    )
    conn.commit()
    conn.close()
    session["lead_saved"] = True
    send_admin_email(session)
    return True


def send_admin_email(session):
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    notify_email = os.environ.get("NOTIFY_EMAIL")
    if not all([smtp_host, smtp_user, smtp_pass, notify_email]):
        return False
    try:
        msg = EmailMessage()
        msg["Subject"] = "New God's Eye Studio lead"
        msg["From"] = smtp_user
        msg["To"] = notify_email
        msg.set_content(
            "\n".join([
                "New Godseye Studio lead received.",
                f"Name: {session.get('name') or 'N/A'}",
                f"Email: {session.get('email') or 'N/A'}",
                f"Service: {session.get('service') or 'N/A'}",
                f"Budget: {session.get('budget') or 'N/A'}",
                f"Timeline: {session.get('timeline') or 'N/A'}",
                f"Project: {session.get('project_description') or 'N/A'}",
            ])
        )
        with SMTP(smtp_host, 587, timeout=12) as smtp:
            smtp.starttls()
            smtp.login(smtp_user, smtp_pass)
            smtp.send_message(msg)
        return True
    except Exception:
        return False


def build_chatbot_response(session_id, user_message=None, quick_action=None, ip_address=""):
    session = CHAT_SESSIONS.setdefault(
        session_id,
        {
            "phase": "intro",
            "service": None,
            "project_description": "",
            "budget": "",
            "timeline": "",
            "name": "",
            "email": "",
            "whatsapp": "",
            "consent": False,
            "lead_saved": False,
            "session_id": session_id,
            "ip_address": ip_address,
        },
    )
    session["session_id"] = session_id
    session["ip_address"] = ip_address or session.get("ip_address") or ""

    if quick_action:
        session["service"] = infer_service(quick_action) or "team"
        session["phase"] = "project"
        return {
            "reply": f"Great choice. {get_service_description(session['service'])} Tell us a bit about your project goals and the experience you want to create.",
            "phase": "project",
            "requires_contact": False,
        }

    message = (user_message or "").strip()
    lower_msg = normalize_message(message)

    if not message:
        return {
            "reply": "I can help with websites, branding, AI automation, and digital marketing. What would you like to build?",
            "phase": session["phase"],
            "requires_contact": False,
        }

    if session["phase"] == "intro":
        detected = infer_service(message)
        if detected:
            session["service"] = detected
            session["phase"] = "project"
            return {
                "reply": f"Great choice. {get_service_description(detected)} Tell us a bit about the project goals and what success looks like.",
                "phase": "project",
                "requires_contact": False,
            }
        if any(word in lower_msg for word in ["hello", "hi", "hey", "help", "services", "project", "quote"]):
            return {
                "reply": "We design websites, branding, AI automation, and digital marketing systems. What do you want to build today?",
                "phase": "intro",
                "requires_contact": False,
            }
        return {
            "reply": "I can help scope the right solution for your brand. Are you looking for a website, branding, AI automation, or digital marketing support?",
            "phase": "intro",
            "requires_contact": False,
        }

    if session["phase"] == "project":
        session["project_description"] = message
        session["phase"] = "budget"
        return {
            "reply": "Thanks. What is your estimated budget range for this project?",
            "phase": "budget",
            "requires_contact": False,
        }

    if session["phase"] == "budget":
        session["budget"] = message
        session["phase"] = "timeline"
        return {
            "reply": "Great. What timeline are you aiming for?",
            "phase": "timeline",
            "requires_contact": False,
        }

    if session["phase"] == "timeline":
        session["timeline"] = message
        session["phase"] = "name"
        return {
            "reply": "Before we continue, what is your name?",
            "phase": "name",
            "requires_contact": False,
        }

    if session["phase"] == "name":
        session["name"] = message
        session["phase"] = "email"
        return {
            "reply": "Thanks. What is your email address?",
            "phase": "email",
            "requires_contact": False,
        }

    if session["phase"] == "email":
        if not valid_email(message):
            return {
                "reply": "Please provide a valid email address so we can contact you.",
                "phase": "email",
                "requires_contact": False,
            }
        session["email"] = message
        session["phase"] = "consent"
        return {
            "reply": "Before we save your enquiry, do you consent to us storing your project details and contacting you regarding this project? Reply yes or no.",
            "phase": "consent",
            "requires_contact": True,
        }

    if session["phase"] == "consent":
        if any(word in lower_msg for word in ["yes", "y", "agree", "ok", "sure"]):
            session["consent"] = True
            session["phase"] = "complete"
            save_lead(session)
            return {
                "reply": "Thank you! Our team will review your project and get in touch.",
                "phase": "complete",
                "requires_contact": False,
            }
        session["consent"] = False
        return {
            "reply": "No problem. You can still ask questions here and we can continue later. If you want to talk to our team directly, use the contact page.",
            "phase": "intro",
            "requires_contact": False,
        }

    if any(word in lower_msg for word in ["website", "branding", "automation", "marketing", "service", "help"]):
        service = infer_service(message) or session.get("service") or "team"
        return {
            "reply": f"We help with {service.title()} services. {get_service_description(service)} If you want, tell us a little about your goals and we can help scope the right solution.",
            "phase": session["phase"],
            "requires_contact": False,
        }

    ai_reply = maybe_lovable_reply(
        f"You are God's Eye Studio AI assistant. Be professional, concise, and helpful. User asks: {message}"
    )
    if ai_reply:
        return {"reply": ai_reply, "phase": session["phase"], "requires_contact": False}

    return {
        "reply": "I can help with website design, branding, AI automation, and digital marketing. Tell me what you are building and I will guide you to the right service.",
        "phase": session["phase"],
        "requires_contact": False,
    }


def admin_dashboard_html():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>God's Eye Studio Admin</title>
      <style>
        body { margin: 0; font-family: Inter, Segoe UI, sans-serif; background: #070b13; color: #f5f3ff; }
        .wrap { max-width: 1200px; margin: 0 auto; padding: 32px 20px 80px; }
        .topbar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(126,231,255,.25); padding: 0 0 18px; }
        .pill { display: inline-block; border: 1px solid rgba(126,231,255,.25); border-radius: 999px; padding: 8px 12px; background: rgba(17,24,39,.65); color: #c7cfdf; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; background: rgba(15,23,39,.8); border: 1px solid rgba(126,231,255,.25); }
        th, td { border-bottom: 1px solid rgba(126,231,255,.25); text-align: left; padding: 12px 14px; vertical-align: top; }
        th { background: rgba(117,43,255,.12); }
        .logout { background: linear-gradient(135deg, #752BFF, #7ee7ff); color: #071019; border: none; border-radius: 12px; font-weight: 700; padding: 10px 14px; cursor: pointer; }
        .empty { color: #b8c1d4; padding: 18px; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="topbar">
          <div>
            <div class="pill">God's Eye Studio Admin</div>
            <h1 style="margin: 14px 0 0;">Lead dashboard</h1>
          </div>
          <button class="logout" onclick="logout()">Log out</button>
        </div>
        <div id="status" class="pill" style="margin-top: 18px;">Loading leads…</div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Service</th>
              <th>Budget</th>
              <th>Timeline</th>
              <th>Email</th>
              <th>Project</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody id="lead-body"></tbody>
        </table>
      </div>
      <script>
        async function loadLeads() {
          try {
            const res = await fetch('/api/admin/leads');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Unauthorized');
            const tbody = document.getElementById('lead-body');
            const status = document.getElementById('status');
            tbody.innerHTML = '';
            if (!Array.isArray(data.leads) || !data.leads.length) {
              tbody.innerHTML = '<tr><td colspan="7" class="empty">No approved leads yet.</td></tr>';
              status.textContent = '0 leads';
              return;
            }
            for (const lead of data.leads) {
              const row = document.createElement('tr');
              row.innerHTML = `
                <td>${lead.name || '—'}</td>
                <td>${lead.service || '—'}</td>
                <td>${lead.budget || '—'}</td>
                <td>${lead.timeline || '—'}</td>
                <td>${lead.email || '—'}</td>
                <td>${lead.project_description || '—'}</td>
                <td>${lead.created_at || '—'}</td>
              `;
              tbody.appendChild(row);
            }
            status.textContent = `${data.leads.length} lead${data.leads.length === 1 ? '' : 's'}`;
          } catch (error) {
            window.location.href = '/admin/login';
          }
        }
        async function logout() {
          await fetch('/api/admin/logout');
          window.location.href = '/admin/login';
        }
        loadLeads();
      </script>
    </body>
    </html>
    """


def admin_login_html():
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>God's Eye Studio Admin Login</title>
      <style>
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Inter, Segoe UI, sans-serif; background: radial-gradient(circle at top left, rgba(117,43,255,.18), transparent 20%), linear-gradient(180deg, #070b13 0%, #101827 100%); color: #f5f3ff; }
        .panel { width: min(92vw, 420px); background: rgba(15,23,39,.85); border: 1px solid rgba(126,231,255,.25); border-radius: 22px; padding: 28px 24px; box-shadow: 0 18px 50px rgba(9,9,18,.6); }
        label { display: block; margin: 14px 0 8px; color: #c7cfdf; font-size: 0.82rem; }
        input, button { width: 100%; box-sizing: border-box; border-radius: 12px; padding: 12px 14px; font: inherit; }
        input { border: 1px solid rgba(126,231,255,.25); background: #0a1220; color: #f5f3ff; }
        button { margin-top: 16px; border: none; background: linear-gradient(135deg, #752BFF, #7ee7ff); color: #081017; font-weight: 700; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="panel">
        <h1 style="margin: 0 0 10px;">Admin access</h1>
        <p style="margin: 0 0 18px; color: #b8c1d4;">Protected dashboard for approved leads.</p>
        <form id="loginForm">
          <label for="username">Username</label>
          <input id="username" name="username" type="text" autocomplete="username" required />
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
          <button type="submit">Access dashboard</button>
        </form>
      </div>
      <script>
        document.getElementById('loginForm').addEventListener('submit', async function (event) {
          event.preventDefault();
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (res.ok) {
            window.location.href = '/admin';
          } else {
            alert(data.error || 'Invalid credentials');
          }
        });
      </script>
    </body>
    </html>
    """


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/admin":
            if get_admin_session(self):
                body = admin_dashboard_html().encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            self.send_response(302)
            self.send_header("Location", "/admin/login")
            self.end_headers()
            return

        if path == "/admin/login":
            body = admin_login_html().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/api/admin/leads":
            if not get_admin_session(self):
                send_json(self, {"error": "Unauthorized"}, 401)
                return
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT id, session_id, service, project_description, budget, timeline, name, email, consent, ip_address, created_at FROM leads ORDER BY id DESC"
            ).fetchall()
            conn.close()
            payload = {"leads": [dict(row) for row in rows]}
            send_json(self, payload, 200)
            return

        if path == "/api/admin/logout":
            cookie = http.cookies.SimpleCookie()
            cookie["ge_admin_session"] = ""
            cookie["ge_admin_session"]["path"] = "/"
            cookie["ge_admin_session"]["expires"] = "Thu, 01 Jan 1970 00:00:00 GMT"
            self.send_response(200)
            self.send_header("Set-Cookie", cookie["ge_admin_session"].OutputString())
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))
            return

        route_path = path.rstrip("/") or "/"
        if route_path in ROUTES:
            self.path = "/pages/" + ROUTES[route_path]

        if self.path.lower().endswith(".html"):
            try:
                with open(os.path.join(os.getcwd(), self.path.lstrip("/")), "r", encoding="utf-8") as f:
                    html = f.read()
                if route_path == "/work":
                    html = html.replace("</head>", ROOPSETU_LINK + "</head>", 1)
                    html = html.replace("</body>", ROOPSETU_SCRIPT + "</body>", 1)
                if "</head>" in html and 'techflux-upgrade.css' not in html:
                    html = html.replace("</head>", TECHFLUX_LINK + "</head>", 1)
                    html = html.replace("</body>", TECHFLUX_SCRIPTS + "</body>", 1)
                    content = html.encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html; charset=utf-8")
                    self.send_header("Content-Length", str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                    return
            except FileNotFoundError:
                pass

        return super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]

        if path == "/api/admin/login":
            payload = read_json_body(self)
            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", "")).strip()
            if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                set_auth_cookie(self, username)
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))
                return
            send_json(self, {"error": "Invalid credentials"}, 401)
            return

        if path == "/api/chatbot":
            if not rate_limit_allowed(self):
                send_json(self, {"error": "Too many requests. Please wait a moment and try again."}, 429)
                return
            payload = read_json_body(self)
            session_id = str(payload.get("sessionId") or "default-session")
            message = str(payload.get("message") or "")
            quick_action = payload.get("quickAction")
            response = build_chatbot_response(session_id, message, quick_action, get_client_ip(self))
            send_json(self, response, 200)
            return

        if path == "/api/leads":
            payload = read_json_body(self)
            required = ["name", "email", "service", "project_description", "budget", "timeline", "consent"]
            if any(key not in payload for key in required):
                send_json(self, {"error": "Missing required fields."}, 400)
                return
            if not valid_email(payload.get("email")):
                send_json(self, {"error": "Please provide a valid email address."}, 400)
                return
            if str(payload.get("consent")).lower() not in ["true", "yes", "1"]:
                send_json(self, {"error": "Consent is required before saving lead details."}, 400)
                return
            conn = sqlite3.connect(DB_PATH)
            conn.execute(
                """
                INSERT INTO leads (session_id, service, project_description, budget, timeline, name, email, whatsapp, consent, ip_address, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(payload.get("sessionId") or "manual-" + str(int(time.time()))),
                    str(payload.get("service", "")).strip()[:80],
                    str(payload.get("project_description", "")).strip()[:1500],
                    str(payload.get("budget", "")).strip()[:80],
                    str(payload.get("timeline", "")).strip()[:80],
                    str(payload.get("name", "")).strip()[:80],
                    str(payload.get("email", "")).strip()[:120],
                    "",
                    1,
                    get_client_ip(self),
                    time.strftime("%Y-%m-%d %H:%M:%S"),
                )
            )
            conn.commit()
            conn.close()
            send_json(self, {"ok": True, "message": "Thank you! Our team will review your project and get in touch."}, 200)
            return

        send_json(self, {"error": "Not found"}, 404)


class Server(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    ensure_db()
    with Server(("0.0.0.0", PORT), Handler) as httpd:
        print(f"Godseye Studio copy: http://localhost:{PORT}/")
        httpd.serve_forever()
