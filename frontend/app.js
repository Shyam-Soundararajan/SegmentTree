/**
 * Minimal Application Controller for Segment Tree Stock Price Visualizer
 */

class App {
    constructor() {
        this.state = {
            n: 0,
            prices: [],
            timestamps: [],
            stats: null,
            tree: null,
            flatNodes: {}
        };

        this.chart = null;
        this.treeViz = null;

        this.init();
    }

    async init() {
        this._initComponents();
        this._bindUIEvents();
        await this.loadInitialState();
    }

    _initComponents() {
        // 1. Stock Price Chart
        const chartCanvas = document.getElementById('stock-chart-canvas');
        this.chart = new StockPriceChart(chartCanvas, (left, right) => {
            const indexRadio = document.querySelector('input[name="query-mode"][value="index"]');
            if (indexRadio) indexRadio.checked = true;
            this._toggleQueryMode('index');
            document.getElementById('query-left-input').value = left;
            document.getElementById('query-right-input').value = right;
            this.runQuery('index', left, right);
        });

        // 2. Segment Tree Visualizer
        const treeContainer = document.getElementById('tree-canvas-container');
        this.treeViz = new SegmentTreeVisualizer(treeContainer, (node) => {
            const indexRadio = document.querySelector('input[name="query-mode"][value="index"]');
            if (indexRadio) indexRadio.checked = true;
            this._toggleQueryMode('index');
            document.getElementById('query-left-input').value = node.start;
            document.getElementById('query-right-input').value = node.end;
            this.runQuery('index', node.start, node.end);
        });
    }

    _bindUIEvents() {
        // Navigation Tabs
        document.querySelectorAll('.tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                const paneId = btn.getAttribute('data-tab');
                const pane = document.getElementById(paneId);
                if (pane) pane.classList.add('active');
            });
        });

        // Input Source selector
        const sourceSelect = document.getElementById('input-source-select');
        if (sourceSelect) {
            sourceSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                document.getElementById('source-synth-panel').style.display = val === 'synth' ? 'block' : 'none';
                document.getElementById('source-raw-panel').style.display = val === 'raw' ? 'block' : 'none';
                document.getElementById('source-file-panel').style.display = val === 'file' ? 'block' : 'none';
            });
        }

        // Query Mode Radios
        document.querySelectorAll('input[name="query-mode"]').forEach(r => {
            r.addEventListener('change', (e) => {
                this._toggleQueryMode(e.target.value);
            });
        });

        // Query Run
        document.getElementById('btn-run-query').addEventListener('click', () => {
            const mode = document.querySelector('input[name="query-mode"]:checked').value;
            if (mode === 'index') {
                const l = parseInt(document.getElementById('query-left-input').value, 10);
                const r = parseInt(document.getElementById('query-right-input').value, 10);
                this.runQuery('index', l, r);
            } else {
                const startT = document.getElementById('query-start-time').value;
                const endT = document.getElementById('query-end-time').value;
                this.runQuery('time', null, null, startT, endT);
            }
        });

        // Query Clear
        document.getElementById('btn-clear-query').addEventListener('click', () => {
            this.chart.clearQueryRange();
            this.treeViz.clearHighlights();
            document.getElementById('query-result-box').style.display = 'none';
        });

        // Data Generation
        document.getElementById('btn-generate-data').addEventListener('click', () => {
            const count = parseInt(document.getElementById('gen-count').value, 10);
            const price = parseFloat(document.getElementById('gen-price').value);
            const time = document.getElementById('gen-time').value;
            this.generateData(count, price, time);
        });

        // Raw Text Loading
        document.getElementById('btn-load-raw').addEventListener('click', () => {
            const text = document.getElementById('raw-data-textarea').value;
            this.loadRawData(text);
        });

        // File Path Loading
        document.getElementById('btn-load-file').addEventListener('click', () => {
            const path = document.getElementById('file-path-input').value;
            this.loadFile(path);
        });

        // File Upload
        document.getElementById('file-upload-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                this.loadRawData(evt.target.result);
            };
            reader.readAsText(file);
        });

        // Point Update
        document.getElementById('btn-submit-update').addEventListener('click', () => {
            const idx = parseInt(document.getElementById('update-idx-input').value, 10);
            const price = parseFloat(document.getElementById('update-price-input').value);
            this.updatePoint(idx, price);
        });

        // Tree Viewport Controls
        document.getElementById('btn-tree-zoom-in').addEventListener('click', () => this.treeViz.zoomIn());
        document.getElementById('btn-tree-zoom-out').addEventListener('click', () => this.treeViz.zoomOut());
        document.getElementById('btn-tree-reset').addEventListener('click', () => this.treeViz.resetView());
        document.getElementById('btn-tree-fit').addEventListener('click', () => this.treeViz.fitToView());
    }

    _toggleQueryMode(mode) {
        const isIndex = mode === 'index';
        document.getElementById('query-index-form').style.display = isIndex ? 'grid' : 'none';
        document.getElementById('query-time-form').style.display = isIndex ? 'none' : 'grid';
    }

    async loadInitialState() {
        try {
            const res = await fetch('/api/state');
            const data = await res.json();
            this._applyState(data);
            if (this.state.n > 0) {
                const sampleR = Math.min(this.state.n - 1, 7);
                this.runQuery('index', 0, sampleR);
            }
        } catch (err) {
            this.showToast(`Error: ${err.message}`, 'error');
        }
    }

    _applyState(data) {
        this.state.n = data.n;
        this.state.prices = data.prices || [];
        this.state.timestamps = data.timestamps || [];
        this.state.stats = data.stats || {};
        this.state.tree = data.tree || null;
        this.state.flatNodes = data.flat_nodes || {};

        // Update Header Stats
        document.getElementById('stat-n').innerText = this.state.n;
        document.getElementById('stat-min').innerText = `$${(this.state.stats.min_price || 0).toFixed(2)}`;
        document.getElementById('stat-max').innerText = `$${(this.state.stats.max_price || 0).toFixed(2)}`;
        document.getElementById('stat-spread').innerText = `$${(this.state.stats.spread || 0).toFixed(2)}`;

        // Update Visualizations
        this.chart.setData(this.state.prices, this.state.timestamps);
        this.treeViz.setTreeData(this.state.tree, this.state.flatNodes, this.state.n);

        // Update Form Selectors & Inputs
        const maxIdx = Math.max(0, this.state.n - 1);
        const leftInput = document.getElementById('query-left-input');
        const rightInput = document.getElementById('query-right-input');
        const updateIdxInput = document.getElementById('update-idx-input');

        leftInput.max = maxIdx;
        rightInput.max = maxIdx;
        if (parseInt(rightInput.value, 10) > maxIdx) rightInput.value = maxIdx;
        updateIdxInput.max = maxIdx;

        // Timestamps Dropdowns
        const startSelect = document.getElementById('query-start-time');
        const endSelect = document.getElementById('query-end-time');
        startSelect.innerHTML = '';
        endSelect.innerHTML = '';

        this.state.timestamps.forEach((t, i) => {
            startSelect.add(new Option(`${t} [${i}]`, t));
            endSelect.add(new Option(`${t} [${i}]`, t));
        });

        if (this.state.timestamps.length > 0) {
            endSelect.selectedIndex = this.state.timestamps.length - 1;
        }
    }

    async generateData(count, startPrice, startTime) {
        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count, start_price: startPrice, start_time: startTime })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            this._applyState(data);
            this.runQuery('index', 0, Math.min(data.n - 1, 7));
        } catch (err) {
            this.showToast(`Generation error: ${err.message}`, 'error');
        }
    }

    async loadRawData(text) {
        if (!text || !text.trim()) {
            this.showToast('Please enter price data.', 'error');
            return;
        }
        try {
            const res = await fetch('/api/load-raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            this._applyState(data);
            this.runQuery('index', 0, Math.min(data.n - 1, 7));
        } catch (err) {
            this.showToast(`Load error: ${err.message}`, 'error');
        }
    }

    async loadFile(filepath) {
        try {
            const res = await fetch('/api/load-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filepath })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            this._applyState(data);
            this.runQuery('index', 0, Math.min(data.n - 1, 7));
        } catch (err) {
            this.showToast(`File error: ${err.message}`, 'error');
        }
    }

    async runQuery(type, left, right, startTime, endTime) {
        if (this.state.n === 0) return;

        const payload = { type };
        if (type === 'index') {
            payload.left = left;
            payload.right = right;
        } else {
            payload.start_time = startTime;
            payload.end_time = endTime;
        }

        try {
            const res = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const r = data.result;

            // Update Chart & Tree Range
            this.chart.setQueryRange(r.q_left, r.q_right, r.min_idx, r.max_idx, r.min_price, r.max_price);
            this.treeViz.highlightQueryTrace(data.visited, data.canonical);

            // Update Result Box
            const resultBox = document.getElementById('query-result-box');
            resultBox.style.display = 'block';

            document.getElementById('qr-range-label').innerText = `Range [${r.q_left}..${r.q_right}] (${r.start_time} - ${r.end_time})`;
            document.getElementById('qr-min').innerText = `$${r.min_price.toFixed(2)}`;
            document.getElementById('qr-min-time').innerText = `${r.min_time} [${r.min_idx}]`;
            document.getElementById('qr-max').innerText = `$${r.max_price.toFixed(2)}`;
            document.getElementById('qr-max-time').innerText = `${r.max_time} [${r.max_idx}]`;
            document.getElementById('qr-spread').innerText = `$${r.spread.toFixed(2)}`;

        } catch (err) {
            this.showToast(`Query error: ${err.message}`, 'error');
        }
    }

    async updatePoint(index, newPrice) {
        if (this.state.n === 0) return;

        try {
            const res = await fetch('/api/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ index, price: newPrice })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            this._applyState(data);
            this.treeViz.highlightUpdatePath(data.updated_nodes);
            this.showToast(`Updated index ${index} to $${data.new_price.toFixed(2)}`);

        } catch (err) {
            this.showToast(`Update error: ${err.message}`, 'error');
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerText = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.2s';
            setTimeout(() => toast.remove(), 200);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
