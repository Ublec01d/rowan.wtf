# Final Cleaned-Up and Fully Integrated Script with GUI, Deep Scan, Stop Scan, and MOTD Support

import subprocess
import sys
import importlib
import threading
import platform
import ipaddress
import socket
from datetime import datetime

import psutil
import nmap
from scapy.all import ARP, Ether, srp
import tkinter as tk
from tkinter import scrolledtext

# Auto-install missing dependencies
required = ['psutil', 'python-nmap', 'scapy']
for pkg in required:
    try:
        importlib.import_module(pkg)
    except ImportError:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', pkg])

# Globals
subnet_vars = {}
is_deep_scan = False
stop_scan_flag = False
ignore_rogue_subnets = False


# --- Utility Functions ---
def ping_ip(ip, timeout_ms=300):
    param = "-n" if platform.system().lower() == "windows" else "-c"
    timeout = "-w" if platform.system().lower() == "windows" else "-W"
    timeout_value = str(timeout_ms if platform.system().lower() == "windows" else int(timeout_ms / 1000))
    cmd = ["ping", param, "1", timeout, timeout_value, ip]

    try:
        output = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, text=True)
        # On Windows, successful replies contain "TTL="
        # On Linux/macOS, it's "bytes from" or "ttl="
        return "TTL=" in output or "ttl=" in output.lower()
    except subprocess.CalledProcessError:
        return False

def get_local_subnet():
    for iface, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family == socket.AF_INET:
                ip = addr.address
                netmask = addr.netmask
                try:
                    net = ipaddress.IPv4Network(f"{ip}/{netmask}", strict=False)
                    if net.is_private:
                        return str(net.supernet(new_prefix=24))
                except:
                    continue
    return None

# --- Network Scanning ---
def full_rfc1918_sweep():
    global stop_scan_flag
    stop_scan_flag = False
    discovered = []
    timeout_val = 600 if is_deep_scan else 300

    def is_alive(subnet):
        net = ipaddress.IPv4Network(subnet, strict=False)
        test_ips = [
            str(net.network_address + 1),
            str(net.network_address + 10),
            str(net.network_address + 100),
            str(net.network_address + 254),
        ]
        responses = sum(1 for ip in test_ips if ping_ip(ip, timeout_ms=timeout_val))

        if ignore_rogue_subnets:
            return responses >= 2  # Require 2+ hosts to respond
        else:
            return responses >= 1  # Keep it like before

    # Quick sweep mode uses a small list of popular private subnets
    if not is_deep_scan:
        ranges = (
            [f"10.0.{i}.0/24" for i in range(1, 255)] +  # 10.0.1.0 → 10.0.254.0
            [f"172.{i}.{j}.0/24" for i in range(16, 32) for j in range(1)] +  # Just .0 from each 172.16.x → 172.31.x
            [f"192.168.{i}.0/24" for i in range(256)]  # 192.168.0.0 → 192.168.255.0
    )


    else:
        # Deep scan mode covers full RFC1918 space
        ranges = [f"10.{i}.{j}.0/24" for i in range(256) for j in range(256)] + \
                 [f"172.{i}.{j}.0/24" for i in range(16, 32) for j in range(256)] + \
                 [f"192.168.{i}.0/24" for i in range(256)]

    for idx, subnet in enumerate(ranges):
        if stop_scan_flag:
            window.after(0, lambda: output_text.insert(tk.END, "⛔ Scan aborted by user.\n"))
            break
        window.after(0, lambda s=subnet, i=idx: output_text.insert(tk.END, f"🌐 [{i+1}/{len(ranges)}] Probing {s}...\n"))
        if is_alive(subnet):
            discovered.append(subnet)
            window.after(0, lambda s=subnet: output_text.insert(tk.END, f"✅ Reachable: {s}\n", "reachable"))

        else:
            window.after(0, lambda s=subnet: output_text.insert(tk.END, f"❌ No response from {s}\n", "unreachable"))
        if not is_deep_scan and len(discovered) >= 50:
            break
    return discovered

def stop_scan():
    global stop_scan_flag
    stop_scan_flag = True

def scapy_arp_scan(subnet):
    window.after(0, lambda: output_text.insert(tk.END, f"🧪 ARP scan in progress for {subnet}...\n"))
    arp = ARP(pdst=subnet)
    ether = Ether(dst="ff:ff:ff:ff:ff:ff")
    packet = ether / arp
    result = srp(packet, timeout=1, verbose=0)[0]
    found = [(r.psrc, r.hwsrc, "Unknown") for s, r in result]
    window.after(0, lambda: output_text.insert(tk.END, f"✅ Found {len(found)} device(s) via ARP.\n"))
    return found

def nmap_discovery(subnet):
    window.after(0, lambda: output_text.insert(tk.END, f"🔍 Launching Nmap on {subnet}...\n"))
    cmd = ["nmap", "-sn", "-PR", subnet]
    window.after(0, lambda: output_text.insert(tk.END, f"🛠 Command: {' '.join(cmd)}\n"))

    found = []
    try:
        output = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True)
        for line in output.splitlines():
            window.after(0, lambda l=line: output_text.insert(tk.END, l + "\n"))
            if "Nmap scan report for" in line:
                ip = line.split()[-1]
                mac, hostname = "Unknown", "Unknown"
                found.append((ip, mac, hostname))  # MAC/hostname filled in later if parsed
            elif "MAC Address" in line and found:
                mac_info = line.split("MAC Address: ")[1]
                mac = mac_info.split(" ")[0]
                name = " ".join(mac_info.split(" ")[1:]).strip("()") or "Unknown"
                ip, _, _ = found[-1]
                found[-1] = (ip, mac, name)
    except FileNotFoundError:
        window.after(0, lambda: output_text.insert(tk.END, "❌ Nmap not found. Is it installed and in your PATH?\n"))
    except Exception as e:
        window.after(0, lambda: output_text.insert(tk.END, f"⚠️ Nmap error: {e}\n"))

    return found

def scan_selected_subnets():
    selected = [s for s, v in subnet_vars.items() if v.get()]
    if not selected:
        output_text.insert(tk.END, "⚠️ No subnets selected.\n")
        return

    results = []

    def background_scan():
        for idx, subnet in enumerate(selected):
            output_text.insert(tk.END, f"🔍 [{idx+1}/{len(selected)}] Scanning {subnet}...\n")
            output_text.see(tk.END)

            try:
                results.extend(scapy_arp_scan(subnet))
            except Exception as e:
                output_text.insert(tk.END, f"⚠️ Scapy error: {e}\n")

            try:
                nmap_results = nmap_discovery(subnet)
                results.extend(nmap_results)
            except Exception as e:
                output_text.insert(tk.END, f"⚠️ Nmap error: {e}\n")

        if results:
            md = "| IP Address | MAC Address | Hostname |\n|------------|-------------|----------|\n"
            for ip, mac, name in sorted(set(results)):
                md += f"| {ip} | {mac} | {name} |\n"
            output_text.insert(tk.END, md + "\n")
            save_markdown(md)
        else:
            output_text.insert(tk.END, "⚠️ No devices found.\n")

    threading.Thread(target=background_scan).start()

def save_markdown(content):
    filename = f"LANLord_map_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.md"
    with open(filename, 'w') as f:
        f.write(content)
    output_text.insert(tk.END, f"✅ Exported to {filename}\n")

def select_all_subnets():
    for var in subnet_vars.values():
        var.set(True)

def deselect_all_subnets():
    for var in subnet_vars.values():
        var.set(False)

def toggle_deep_scan():
    global is_deep_scan
    is_deep_scan = not is_deep_scan
    btn_deep_scan.config(relief=tk.SUNKEN if is_deep_scan else tk.RAISED)
    output_text.insert(tk.END, f"\n⚙ Deep Scan {'enabled' if is_deep_scan else 'disabled'}\n\n")
    output_text.see(tk.END)

def toggle_rogue_filter():
    global ignore_rogue_subnets
    ignore_rogue_subnets = not ignore_rogue_subnets
    state = "enabled" if ignore_rogue_subnets else "disabled"
    output_text.insert(tk.END, f"🧪 Rogue subnet filtering {state}.\n")
    output_text.see(tk.END)


def populate_checklist(subnets):
    for widget in scrollable_frame.winfo_children():
        widget.destroy()
    subnet_vars.clear()

    container = tk.Frame(scrollable_frame, bg="#1e1e1e")
    container.pack(fill="both", expand=True)

    groups = {
        "10.x.x.x": [s for s in subnets if s.startswith("10.")],
        "172.16.x.x": [s for s in subnets if s.startswith("172.")],
        "192.168.x.x": [s for s in subnets if s.startswith("192.")]
    }

    for col, (label, group) in enumerate(groups.items()):
        frame = tk.LabelFrame(container, text=label, bg="#1e1e1e", fg="#00FF00", bd=1)
        frame.grid(row=0, column=col, padx=10, sticky="n")
        container.columnconfigure(col, weight=1)

        for subnet in sorted(group):
            var = tk.BooleanVar(value=True)
            cb = tk.Checkbutton(frame, text=subnet, variable=var,
                                bg="#1e1e1e", fg="#00FF00", selectcolor="#111", anchor='w')
            cb.pack(anchor='w')
            subnet_vars[subnet] = var

def start_full_sweep():
    def background():
        output_text.insert(tk.END, "🚀 Starting full RFC1918 sweep...\n")
        output_text.see(tk.END)
        subnets = full_rfc1918_sweep()
        window.after(0, lambda: finalize_full_sweep(subnets))
    threading.Thread(target=background).start()

def finalize_full_sweep(subnets):
    populate_checklist(subnets)
    output_text.insert(tk.END, f"\n✅ Discovered {len(subnets)} subnets.\n\n")
    output_text.see(tk.END)

def quick_scan_local():
    subnet = get_local_subnet()
    if subnet:
        output_text.insert(tk.END, f"🚀 Quick scanning local subnet: {subnet}\n")
        populate_checklist([subnet])
        # Run scan after populating
        threading.Thread(target=scan_selected_subnets).start()
    else:
        output_text.insert(tk.END, "❌ Could not determine local subnet.\n")

# --- GUI Setup ---
window = tk.Tk()
window.title("LANLord v0.1 - RFC1918 Edition")
window.geometry("1000x800")
window.configure(bg="#1e1e1e")

frame = tk.Frame(window, bg="#1e1e1e")
frame.pack(pady=10)

btn_sweep = tk.Button(frame, text="Sweep", command=start_full_sweep, width=18, bg="#333", fg="#00FF00")
btn_sweep.grid(row=0, column=0, padx=5)
btn_quick = tk.Button(frame, text="Quick Local Scan", command=quick_scan_local, width=18, bg="#333", fg="#00FF00")
btn_quick.grid(row=0, column=1, padx=5)
btn_scan = tk.Button(frame, text="Scan Selected", command=lambda: threading.Thread(target=scan_selected_subnets).start(), width=18, bg="#333", fg="#00FF00")
btn_scan.grid(row=0, column=2, padx=5)
btn_deep_scan = tk.Button(frame, text="Deep Scan", command=toggle_deep_scan, width=18, bg="#444", fg="#00FF00")
btn_deep_scan.grid(row=0, column=3, padx=5)
btn_stop = tk.Button(frame, text="Stop Scan", command=stop_scan, width=18, bg="#222", fg="#FF5555")
btn_stop.grid(row=0, column=4, padx=5)

chk_rogue = tk.Checkbutton(frame, text="Ignore Suspicious Subnets", bg="#1e1e1e", fg="#00FF00",
                           activebackground="#333", selectcolor="#111",
                           command=lambda: toggle_rogue_filter(), anchor="w")
chk_rogue.grid(row=1, column=0, columnspan=3, sticky="w", padx=5, pady=(5, 0))


main_frame = tk.Frame(window, bg="#1e1e1e")
main_frame.pack(fill=tk.BOTH, expand=True)
main_frame.grid_columnconfigure(0, weight=1)
main_frame.grid_columnconfigure(1, weight=1)
main_frame.grid_rowconfigure(0, weight=1)

output_text = scrolledtext.ScrolledText(main_frame, wrap=tk.WORD, bg="#111", fg="#00FF00", insertbackground="#00FF00")
output_text.grid(row=0, column=0, padx=(10, 5), pady=10, sticky="nsew")
output_text.tag_config("reachable", foreground="#FF5555")  # Red
# OR: output_text.tag_config("reachable", foreground="#00BFFF")  # Blue
output_text.tag_config("unreachable", foreground="#666666")  # Dim gray

output_text.bind("<<Modified>>", lambda e: (output_text.see(tk.END), output_text.edit_modified(False)))


output_text.insert(tk.END, """
██╗      █████╗ ███╗   ██╗██╗      ██████╗ ██████╗ ██████╗ 
██║     ██╔══██╗████╗  ██║██║     ██╔═══██╗██╔══██╗██╔══██╗
██║     ███████║██╔██╗ ██║██║     ██║   ██║██████╔╝██║  ██║
██║     ██╔══██║██║╚██╗██║██║     ██║   ██║██╔══██╗██║  ██║
███████╗██║  ██║██║ ╚████║███████╗╚██████╔╝██║  ██║██████╔╝
╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝                                  

Welcome to LANLord  | RFC1918 Mapper & Scanner
--------------------------------------------
YOU control the LAN | Powered by rowan.wtf

[ Sweep ]               - Quickly probes common RFC1918 subnets
[ Quick Local Scan ]    - Scans your current local /24 subnet
[ Scan Selected ]       - Runs ARP & Nmap discovery on chosen subnets
[ Deep Scan ]           - Enables full RFC1918 sweep (Beware! Takes ages)
[ Stop Scan ]           - Immediately halts the ongoing sweep or scan
[ Ignore Susnets ]      - Require 2+ hosts to respond                 
""")

subnet_frame = tk.Frame(main_frame, bg="#1e1e1e")
subnet_frame.grid(row=0, column=1, padx=(5, 10), pady=10, sticky="nsew")

# Top Action Buttons (Select/Deselect)
action_btns = tk.Frame(subnet_frame, bg="#1e1e1e")
action_btns.pack(fill=tk.X, pady=(0, 5))
tk.Button(action_btns, text="Select All", command=select_all_subnets,
          bg="#333", fg="#00FF00", activebackground="#222", relief="groove", width=12).pack(side=tk.LEFT, padx=5)
tk.Button(action_btns, text="Deselect All", command=deselect_all_subnets,
          bg="#333", fg="#00FF00", activebackground="#222", relief="groove", width=12).pack(side=tk.LEFT, padx=5)

# Canvas + Scrollbar Setup
checklist_canvas = tk.Canvas(subnet_frame, bg="#1e1e1e", highlightthickness=0)
scrollbar = tk.Scrollbar(subnet_frame, orient="vertical", command=checklist_canvas.yview)

scrollable_frame = tk.Frame(checklist_canvas, bg="#1e1e1e")
checklist_canvas.create_window((0, 0), window=scrollable_frame, anchor="nw", tags="subnet_frame")
checklist_canvas.configure(yscrollcommand=scrollbar.set)

checklist_canvas.pack(side="left", fill="both", expand=True)

# Dynamically show/hide scrollbar
def update_scrollbar_visibility(event=None):
    canvas_height = checklist_canvas.winfo_height()
    frame_height = scrollable_frame.winfo_height()
    if frame_height > canvas_height:
        scrollbar.pack(side="right", fill="y")
    else:
        scrollbar.pack_forget()

scrollable_frame.bind("<Configure>", lambda e: (
    checklist_canvas.configure(scrollregion=checklist_canvas.bbox("all")),
    update_scrollbar_visibility()
))
checklist_canvas.bind("<Configure>", lambda e: (
    checklist_canvas.itemconfig("subnet_frame", width=e.width),
    update_scrollbar_visibility()
))

# Scroll with mousewheel only when needed
def scroll_if_needed(event):
    if scrollbar.winfo_ismapped():
        checklist_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

checklist_canvas.bind_all("<MouseWheel>", scroll_if_needed)
checklist_canvas.bind_all("<Button-4>", lambda e: scroll_if_needed(e))
checklist_canvas.bind_all("<Button-5>", lambda e: scroll_if_needed(e))

window.mainloop()
