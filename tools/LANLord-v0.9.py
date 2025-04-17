#!/usr/bin/env python3
"""
LANLord v0.9 

Dependencies auto-install:
- scapy
- pysnmp

Features:
- Full Sweep: scans all RFC1918 subnets
- Quick Scan: common local subnets
- Manual Scan: custom IP/CIDR input
- Deep Scan: optional SNMP-based enrichment
"""
import sys
import subprocess
import threading
import platform
import ipaddress
from datetime import datetime
import socket
import tkinter as tk
from tkinter import scrolledtext, messagebox


# --- Auto Dependency Installer ---
REQUIRED_MODULES = [('scapy', 'scapy'), ('pysnmp', 'pysnmp')]
for mod, pkg in REQUIRED_MODULES:
    try:
        __import__(mod)
    except ImportError:
        subprocess.call([sys.executable, '-m', 'pip', 'uninstall', '-y', pkg])
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--force-reinstall', pkg])

from scapy.all import ARP, Ether, srp, conf
# --- Fix broken pysnmp installations ---
try:
    from pysnmp.hlapi.v3arch.asyncio import get_cmd as getCmd, SnmpEngine, CommunityData, UdpTransportTarget, ContextData, ObjectType, ObjectIdentity
except ImportError:
    import importlib
    subprocess.call([sys.executable, '-m', 'pip', 'uninstall', '-y', 'pysnmp'])
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--force-reinstall', 'pysnmp'])
    importlib.invalidate_caches()
    from pysnmp.hlapi.v3arch.asyncio import get_cmd as getCmd, SnmpEngine, CommunityData, UdpTransportTarget, ContextData, ObjectType, ObjectIdentity
except ImportError:
    import importlib
    subprocess.call([sys.executable, '-m', 'pip', 'uninstall', '-y', 'pysnmp'])
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--force-reinstall', 'pysnmp'])
    importlib.invalidate_caches()
    from pysnmp.hlapi import getCmd, SnmpEngine, CommunityData, UdpTransportTarget, ContextData, ObjectType, ObjectIdentity
conf.verb = 0

# --- Global State ---
is_deep_scan = False
stop_flag = False
loot = []
window = tk.Tk()
port_thread_limit = tk.IntVar(value=50)
window.title('LANLord v0.9')
window.configure(bg='#1e1e1e')

# --- GUI Logging ---
def log(msg, tag=None):
    if output:
        output.after(0, lambda: output.insert(tk.END, msg + '\n', tag))
        output.after(0, output.see, tk.END)

def clear_log():
    if output:
        output.delete('1.0', tk.END)

# --- SNMP, ARP, ICMP, and TCP Scan ---
def enrich_host_ports(host):
    import socket
    import concurrent.futures
    ip = host['ip']
    open_ports = []
    log(f"   ↪ Scanning all 0-1023 ports on {ip} with up to {port_thread_limit.get()} threads...")

    def scan_port(port):
        if stop_flag:
            return None
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(0.3)
                result = s.connect_ex((ip, port))
                if result == 0:
                    return port
        except Exception:
            return None
        return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=port_thread_limit.get()) as executor:
        futures = {executor.submit(scan_port, p): p for p in range(1, 1024)}
        for idx, (future, port) in enumerate(futures.items()):
            if stop_flag:
                break
            try:
                result = future.result()
                if result:
                    open_ports.append(result)
                    log(f"     • Port {result}/TCP is open")
            except Exception:
                pass
            if idx % 50 == 0:
                log(f"     ↪ Port scan progress: {idx}/1023")

    host['ports'] = open_ports
def snmp_get(ip, oid, community='public'):
    try:
        iterator = getCmd(SnmpEngine(), CommunityData(community),
                          UdpTransportTarget((ip, 161), timeout=1), ContextData(),
                          ObjectType(ObjectIdentity(oid)))
        errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
        if errorIndication or errorStatus:
            return None
        for varBind in varBinds:
            return str(varBind[1])
    except:
        return None

def arp_scan(subnet):
    log(f"🔍 ARP scanning: {subnet}")
    ether = Ether(dst="ff:ff:ff:ff:ff:ff")
    arp = ARP(pdst=subnet)
    packet = ether / arp
    result = srp(packet, timeout=2, verbose=0)[0]
    hosts = {}
    for _, rcv in result:
        ip = rcv.psrc
        mac = rcv.hwsrc
        hostname = ip
        hosts[ip] = {"ip": ip, "mac": mac, "hostname": hostname, "subnet": subnet, "ports": [], "os": ""}
    log(f"✅ ARP found {len(hosts)} host(s) in {subnet}")
    return hosts

def enrich_host_snmp(host):
    import socket
    ip = host['ip']
    log(f"   ↪ SNMP enrichment for {ip}...")
    os_info = snmp_get(ip, '1.3.6.1.2.1.1.1.0')
    if os_info:
        log(f"   ↪ OS Info: {os_info}")
        host['os'] = os_info
    else:
        log(f"   ↪ No SNMP OS info for {ip}")
    try:
        hostname = socket.gethostbyaddr(ip)[0]
        log(f"   ↪ Hostname resolved: {hostname}")
        host['hostname'] = hostname
    except:
        pass
    enrich_host_ports(host)

# --- Core Scan Wrapper ---
def icmp_ping(ip):
    from scapy.all import IP, ICMP, sr1
    import logging
    logging.getLogger("scapy.runtime").setLevel(logging.ERROR)
    pkt = IP(dst=ip)/ICMP()
    resp = sr1(pkt, timeout=1, verbose=0)
    return resp is not None and resp.haslayer(ICMP) and resp[ICMP].type == 0

def basic_scan(subnet):
    global loot
    if stop_flag:
        return
    try:
        hosts = arp_scan(subnet)
        scanned = set(hosts.keys())
        if is_deep_scan:
            log(f"🔁 Deep Scan: ICMP sweeping {subnet} with up to {thread_limit.get()} threads...")
            net = ipaddress.IPv4Network(subnet, strict=False)
            threaded_icmp_sweep(list(net.hosts()), scanned, hosts, subnet)
        for h in hosts.values():
            if is_deep_scan:
                enrich_host_snmp(h)
            loot.append(h)
    except Exception as e:
        log(f"⚠️ Scan failed: {e}")
    except Exception as e:
        log(f"⚠️ Scan failed: {e}")

# --- Scan Types ---
def run_full_sweep():
    global stop_flag, loot
    stop_flag = False
    loot.clear()
    ranges = [f"10.0.{i}.0/24" for i in range(1, 255)] + \
             [f"172.{i}.0.0/24" for i in range(16, 32)] + \
             [f"192.168.{i}.0/24" for i in range(256)]
    for idx, subnet in enumerate(ranges, 1):
        if stop_flag:
            log(f"⛔ Sweep aborted at {idx}/{len(ranges)}")
            return
        log(f"🌐 [{idx}/{len(ranges)}] {subnet}")
        basic_scan(subnet)
    log(f"🎉 Sweep complete: {len(loot)} hosts")

def run_quick():
    global stop_flag, loot
    stop_flag = False
    loot.clear()

    subnets = []

    # Add 10.0.0.0/24 through 10.0.254.0/24
    subnets += [f"10.0.{i}.0/24" for i in range(255)]

    # Add 172.16.0.0/24 through 172.31.254.0/24
    for i in range(16, 32):  # 172.16 - 172.31
        subnets += [f"172.{i}.{j}.0/24" for j in range(255)]

    # Add 192.168.0.0/24 through 192.168.254.0/24
    subnets += [f"192.168.{i}.0/24" for i in range(255)]

    for idx, net in enumerate(subnets, 1):
        if stop_flag:
            log(f"⛔ Quick scan aborted at {idx}/{len(subnets)}")
            return
        log(f"🔎 [{idx}/{len(subnets)}] {net}")
        basic_scan(net)

    log(f"✅ Quick scan complete: {len(loot)} hosts")

def run_manual(target):
    global stop_flag, loot
    stop_flag = False
    loot.clear()
    try:
        if '-' in target:
            start_subnet, end_subnet = target.replace(' ', '').split('-')
            start_ip = ipaddress.IPv4Network(start_subnet, strict=False).network_address
            end_ip = ipaddress.IPv4Network(end_subnet, strict=False).network_address
            current = int(start_ip)
            end = int(end_ip)
            alive_subnets = []
            while current <= end:
                subnet = ipaddress.IPv4Network((ipaddress.IPv4Address(current), 24), strict=False)
                ip1 = str(subnet.network_address + 1)
                ip254 = str(subnet.network_address + 254)
                log(f"🌐 Checking {subnet} for gateway response...")
                resp1 = icmp_ping(ip1)
                resp254 = icmp_ping(ip254)
                if resp1 or resp254:
                    log(f"✅ Subnet {subnet} is alive")
                    alive_subnets.append(str(subnet))
                else:
                    log(f"⛔ Subnet {subnet} seems inactive")
                current += 256
            for subnet in alive_subnets:
                if stop_flag:
                    break
                log(f"🔍 Scanning live subnet {subnet}")
                basic_scan(subnet)
        elif '/' in target:
            ipaddress.IPv4Network(target, strict=False)
            log(f"📌 Manual scan: {target}")
            basic_scan(target)
        else:
            ipaddress.IPv4Address(target)
            log(f"📌 Manual scan: {target}")
            basic_scan(target)
    except ValueError:
        messagebox.showerror("Input Error", "Invalid IP, CIDR, or Range")
        return
    log(f"✅ Manual scan complete: {len(loot)} hosts")

def ping_test(host):
    global stop_flag
    stop_flag = False
    cmd = ['ping'] + (['-t'] if platform.system().lower() == 'windows' else []) + [host]
    log(f"📶 Pinging {host}...")
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        for line in proc.stdout:
            if stop_flag:
                proc.terminate()
                log("⛔ Ping stopped")
                return
            log(line.strip())
    except Exception as e:
        log(f"⚠️ Ping error: {e}")

# --- Export ---
def export_loot():
    if not loot:
        log("⚠️ Nothing to export.")
        return
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"LANLord_loot_{timestamp}.md"
    lines = ["# LANLord Scan Report\n"]
    for i, h in enumerate(loot, 1):
        lines += [
            f"## Host {i}: {h['ip']} ({h['hostname']})",
            f"**Subnet:** `{h['subnet']}`",
            f"**MAC:** `{h['mac']}`",
            f"**OS:** `{h['os'] or 'Unknown'}`",
            "**Open Ports:**",
        ]
        lines += [f"- {p}" for p in h['ports']] if h['ports'] else ["- None"]
        lines.append("")
    try:
        with open(filename, 'w') as f:
            f.write('\n'.join(lines))
        log(f"✅ Exported to {filename}")
    except Exception as e:
        log(f"⚠️ Export failed: {e}")

# --- Ping Thread Control ---
thread_limit = tk.IntVar(value=10)

def threaded_icmp_sweep(ip_list, scanned, hosts, subnet):
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=thread_limit.get()) as executor:
        futures = {executor.submit(icmp_ping, str(ip)): str(ip) for ip in ip_list if str(ip) not in scanned}
        for idx, (future, ip) in enumerate(futures.items()):
            if stop_flag:
                return
            try:
                if future.result():
                    try:
                        hostname = socket.gethostbyaddr(ip)[0]
                        log(f" • {ip} responded to ICMP ({hostname})")
                    except:
                        hostname = ip
                        log(f" • {ip} responded to ICMP (no hostname)")
                    hosts[ip] = {"ip": ip, "mac": "?", "hostname": hostname, "subnet": subnet, "ports": [], "os": ""}
            except Exception as e:
                log(f"   ↪ Error pinging {ip}: {e}")
            if idx % 16 == 0:
                log(f"   ↪ Ping sweep progress: {idx} hosts checked")

# --- Controls ---
def toggle_deep():
    global is_deep_scan
    is_deep_scan = not is_deep_scan
    btn_deep.config(relief=tk.SUNKEN if is_deep_scan else tk.RAISED)
    log(f"⚙ Deep Scan {'ON' if is_deep_scan else 'OFF'}")

def stop():
    global stop_flag
    stop_flag = True
    log("⛔ Operation stopped")

# --- GUI Setup ---
tb = tk.Frame(window, bg='#1e1e1e')
tb.pack(pady=10)
btn_full = tk.Button(tb, text='Sweep', bg='#333', fg='#0f0', width=12, command=lambda: threading.Thread(target=run_full_sweep, daemon=True).start())
btn_full.grid(row=0, column=0, padx=5)
btn_quick = tk.Button(tb, text='Quick Scan', bg='#333', fg='#0f0', width=12, command=lambda: threading.Thread(target=run_quick, daemon=True).start())
btn_quick.grid(row=0, column=1, padx=5)
btn_deep = tk.Button(tb, text='Deep Scan', bg='#444', fg='#0f0', width=12, command=toggle_deep)
btn_deep.grid(row=0, column=2, padx=5)
btn_stop = tk.Button(tb, text='Stop', bg='#222', fg='#f55', width=12, command=stop)
btn_stop.grid(row=0, column=3, padx=5)
btn_export = tk.Button(tb, text='Export Loot', bg='#333', fg='#0f0', width=12, command=export_loot)
btn_export.grid(row=0, column=4, padx=5)
btn_clear = tk.Button(tb, text='Clear Log', bg='#555', fg='#fff', width=12, command=clear_log)
btn_clear.grid(row=0, column=5, padx=5)
ctx_lbl = tk.Label(tb, text='Manual Scan (IP/CIDR):', bg='#1e1e1e', fg='#0f0')
ctx_lbl.grid(row=1, column=0, padx=5, pady=5)
entry_manual = tk.Entry(tb, bg='#333', fg='#0f0', insertbackground='#0f0')
entry_manual.grid(row=1, column=1, padx=5, pady=5)
tk.Button(tb, text='Manual Scan', bg='#333', fg='#0f0', width=12, command=lambda: threading.Thread(target=run_manual, args=(entry_manual.get(),), daemon=True).start()).grid(row=1, column=2, padx=5)
ping_lbl = tk.Label(tb, text='Ping Test (host):', bg='#1e1e1e', fg='#0f0')
ping_lbl.grid(row=1, column=3, padx=5, pady=5)
entry_ping = tk.Entry(tb, bg='#333', fg='#0f0', insertbackground='#0f0')
entry_ping.grid(row=1, column=4, padx=5, pady=5)
tk.Button(tb, text='Ping Test', bg='#333', fg='#0f0', width=12, command=lambda: threading.Thread(target=ping_test, args=(entry_ping.get(),), daemon=True).start()).grid(row=1, column=5, padx=5)
output = scrolledtext.ScrolledText(window, wrap=tk.WORD, bg='#111', fg='#0f0', insertbackground='#0f0')
output.pack(fill='both', expand=True, padx=10, pady=10)

# Thread slider control
port_thread_frame = tk.Frame(window, bg='#1e1e1e')
port_thread_frame.pack(pady=0)
tk.Label(port_thread_frame, text='Max Port Threads:', bg='#1e1e1e', fg='#0f0').pack(side='left', padx=5)
port_slider = tk.Scale(port_thread_frame, from_=1, to=200, orient='horizontal', variable=port_thread_limit,
                         bg='#222', fg='#0f0', troughcolor='#333', highlightthickness=0, length=200)
port_slider.pack(side='left')
thread_frame = tk.Frame(window, bg='#1e1e1e')
thread_frame.pack(pady=5)
tk.Label(thread_frame, text='Max Ping Threads:', bg='#1e1e1e', fg='#0f0').pack(side='left', padx=5)
thread_slider = tk.Scale(thread_frame, from_=1, to=100, orient='horizontal', variable=thread_limit,
                         bg='#222', fg='#0f0', troughcolor='#333', highlightthickness=0, length=200)
thread_slider.pack(side='left')
log("""
██╗      █████╗ ███╗   ██╗██╗      ██████╗ ██████╗ ██████╗ 
██║     ██╔══██╗████╗  ██║██║     ██╔═══██╗██╔══██╗██╔══██╗
██║     ███████║██╔██╗ ██║██║     ██║   ██║██████╔╝██║  ██║
██║     ██╔══██║██║╚██╗██║██║     ██║   ██║██╔══██╗██║  ██║
███████╗██║  ██║██║ ╚████║███████╗╚██████╔╝██║  ██║██████╔╝
╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═════╝                                  

Welcome to LANLord  | RFC1918 Mapper & Scanner v0.9
--------------------------------------------
YOU control the LAN | Powered by rowan.wtf

       /|\ ^._.^ /|\ 

Sweep               | Scan all private /24 ranges
Quick Scan          | Common subnets
Deep Scan           | SNMP enrichment
Manual Scan         | IP/CIDR input
Scan Range          | 10.0.0.0/24 - 10.0.254.0/24 
Ping Test           | Ping a host indefinetely
Stop                | Cancel scan
Export Loot         | Save results
Clear Log           | Reset output
    
""".strip())
window.mainloop()
