#!/usr/bin/env python3
"""
LANLord v0.4 - RFC1918 Mapper & Scanner
A tool to discover RFC1918 networks via ping, ARP, and Nmap discovery, featuring a Tkinter GUI.
"""

import subprocess
import sys
import importlib

def ensure_package(package, import_name=None):
    """
    Ensures that the package is installed and imported.
    
    Parameters:
      package (str): The pip package name.
      import_name (str): Optional name to import. If None, uses 'package' itself.
    
    Returns:
      module: The imported module.
    """
    name = import_name or package
    try:
        return importlib.import_module(name)
    except ImportError:
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
        importlib.invalidate_caches()
        return importlib.import_module(name)

# Ensure required packages are installed
psutil = ensure_package('psutil')
ensure_package('scapy')  # Install scapy; then import from scapy.all below

# Now import additional modules (they should be installed at this point)
from scapy.all import ARP, Ether, srp

import threading
import platform
import ipaddress
import socket
from datetime import datetime
import tkinter as tk
from tkinter import scrolledtext, messagebox

# --- Global Variables ---
subnet_vars = {}
is_deep_scan = False
stop_scan_flag = False
ignore_rogue_subnets = False

# --- Helper Functions ---
def log_message(msg, tag=None):
    """Thread-safe logging function for updating the GUI."""
    window.after(0, lambda: output_text.insert(tk.END, msg, tag))
    window.after(0, output_text.see, tk.END)

def clear_log():
    """Clears the GUI output text."""
    output_text.delete(1.0, tk.END)

# --- Network Utility Functions ---
def ping_ip(ip, timeout_ms=300):
    """
    Pings the provided IP address and returns True if the host replies.
    """
    param = "-n" if platform.system().lower() == "windows" else "-c"
    timeout = "-w" if platform.system().lower() == "windows" else "-W"
    timeout_value = str(timeout_ms if platform.system().lower() == "windows" else int(timeout_ms / 1000))
    cmd = ["ping", param, "1", timeout, timeout_value, ip]

    try:
        output = subprocess.check_output(cmd, stderr=subprocess.DEVNULL, text=True)
        return "TTL=" in output or "ttl=" in output.lower()
    except subprocess.CalledProcessError:
        return False

def get_local_subnet():
    """
    Returns the local subnet in /24 format based on the first found private IP.
    """
    for iface, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family == socket.AF_INET:
                ip = addr.address
                netmask = addr.netmask
                try:
                    net = ipaddress.IPv4Network(f"{ip}/{netmask}", strict=False)
                    if net.is_private:
                        # Force /24 for scanning convenience; consider asking user for alternate choices
                        return str(net.supernet(new_prefix=24))
                except Exception:
                    continue
    return None

# --- Scanning Functions ---
def full_rfc1918_sweep():
    """
    Performs a sweep of the RFC1918 subnets. In quick mode, limits the scan to a subset.
    In deep scan mode, covers all possible /24 subnets (warning: can be very slow!).
    """
    global stop_scan_flag
    stop_scan_flag = False
    discovered = []
    timeout_val = 600 if is_deep_scan else 300

    def is_alive(subnet):
        """Check if a subnet is alive by pinging several fixed addresses."""
        net = ipaddress.IPv4Network(subnet, strict=False)
        test_ips = [
            str(net.network_address + 1),
            str(net.network_address + 10),
            str(net.network_address + 100),
            str(net.network_address + 254),
        ]
        responses = sum(1 for ip in test_ips if ping_ip(ip, timeout_ms=timeout_val))
        if ignore_rogue_subnets:
            return responses >= 2  # More than one response needed
        else:
            return responses >= 1

    # Choose subnet ranges based on scan mode
    if not is_deep_scan:
        ranges = (
            [f"10.0.{i}.0/24" for i in range(1, 255)] +
            [f"172.{i}.0.0/24" for i in range(16, 32)] +  # scanning only the .0 subnets
            [f"192.168.{i}.0/24" for i in range(256)]
        )
    else:
        # Deep scan covers full space -- caution: very heavy task!
        ranges = ([f"10.{i}.{j}.0/24" for i in range(256) for j in range(256)] +
                  [f"172.{i}.{j}.0/24" for i in range(16, 32) for j in range(256)] +
                  [f"192.168.{i}.0/24" for i in range(256)])
        if messagebox.askyesno("Deep Scan Confirmation",
                               "Deep scan mode will probe tens of thousands of subnets and can take hours. Do you want to proceed?"):
            pass
        else:
            log_message("Deep scan canceled by user.\n")
            return discovered

    for idx, subnet in enumerate(ranges):
        if stop_scan_flag:
            log_message("⛔ Scan aborted by user.\n")
            break
        log_message(f"🌐 [{idx+1}/{len(ranges)}] Probing {subnet}...\n")
        if is_alive(subnet):
            discovered.append(subnet)
            log_message(f"✅ Reachable: {subnet}\n", "reachable")
        else:
            log_message(f"❌ No response from {subnet}\n", "unreachable")
        if not is_deep_scan and len(discovered) >= 50:
            break

    return discovered

def stop_scan():
    """Sets the flag to stop any ongoing scan."""
    global stop_scan_flag
    stop_scan_flag = True

def scapy_arp_scan(subnet):
    """Uses Scapy to perform an ARP scan on the given subnet."""
    log_message(f"🧪 ARP scan in progress for {subnet}...\n")
    arp = ARP(pdst=subnet)
    ether = Ether(dst="ff:ff:ff:ff:ff:ff")
    packet = ether / arp
    try:
        result = srp(packet, timeout=1, verbose=0)[0]
        found = [(r.psrc, r.hwsrc, "Unknown") for s, r in result]
        log_message(f"✅ Found {len(found)} device(s) via ARP.\n")
        return found
    except Exception as e:
        log_message(f"⚠️ ARP scan error: {e}\n")
        return []

def nmap_discovery(subnet):
    """
    Uses Nmap to scan the provided subnet.
    In deep scan mode, uses more aggressive settings.
    """
    args = "-A -T4 -p- -sV -v -Pn" if is_deep_scan else "-sn -PR"
    cmd = ["nmap"] + args.split() + [subnet]
    log_message(f"🛠 Running: {' '.join(cmd)}\n")
    found = []
    current_host, mac, hostname, ports = None, "Unknown", "Unknown", []

    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for line in iter(process.stdout.readline, ''):
            if stop_scan_flag:
                process.terminate()
                log_message("⛔ Nmap scan aborted.\n")
                break
            log_message(line)
            # Parse output for host and port info
            if "Nmap scan report for" in line:
                if current_host:
                    found.append((current_host, mac, hostname, ports.copy()))
                    ports.clear()
                current_host = line.split()[-1]
                mac, hostname = "Unknown", "Unknown"
            elif "MAC Address" in line and current_host:
                mac_info = line.split("MAC Address: ")[1]
                mac = mac_info.split(" ")[0]
                hostname = " ".join(mac_info.split(" ")[1:]).strip("()")
            elif "/tcp" in line or "/udp" in line:
                ports.append(line.strip())
        if current_host:
            found.append((current_host, mac, hostname, ports.copy()))
        process.stdout.close()
        process.wait()
        log_message(f"✅ Finished scanning {subnet}\n")
    except FileNotFoundError:
        log_message("❌ Nmap not found. Add to PATH?\n")
    except Exception as e:
        log_message(f"⚠️ Nmap error: {e}\n")
    return found

def scan_selected_subnets():
    """
    Scans all subnets selected in the checklist using both ARP (Scapy)
    and Nmap discovery, then outputs results as a Markdown table.
    """
    selected = [s for s, v in subnet_vars.items() if v.get()]
    if not selected:
        log_message("⚠️ No subnets selected.\n")
        return

    results = []

    def background_scan():
        for idx, subnet in enumerate(selected):
            log_message(f"🔍 [{idx+1}/{len(selected)}] Scanning {subnet}...\n")
            try:
                results.extend(scapy_arp_scan(subnet))
            except Exception as e:
                log_message(f"⚠️ Scapy error: {e}\n")
            try:
                nmap_results = nmap_discovery(subnet)
                results.extend(nmap_results)
            except Exception as e:
                log_message(f"⚠️ Nmap error: {e}\n")

        if results:
            md = "| IP Address | MAC Address | Hostname | Open Ports |\n"
            md += "|------------|-------------|----------|-------------|\n"
            unique_entries = []
            seen = set()
            for entry in results:
                if entry[0] in seen:
                    continue
                seen.add(entry[0])
                unique_entries.append(entry)
            for entry in sorted(unique_entries):
                if len(entry) == 4:
                    ip, mac, name, ports = entry
                    # Replace <br> with commas for better markdown presentation
                    port_str = ", ".join(ports) if ports else "-"
                else:
                    ip, mac, name = entry
                    port_str = "-"
                md += f"| {ip} | {mac} | {name} | {port_str} |\n"
            log_message(md + "\n")
            save_markdown(md)
        else:
            log_message("⚠️ No devices found.\n")

    threading.Thread(target=background_scan, daemon=True).start()

def save_markdown(content):
    """Exports the scan results as a Markdown file with a timestamp."""
    filename = f"LANLord_map_{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.md"
    try:
        with open(filename, 'w') as f:
            f.write(content)
        log_message(f"✅ Exported to {filename}\n")
    except Exception as e:
        log_message(f"⚠️ Error saving file: {e}\n")

def select_all_subnets():
    """Selects all subnets in the checklist."""
    for var in subnet_vars.values():
        var.set(True)

def deselect_all_subnets():
    """Deselects all subnets in the checklist."""
    for var in subnet_vars.values():
        var.set(False)

def toggle_deep_scan():
    """Toggles the deep scan mode."""
    global is_deep_scan
    is_deep_scan = not is_deep_scan
    btn_deep_scan.config(relief=tk.SUNKEN if is_deep_scan else tk.RAISED)
    log_message(f"\n⚙ Deep Scan {'enabled' if is_deep_scan else 'disabled'}\n\n")

def toggle_rogue_filter():
    """Toggles filtering for suspicious subnets."""
    global ignore_rogue_subnets
    ignore_rogue_subnets = not ignore_rogue_subnets
    state = "enabled" if ignore_rogue_subnets else "disabled"
    log_message(f"🧪 Rogue subnet filtering {state}.\n")

def populate_checklist(subnets):
    """Populates the subnet checklist in the GUI by grouping them."""
    for widget in scrollable_frame.winfo_children():
        widget.destroy()
    subnet_vars.clear()

    container = tk.Frame(scrollable_frame, bg="#1e1e1e")
    container.pack(fill="both", expand=True)

    groups = {
        "10.x.x.x": [s for s in subnets if s.startswith("10.")],
        "172.x.x.x": [s for s in subnets if s.startswith("172.")],
        "192.168.x.x": [s for s in subnets if s.startswith("192.168.")]
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
    """Starts a full RFC1918 sweep in the background."""
    def background():
        log_message("🚀 Starting full RFC1918 sweep...\n")
        subnets = full_rfc1918_sweep()
        window.after(0, lambda: finalize_full_sweep(subnets))
    threading.Thread(target=background, daemon=True).start()

def finalize_full_sweep(subnets):
    """Finalizes a sweep by populating the checklist and outputting statistics."""
    populate_checklist(subnets)
    log_message(f"\n✅ Discovered {len(subnets)} subnets.\n\n")

def quick_scan_local():
    """Performs a quick scan on the local /24 subnet."""
    subnet = get_local_subnet()
    if subnet:
        log_message(f"🚀 Quick scanning local subnet: {subnet}\n")
        populate_checklist([subnet])
        threading.Thread(target=scan_selected_subnets, daemon=True).start()
    else:
        log_message("❌ Could not determine local subnet.\n")

# --- GUI Setup ---
window = tk.Tk()
window.title("LANLord v0.5 - RFC1918 Edition")  # Updated version number
window.geometry("1000x800")
window.configure(bg="#1e1e1e")

# Top button frame
frame = tk.Frame(window, bg="#1e1e1e")
frame.pack(pady=10)

btn_sweep = tk.Button(frame, text="Sweep", command=start_full_sweep, width=18, bg="#333", fg="#00FF00")
btn_sweep.grid(row=0, column=0, padx=5)
btn_quick = tk.Button(frame, text="Quick Local Scan", command=quick_scan_local, width=18, bg="#333", fg="#00FF00")
btn_quick.grid(row=0, column=1, padx=5)
btn_scan = tk.Button(frame, text="Scan Selected", command=lambda: threading.Thread(target=scan_selected_subnets, daemon=True).start(), width=18, bg="#333", fg="#00FF00")
btn_scan.grid(row=0, column=2, padx=5)
btn_deep_scan = tk.Button(frame, text="Deep Scan", command=toggle_deep_scan, width=18, bg="#444", fg="#00FF00")
btn_deep_scan.grid(row=0, column=3, padx=5)
btn_stop = tk.Button(frame, text="Stop Scan", command=stop_scan, width=18, bg="#222", fg="#FF5555")
btn_stop.grid(row=0, column=4, padx=5)
btn_clear = tk.Button(frame, text="Clear Log", command=clear_log, width=18, bg="#555", fg="#FFFFFF")  # NEW: Clear output button
btn_clear.grid(row=0, column=5, padx=5)

chk_rogue = tk.Checkbutton(frame, text="Ignore Suspicious Subnets", bg="#1e1e1e", fg="#00FF00",
                           activebackground="#333", selectcolor="#111",
                           command=toggle_rogue_filter, anchor="w")
chk_rogue.grid(row=1, column=0, columnspan=3, sticky="w", padx=5, pady=(5, 0))

# Main frame layout for output and checklist
main_frame = tk.Frame(window, bg="#1e1e1e")
main_frame.pack(fill=tk.BOTH, expand=True)
main_frame.grid_columnconfigure(0, weight=1)
main_frame.grid_columnconfigure(1, weight=1)
main_frame.grid_rowconfigure(0, weight=1)

output_text = scrolledtext.ScrolledText(main_frame, wrap=tk.WORD, bg="#111", fg="#00FF00", insertbackground="#00FF00")
output_text.grid(row=0, column=0, padx=(10, 5), pady=10, sticky="nsew")
output_text.tag_config("reachable", foreground="#FF5555")
output_text.tag_config("unreachable", foreground="#666666")
output_text.bind("<<Modified>>", lambda e: (output_text.see(tk.END), output_text.edit_modified(False)))

output_text.insert(tk.END, """
██╗      █████╗ ███╗   ██╗██╗      ██████╗ ██████╗ ██████╗ 
██║     ██╔══██╗████╗  ██║██║     ██╔═══██╗██╔══██╗██╔══██╗
██║     ███████║██╔██╗ ██║██║     ██║   ██║██████╔╝██║  ██║
██║     ██╔══██║██║╚██╗██║██║     ██║   ██║██╔══██╗██║  ██║
███████╗██║  ██║██║ ╚████║███████╗╚██████╔╝██║  ██║██████╔╝
╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝                                  

Welcome to LANLord  | RFC1918 Mapper & Scanner v0.3
--------------------------------------------
YOU control the LAN | Powered by rowan.wtf

*Beware! Deep Scan is very aggressive!
 May trigger security systems (firewalls, IPS)
 Also takes ages to complete!
 Up to 2+ hours per subnet!
 
               /|\ ^._.^ /|\ 

[ Sweep ]             - Quickly probes common RFC1918 subnets
[ Quick Local Scan ]  - Scans your current local /24 subnet
[ Scan Selected ]     - Runs ARP & Nmap discovery on chosen subnets
[ Deep Scan ]         - Enables full RFC1918 + port scan*
[ Stop Scan ]         - Immediately halts the ongoing sweep or scan
[ Clear Log ]         - Clears the current output text
[ Ignore Subnets ]    - Require 2+ hosts to respond                 
""")

# Checklist (subnet selection) setup
subnet_frame = tk.Frame(main_frame, bg="#1e1e1e")
subnet_frame.grid(row=0, column=1, padx=(5, 10), pady=10, sticky="nsew")

# Action Buttons for subnet checklist
action_btns = tk.Frame(subnet_frame, bg="#1e1e1e")
action_btns.pack(fill=tk.X, pady=(0, 5))
tk.Button(action_btns, text="Select All", command=select_all_subnets,
          bg="#333", fg="#00FF00", activebackground="#222", relief="groove", width=12).pack(side=tk.LEFT, padx=5)
tk.Button(action_btns, text="Deselect All", command=deselect_all_subnets,
          bg="#333", fg="#00FF00", activebackground="#222", relief="groove", width=12).pack(side=tk.LEFT, padx=5)

# Canvas and Scrollbar for subnet checklist
checklist_canvas = tk.Canvas(subnet_frame, bg="#1e1e1e", highlightthickness=0)
scrollbar = tk.Scrollbar(subnet_frame, orient="vertical", command=checklist_canvas.yview)
scrollable_frame = tk.Frame(checklist_canvas, bg="#1e1e1e")
checklist_canvas.create_window((0, 0), window=scrollable_frame, anchor="nw", tags="subnet_frame")
checklist_canvas.configure(yscrollcommand=scrollbar.set)
checklist_canvas.pack(side="left", fill="both", expand=True)

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

# Mousewheel scrolling for the checklist
def scroll_if_needed(event):
    if scrollbar.winfo_ismapped():
        checklist_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

checklist_canvas.bind_all("<MouseWheel>", scroll_if_needed)
checklist_canvas.bind_all("<Button-4>", scroll_if_needed)
checklist_canvas.bind_all("<Button-5>", scroll_if_needed)

window.mainloop()
