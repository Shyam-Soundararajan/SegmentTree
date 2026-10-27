"""
Segment Tree Visualization Server
Serves the web frontend and provides REST API for Segment Tree operations.
Does NOT modify segment_tree.py.
"""

import sys
import os
import json
import math
import mimetypes
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Import original segment tree module
from segment_tree import (
    SegmentTree,
    Node,
    generate_synthetic_prices,
    load_prices_file,
    load_queries_file
)

# Global SegmentTree instance
st_instance = SegmentTree()

# Pre-populate with a nice initial dataset of 12 ticks for instant visualization
init_prices, init_times = generate_synthetic_prices(12, 150.00, "09:30:00")
st_instance.load_data(init_prices, init_times)


def get_tree_stats(st):
    """Calculates overall statistics for current dataset."""
    if st.n == 0:
        return {
            "n": 0,
            "min_price": 0.0,
            "max_price": 0.0,
            "min_idx": -1,
            "max_idx": -1,
            "spread": 0.0,
            "height": 0,
            "tree_nodes": 0
        }
    root = st.tree[1] if len(st.tree) > 1 and st.tree[1] else None
    return {
        "n": st.n,
        "min_price": root.min_price if root else 0.0,
        "max_price": root.max_price if root else 0.0,
        "min_idx": root.min_idx if root else -1,
        "max_idx": root.max_idx if root else -1,
        "spread": root.spread if root else 0.0,
        "height": math.ceil(math.log2(st.n)) + 1 if st.n > 0 else 0,
        "tree_nodes": len(st.tree)
    }


def serialize_tree_hierarchical(st, node_idx=1, start=0, end=None, depth=0):
    """Recursively serialize the SegmentTree into a JSON-friendly nested tree."""
    if end is None:
        end = st.n - 1

    if st.n == 0 or node_idx >= len(st.tree) or st.tree[node_idx] is None:
        return None

    node = st.tree[node_idx]
    is_leaf = (start == end)

    data = {
        "node_idx": node_idx,
        "start": start,
        "end": end,
        "start_time": st.timestamps[start] if 0 <= start < len(st.timestamps) else "",
        "end_time": st.timestamps[end] if 0 <= end < len(st.timestamps) else "",
        "min_price": node.min_price,
        "max_price": node.max_price,
        "min_idx": node.min_idx,
        "max_idx": node.max_idx,
        "spread": node.spread,
        "is_leaf": is_leaf,
        "depth": depth
    }

    if not is_leaf:
        mid = (start + end) // 2
        left_child = 2 * node_idx
        right_child = 2 * node_idx + 1

        data["left"] = serialize_tree_hierarchical(st, left_child, start, mid, depth + 1)
        data["right"] = serialize_tree_hierarchical(st, right_child, mid + 1, end, depth + 1)
    else:
        data["left"] = None
        data["right"] = None

    return data


def serialize_tree_flat(st):
    """Returns a dictionary of all active nodes mapped by node_idx."""
    nodes = {}

    def dfs(node_idx, start, end, depth):
        if node_idx >= len(st.tree) or st.tree[node_idx] is None:
            return
        node = st.tree[node_idx]
        is_leaf = (start == end)
        nodes[node_idx] = {
            "node_idx": node_idx,
            "start": start,
            "end": end,
            "start_time": st.timestamps[start] if 0 <= start < len(st.timestamps) else "",
            "end_time": st.timestamps[end] if 0 <= end < len(st.timestamps) else "",
            "min_price": node.min_price,
            "max_price": node.max_price,
            "min_idx": node.min_idx,
            "max_idx": node.max_idx,
            "spread": node.spread,
            "is_leaf": is_leaf,
            "depth": depth,
            "left_child": 2 * node_idx if not is_leaf else None,
            "right_child": (2 * node_idx + 1) if not is_leaf else None
        }
        if not is_leaf:
            mid = (start + end) // 2
            dfs(2 * node_idx, start, mid, depth + 1)
            dfs(2 * node_idx + 1, mid + 1, end, depth + 1)

    if st.n > 0:
        dfs(1, 0, st.n - 1, 0)
    return nodes


def trace_query_execution(st, q_left, q_right):
    """
    Executes a range query while tracing the traversal path:
    - visited: list of nodes inspected
    - canonical: list of nodes that represent disjoint canonical interval coverage
    - disjoint: list of inspected nodes that fell completely outside the range
    """
    if st.n == 0:
        raise ValueError("Segment tree is empty.")
    if q_left < 0 or q_right >= st.n or q_left > q_right:
        raise ValueError(f"Invalid query range [{q_left}, {q_right}] for data size {st.n}.")

    visited = []
    canonical = []
    disjoint = []
    traversal_order = []

    def dfs(node_idx, start, end):
        if node_idx >= len(st.tree) or st.tree[node_idx] is None:
            return

        traversal_order.append(node_idx)
        # Disjoint
        if q_right < start or q_left > end:
            disjoint.append(node_idx)
            visited.append({
                "node_idx": node_idx,
                "status": "disjoint",
                "start": start,
                "end": end
            })
            return

        # Fully contained (canonical)
        if q_left <= start and end <= q_right:
            canonical.append(node_idx)
            visited.append({
                "node_idx": node_idx,
                "status": "canonical",
                "start": start,
                "end": end
            })
            return

        # Partially overlapping
        visited.append({
            "node_idx": node_idx,
            "status": "partial",
            "start": start,
            "end": end
        })
        mid = (start + end) // 2
        dfs(2 * node_idx, start, mid)
        dfs(2 * node_idx + 1, mid + 1, end)

    dfs(1, 0, st.n - 1)

    result_node = st.query(q_left, q_right)
    return {
        "traversal_order": traversal_order,
        "visited": visited,
        "canonical": canonical,
        "disjoint": disjoint,
        "stats": {
            "visited_count": len(visited),
            "canonical_count": len(canonical),
            "total_nodes": st.n * 4,
            "efficiency_ratio": round((1 - (len(visited) / max(1, st.n))) * 100, 1)
        },
        "result": {
            "min_price": result_node.min_price,
            "max_price": result_node.max_price,
            "min_idx": result_node.min_idx,
            "max_idx": result_node.max_idx,
            "spread": result_node.spread,
            "min_time": st.get_timestamp(result_node.min_idx),
            "max_time": st.get_timestamp(result_node.max_idx),
            "q_left": q_left,
            "q_right": q_right,
            "start_time": st.get_timestamp(q_left),
            "end_time": st.get_timestamp(q_right)
        }
    }


def trace_update_execution(st, target_idx, new_price):
    """
    Updates price and traces the path from root down to leaf and back.
    """
    if st.n == 0:
        raise ValueError("Segment tree is empty.")
    if target_idx < 0 or target_idx >= st.n:
        raise IndexError(f"Index {target_idx} out of bounds (0 to {st.n - 1})")

    path = []
    node_idx = 1
    start = 0
    end = st.n - 1

    while start < end:
        path.append(node_idx)
        mid = (start + end) // 2
        if target_idx <= mid:
            node_idx = 2 * node_idx
            end = mid
        else:
            node_idx = 2 * node_idx + 1
            start = mid + 1
    path.append(node_idx)  # leaf node

    old_price = st.prices[target_idx]
    st.update(target_idx, new_price)

    return {
        "updated_nodes": path,
        "target_idx": target_idx,
        "timestamp": st.get_timestamp(target_idx),
        "old_price": old_price,
        "new_price": float(new_price)
    }


def parse_raw_text(text):
    """Parses raw text containing timestamps and prices or just prices."""
    prices = []
    timestamps = []

    for line in text.splitlines():
        clean = line.strip()
        if not clean or clean.startswith("#"):
            continue
        parts = [p.strip() for p in clean.replace(",", " ").split()]
        if len(parts) >= 2:
            try:
                p = float(parts[1])
                timestamps.append(parts[0])
                prices.append(p)
            except ValueError:
                continue
        elif len(parts) == 1:
            try:
                p = float(parts[0])
                prices.append(p)
            except ValueError:
                continue

    if not prices:
        raise ValueError("No valid numerical price data found.")

    return prices, (timestamps if len(timestamps) == len(prices) else None)


class SegmentTreeHandler(BaseHTTPRequestHandler):
    frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")

    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def _read_json_body(self):
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len == 0:
            return {}
        body = self.rfile.read(content_len).decode("utf-8")
        return json.loads(body)

    def _send_json(self, data, status=200, head_only=False):
        self._set_headers(status, "application/json")
        if not head_only:
            self.wfile.write(json.dumps(data).encode("utf-8"))

    def _send_error(self, message, status=400, head_only=False):
        self._send_json({"error": str(message)}, status=status, head_only=head_only)

    def do_HEAD(self):
        self.do_GET(head_only=True)

    def do_GET(self, head_only=False):
        parsed = urlparse(self.path)
        path = parsed.path

        # API Endpoints
        if path == "/api/state":
            stats = get_tree_stats(st_instance)
            tree_hierarchy = serialize_tree_hierarchical(st_instance)
            flat_nodes = serialize_tree_flat(st_instance)
            self._send_json({
                "n": st_instance.n,
                "prices": st_instance.prices,
                "timestamps": st_instance.timestamps,
                "stats": stats,
                "tree": tree_hierarchy,
                "flat_nodes": flat_nodes
            }, head_only=head_only)
            return

        elif path == "/api/tree":
            self._send_json({
                "tree": serialize_tree_hierarchical(st_instance),
                "flat_nodes": serialize_tree_flat(st_instance),
                "stats": get_tree_stats(st_instance)
            }, head_only=head_only)
            return

        # Static file serving
        if path == "/" or path == "/index.html":
            file_path = os.path.join(self.frontend_dir, "index.html")
        else:
            rel_path = path.lstrip("/")
            file_path = os.path.join(self.frontend_dir, rel_path)

        if os.path.isfile(file_path):
            ctype, _ = mimetypes.guess_type(file_path)
            if not ctype:
                ctype = "application/octet-stream"
            try:
                with open(file_path, "rb") as f:
                    content = f.read()
                self._set_headers(200, ctype)
                if not head_only:
                    self.wfile.write(content)
            except Exception as e:
                self._send_error(f"Error reading file: {e}", 500, head_only=head_only)
        else:
            self._send_error("Not Found", 404, head_only=head_only)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            body = self._read_json_body()
        except Exception as e:
            self._send_error(f"Invalid JSON payload: {e}")
            return

        try:
            if path == "/api/generate":
                count = int(body.get("count", 16))
                start_p = float(body.get("start_price", 100.0))
                start_t = str(body.get("start_time", "09:30:00")).strip()

                if count <= 0 or count > 500:
                    raise ValueError("Count must be between 1 and 500.")

                prices, times = generate_synthetic_prices(count, start_p, start_t)
                st_instance.load_data(prices, times)

                self._send_json({
                    "success": True,
                    "message": f"Generated {st_instance.n} prices.",
                    "n": st_instance.n,
                    "prices": st_instance.prices,
                    "timestamps": st_instance.timestamps,
                    "stats": get_tree_stats(st_instance),
                    "tree": serialize_tree_hierarchical(st_instance),
                    "flat_nodes": serialize_tree_flat(st_instance)
                })

            elif path == "/api/load-raw":
                raw_text = body.get("text", "")
                prices, times = parse_raw_text(raw_text)
                if len(prices) > 500:
                    raise ValueError("Dataset exceeds maximum limit of 500 records.")

                st_instance.load_data(prices, times)

                self._send_json({
                    "success": True,
                    "message": f"Loaded {st_instance.n} records from raw input.",
                    "n": st_instance.n,
                    "prices": st_instance.prices,
                    "timestamps": st_instance.timestamps,
                    "stats": get_tree_stats(st_instance),
                    "tree": serialize_tree_hierarchical(st_instance),
                    "flat_nodes": serialize_tree_flat(st_instance)
                })

            elif path == "/api/load-file":
                filepath = body.get("filepath", "").strip()
                if not filepath:
                    raise ValueError("File path cannot be empty.")

                # If relative, resolve relative to current working dir
                if not os.path.isabs(filepath):
                    filepath = os.path.join(os.getcwd(), filepath)

                prices, times = load_prices_file(filepath)
                st_instance.load_data(prices, times)

                self._send_json({
                    "success": True,
                    "message": f"Loaded {st_instance.n} records from {os.path.basename(filepath)}.",
                    "n": st_instance.n,
                    "prices": st_instance.prices,
                    "timestamps": st_instance.timestamps,
                    "stats": get_tree_stats(st_instance),
                    "tree": serialize_tree_hierarchical(st_instance),
                    "flat_nodes": serialize_tree_flat(st_instance)
                })

            elif path == "/api/query":
                q_type = body.get("type", "index")

                if q_type == "time":
                    start_t = body.get("start_time", "").strip()
                    end_t = body.get("end_time", "").strip()
                    res_node, l_idx, r_idx = st_instance.query_by_timestamp(start_t, end_t)
                else:
                    l_idx = int(body.get("left", 0))
                    r_idx = int(body.get("right", st_instance.n - 1))

                trace = trace_query_execution(st_instance, l_idx, r_idx)
                self._send_json({
                    "success": True,
                    **trace
                })

            elif path == "/api/batch-query":
                # Can accept either queries list or a query file path
                filepath = body.get("filepath", "").strip()
                raw_queries = body.get("queries", [])

                if filepath:
                    if not os.path.isabs(filepath):
                        filepath = os.path.join(os.getcwd(), filepath)
                    parsed_queries = load_queries_file(filepath)
                else:
                    parsed_queries = []
                    for q in raw_queries:
                        if isinstance(q, dict):
                            t = q.get("type", "index")
                            if t == "time":
                                parsed_queries.append(("time", q.get("start_time"), q.get("end_time")))
                            else:
                                parsed_queries.append(("index", int(q.get("left")), int(q.get("right"))))

                results = []
                for i, q in enumerate(parsed_queries, 1):
                    try:
                        if q[0] == "index":
                            l, r = q[1], q[2]
                            res = st_instance.query(l, r)
                            results.append({
                                "id": i,
                                "type": "index",
                                "range_str": f"[{l}, {r}]",
                                "left": l,
                                "right": r,
                                "start_time": st_instance.get_timestamp(l),
                                "end_time": st_instance.get_timestamp(r),
                                "min_price": res.min_price,
                                "min_time": st_instance.get_timestamp(res.min_idx),
                                "max_price": res.max_price,
                                "max_time": st_instance.get_timestamp(res.max_idx),
                                "spread": res.spread,
                                "status": "ok"
                            })
                        else:
                            start_t, end_t = q[1], q[2]
                            res, l, r = st_instance.query_by_timestamp(start_t, end_t)
                            results.append({
                                "id": i,
                                "type": "time",
                                "range_str": f"{start_t}..{end_t}",
                                "left": l,
                                "right": r,
                                "start_time": start_t,
                                "end_time": end_t,
                                "min_price": res.min_price,
                                "min_time": st_instance.get_timestamp(res.min_idx),
                                "max_price": res.max_price,
                                "max_time": st_instance.get_timestamp(res.max_idx),
                                "spread": res.spread,
                                "status": "ok"
                            })
                    except Exception as err:
                        results.append({
                            "id": i,
                            "type": q[0],
                            "range_str": f"{q[1]}..{q[2]}",
                            "status": "error",
                            "error": str(err)
                        })

                self._send_json({
                    "success": True,
                    "count": len(results),
                    "results": results
                })

            elif path == "/api/update":
                target_idx = int(body.get("index"))
                new_price = float(body.get("price"))

                update_trace = trace_update_execution(st_instance, target_idx, new_price)

                self._send_json({
                    "success": True,
                    "message": f"Updated index {target_idx} to ${new_price:.2f}",
                    **update_trace,
                    "prices": st_instance.prices,
                    "timestamps": st_instance.timestamps,
                    "stats": get_tree_stats(st_instance),
                    "tree": serialize_tree_hierarchical(st_instance),
                    "flat_nodes": serialize_tree_flat(st_instance)
                })

            else:
                self._send_error("Unknown endpoint", 404)

        except Exception as e:
            self._send_error(str(e), 400)


def run_server(port=8000):
    server_address = ("", port)
    httpd = HTTPServer(server_address, SegmentTreeHandler)
    print(f"============================================================")
    print(f" Segment Tree Stock Monitor Web Server running at:")
    print(f" http://localhost:{port}")
    print(f"============================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()


if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port)
