import os
import time
import subprocess
import urllib.request
from playwright.sync_api import sync_playwright

output_dir = r"C:\Users\dhruv\.gemini\antigravity-ide\brain\e4534a6e-f1b2-47f6-862d-ac810bd7ffb6\screenshots\bisveda_v8"
os.makedirs(output_dir, exist_ok=True)

port = 3005
base_url = f"http://localhost:{port}"

# Start Next.js production server on port 3005
print(f"Starting Next.js on port {port}...")
server_process = subprocess.Popen(
    f"npx next start -p {port}",
    cwd=r"c:\BISVEDA\prototype",
    shell=True,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE
)

# Wait for server to become responsive
for i in range(25):
    try:
        req = urllib.request.urlopen(base_url, timeout=2)
        if req.status == 200:
            print("Server is ready!")
            break
    except Exception:
        time.sleep(1)
else:
    print("Warning: server wait timed out, continuing...")

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        print("1. Capturing Landing Page...")
        page.goto(base_url, wait_until="networkidle")
        time.sleep(2)
        page.screenshot(path=os.path.join(output_dir, "01_landing_hero.png"))

        print("2. Hovering over 'Standards' Mega-Menu...")
        standards_btn = page.locator("nav button:has-text('Standards'), nav button:has-text('मानक')").first
        if standards_btn.count() > 0:
            standards_btn.hover()
            time.sleep(1.5)
            page.screenshot(path=os.path.join(output_dir, "02_standards_megamenu.png"))

        print("3. Hovering over 'Certification' Mega-Menu...")
        cert_btn = page.locator("nav button:has-text('Certification'), nav button:has-text('प्रमाणीकरण')").first
        if cert_btn.count() > 0:
            cert_btn.hover()
            time.sleep(1.5)
            page.screenshot(path=os.path.join(output_dir, "03_certification_megamenu.png"))

        print("4. Hovering over 'Testing' Mega-Menu...")
        testing_btn = page.locator("nav button:has-text('Testing'), nav button:has-text('परीक्षण')").first
        if testing_btn.count() > 0:
            testing_btn.hover()
            time.sleep(1.5)
            page.screenshot(path=os.path.join(output_dir, "04_testing_megamenu.png"))

        print("5. Opening 3-Panel Research Workspace for 'where can i make water bottles'...")
        # Move mouse away to close mega-menu
        page.mouse.move(10, 10)
        time.sleep(0.5)

        # Trigger search query via URL
        page.goto(f"{base_url}/?q=where+can+i+make+water+bottles", wait_until="networkidle")
        time.sleep(3)
        page.screenshot(path=os.path.join(output_dir, "05_workspace_water_bottles_viewport.png"))
        page.screenshot(path=os.path.join(output_dir, "05_workspace_water_bottles_full.png"), full_page=True)

        print("6. Clicking specification measurement pill '+ 1 Litre'...")
        pill = page.locator("button:has-text('+ 1 Litre')").first
        if pill.count() > 0:
            pill.click()
            time.sleep(1)
            page.screenshot(path=os.path.join(output_dir, "06_spec_pill_clicked.png"))

        print("7. Inspecting 'Testing' Tab on Product Compliance Map...")
        tab_testing = page.locator("aside button:has-text('Testing')").first
        if tab_testing.count() > 0:
            tab_testing.click()
            time.sleep(1)
            page.screenshot(path=os.path.join(output_dir, "07_tab_testing.png"))

        print("8. Inspecting 'Labs' Tab on Product Compliance Map...")
        tab_labs = page.locator("aside button:has-text('Labs')").first
        if tab_labs.count() > 0:
            tab_labs.click()
            time.sleep(1)
            page.screenshot(path=os.path.join(output_dir, "08_tab_labs.png"))

        print("9. Returning to Certification tab and clicking 'Generate Schedule II Form 1'...")
        tab_cert = page.locator("aside button:has-text('Certification')").first
        if tab_cert.count() > 0:
            tab_cert.click()
            time.sleep(0.5)
            form1_btn = page.locator("button:has-text('Generate Schedule II Form 1')").first
            if form1_btn.count() > 0:
                form1_btn.click()
                time.sleep(1)
                page.screenshot(path=os.path.join(output_dir, "10_form1_generated.png"))

        print("10. Clicking 'View evidence' to open Evidence Drawer...")
        view_ev = page.locator("button:has-text('View evidence')").first
        if view_ev.count() > 0:
            view_ev.click()
            time.sleep(1)
            page.screenshot(path=os.path.join(output_dir, "09_view_evidence_drawer.png"))

        print("Completed BISVEDA V8 walkthrough capture!")
        browser.close()
finally:
    try:
        subprocess.run(f"taskkill /F /T /PID {server_process.pid}", shell=True, capture_output=True)
    except Exception:
        pass
