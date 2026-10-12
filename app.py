from flask import Flask, jsonify, render_template
import psutil
import time
import socket
import platform
from datetime import timedelta

app = Flask(__name__)
psutil.cpu_percent(interval=None)


def bytes_to_mb(value):
    return round(value / (1024 * 1024), 2)


def get_metrics():
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    network = psutil.net_io_counters()

    return {
        "timestamp": time.time(),
        "hostname": socket.gethostname(),
        "platform": platform.platform(),
        "uptime": str(
            timedelta(seconds=int(time.time() - psutil.boot_time()))
        ),
        "cpu": {
            "percent": psutil.cpu_percent(interval=None),
            "cores": psutil.cpu_count(logical=True),
        },
        "memory": {
            "total": bytes_to_mb(memory.total),
            "used": bytes_to_mb(memory.used),
            "available": bytes_to_mb(memory.available),
            "percent": memory.percent,
        },
        "disk": {
            "total": bytes_to_mb(disk.total),
            "used": bytes_to_mb(disk.used),
            "free": bytes_to_mb(disk.free),
            "percent": disk.percent,
        },
        "network": {
            "sent": network.bytes_sent,
            "received": network.bytes_recv,
            "packets_sent": network.packets_sent,
            "packets_received": network.packets_recv,
        },
        "process_count": len(psutil.pids()),
        "processes": [
            {
                "pid": p.info["pid"],
                "name": p.info["name"] or "Unknown",
                "memory": round(p.info["memory_percent"] or 0, 2),
            }
            for p in sorted(
                psutil.process_iter(
                    ["pid", "name", "memory_percent"]
                ),
                key=lambda p: p.info.get("memory_percent") or 0,
                reverse=True,
            )[:10]
        ],
    }


@app.route("/")
def dashboard():
    return render_template("index.html")


@app.route("/api/metrics")
def api_metrics():
    return jsonify(get_metrics())


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
