# FinTech Segment Tree Stock Monitor - Web Visualizer

An interactive web frontend and visualizer for real-time stock price monitoring using the Segment Tree data structure.

> **Zero Core Changes**: The original [segment_tree.py](file:///home/shyam/Copium/DSA-vis/segment_tree.py) remains 100% untouched. The server and frontend run alongside it as a completely decoupled layer.

---

## Features

### 1. Input Data into the Website
- **Synthetic Random-Walk Generator**: Choose tick count $N$ (e.g., 8, 16, 32, 100), start price, and start timestamp.
- **Raw Input**: Paste custom CSV or whitespace-delimited price feeds (`timestamp, price` or single `price` per line).
- **File Load & Upload**: Load server-side files (e.g. `sample_data/sample_prices.csv`) or drag-and-drop a file from your machine.
- **Point Update ($O(\log N)$)**: Update the price at any index and watch the path from leaf to root recomputed with animated highlights.

### 2. Visualize Loaded Prices as a Chart
- Interactive high-performance canvas price feed with gradient fills and time/price grid axes.
- **Dynamic Query Range Overlay**: Shaded range area between $[L, R]$ with min and max target badges.
- **Interactive Drag-to-Select**: Click and drag across the chart to directly execute range queries.
- Hover crosshairs with instant timestamp, index, and price tooltips.

### 3. Visualize the Segment Tree Constructed
- **Full Interactive SVG Tree**: Hierarchical layout where leaves line up in index order and parent nodes center over their subsegment intervals.
- **Pan & Zoom**: Smooth mouse wheel zooming, drag-to-pan, and controls for Zoom In, Zoom Out, Reset, and Fit to View.
- **Depth Slider**: Filter the display depth for large trees.
- **Color-Coded Node States**:
  - 🟢 **Canonical Covering Nodes**: Merged to answer range queries.
  - 🔵 **Traversed Branches**: Inspected during search.
  - ⬛ **Pruned Disjoint Branches**: Dimmed to focus on active query paths.
  - 🟠 **Updated Path**: Highlighted when a point update is applied.
- **Click-to-Query**: Click any node to instantly query that node's subsegment.

### 4. Query from Website
- **Query by Index**: Set $[L, R]$ with number inputs or quick range presets (All, First Half, Second Half, Middle window).
- **Query by Timestamp**: Select start and end timestamps directly from dropdowns.
- **Batch File Queries**: Run queries from `sample_data/sample_queries.txt` and inspect results in a table.
- **Traversal & Efficiency Metrics**: Shows Min price, Max price, Spread, canonical nodes merged, and $O(\log N)$ tree inspections vs $O(N)$ linear scans.

---

## Getting Started

Start the server using Python (no third-party dependencies required; uses Python's built-in standard library):

```bash
python3 server.py 8000
```

Then open your browser and navigate to:
```
http://localhost:8000
```
