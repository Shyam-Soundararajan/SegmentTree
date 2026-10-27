/**
 * Interactive Canvas Stock Price Chart for Segment Tree Visualizer
 * Supports:
 * - Line chart with subtle gradient fill
 * - Range highlight overlay [q_left, q_right]
 * - Min and Max price markers on the selected range
 * - Click & Drag range selection
 * - Hover tooltips and crosshairs
 * - High-DPI screen support
 */

class StockPriceChart {
    constructor(canvasElement, onRangeSelected) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        this.onRangeSelected = onRangeSelected;

        this.prices = [];
        this.timestamps = [];
        this.queryRange = null; // { left, right, minIdx, maxIdx, minPrice, maxPrice }
        
        this.hoverIdx = -1;
        this.isDragging = false;
        this.dragStartIdx = -1;
        this.dragCurrentIdx = -1;

        // Dimensions
        this.padding = { top: 30, right: 50, bottom: 40, left: 60 };
        this.width = 0;
        this.height = 0;

        this._setupEvents();
        this.resize();
    }

    setData(prices, timestamps) {
        this.prices = prices || [];
        this.timestamps = timestamps || [];
        this.queryRange = null;
        this.render();
    }

    setQueryRange(left, right, minIdx, maxIdx, minPrice, maxPrice) {
        this.queryRange = { left, right, minIdx, maxIdx, minPrice, maxPrice };
        this.render();
    }

    clearQueryRange() {
        this.queryRange = null;
        this.render();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.width = rect.width || 600;
        this.height = rect.height || 220;

        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        this.ctx.scale(dpr, dpr);
        this.render();
    }

    _setupEvents() {
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
        window.addEventListener('mouseup', (e) => this._onMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => {
            if (!this.isDragging) {
                this.hoverIdx = -1;
                this.render();
            }
        });
    }

    _getChartCoordinates() {
        const chartX = this.padding.left;
        const chartY = this.padding.top;
        const chartW = Math.max(10, this.width - this.padding.left - this.padding.right);
        const chartH = Math.max(10, this.height - this.padding.top - this.padding.bottom);
        return { chartX, chartY, chartW, chartH };
    }

    _indexToX(idx) {
        const { chartX, chartW } = this._getChartCoordinates();
        if (this.prices.length <= 1) return chartX + chartW / 2;
        return chartX + (idx / (this.prices.length - 1)) * chartW;
    }

    _xToIndex(x) {
        const { chartX, chartW } = this._getChartCoordinates();
        if (this.prices.length <= 1) return 0;
        const ratio = (x - chartX) / chartW;
        const idx = Math.round(ratio * (this.prices.length - 1));
        return Math.max(0, Math.min(this.prices.length - 1, idx));
    }

    _priceToY(price, minP, maxP) {
        const { chartY, chartH } = this._getChartCoordinates();
        if (maxP === minP) return chartY + chartH / 2;
        return chartY + chartH - ((price - minP) / (maxP - minP)) * chartH;
    }

    _onMouseMove(e) {
        if (!this.prices.length) return;
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const idx = this._xToIndex(mouseX);

        if (this.isDragging) {
            this.dragCurrentIdx = idx;
        } else {
            this.hoverIdx = idx;
        }
        this.render();
    }

    _onMouseDown(e) {
        if (!this.prices.length) return;
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        this.isDragging = true;
        this.dragStartIdx = this._xToIndex(mouseX);
        this.dragCurrentIdx = this.dragStartIdx;
        this.render();
    }

    _onMouseUp(e) {
        if (!this.isDragging) return;
        this.isDragging = false;
        if (this.dragStartIdx !== -1 && this.dragCurrentIdx !== -1) {
            const left = Math.min(this.dragStartIdx, this.dragCurrentIdx);
            const right = Math.max(this.dragStartIdx, this.dragCurrentIdx);
            if (this.onRangeSelected) {
                this.onRangeSelected(left, right);
            }
        }
        this.dragStartIdx = -1;
        this.dragCurrentIdx = -1;
        this.render();
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        if (!this.prices.length) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No stock price data loaded. Generate or import data to begin.', this.width / 2, this.height / 2);
            return;
        }

        const { chartX, chartY, chartW, chartH } = this._getChartCoordinates();

        // Calculate min and max with 5% padding
        let minP = Math.min(...this.prices);
        let maxP = Math.max(...this.prices);
        const paddingP = (maxP - minP === 0) ? 1.0 : (maxP - minP) * 0.1;
        minP = Math.max(0, minP - paddingP);
        maxP = maxP + paddingP;

        // 1. Draw Grid lines
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        const gridStepsY = 4;
        for (let i = 0; i <= gridStepsY; i++) {
            const y = chartY + (i / gridStepsY) * chartH;
            ctx.beginPath();
            ctx.moveTo(chartX, y);
            ctx.lineTo(chartX + chartW, y);
            ctx.stroke();

            // Y-axis label
            const pVal = maxP - (i / gridStepsY) * (maxP - minP);
            ctx.fillStyle = '#64748b';
            ctx.font = '11px JetBrains Mono, monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`$${pVal.toFixed(2)}`, chartX - 8, y + 4);
        }

        // X-axis timestamps
        const numXLabels = Math.min(8, this.prices.length);
        for (let i = 0; i < numXLabels; i++) {
            const idx = Math.round((i / (numXLabels - 1)) * (this.prices.length - 1));
            const x = this._indexToX(idx);
            ctx.beginPath();
            ctx.moveTo(x, chartY + chartH);
            ctx.lineTo(x, chartY + chartH + 5);
            ctx.stroke();

            ctx.fillStyle = '#64748b';
            ctx.font = '11px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            const label = this.timestamps[idx] || `[${idx}]`;
            ctx.fillText(label, x, chartY + chartH + 18);
        }

        // 2. Query Range Highlight / Drag Highlight
        let activeLeft = -1;
        let activeRight = -1;

        if (this.isDragging && this.dragStartIdx !== -1 && this.dragCurrentIdx !== -1) {
            activeLeft = Math.min(this.dragStartIdx, this.dragCurrentIdx);
            activeRight = Math.max(this.dragStartIdx, this.dragCurrentIdx);
        } else if (this.queryRange) {
            activeLeft = this.queryRange.left;
            activeRight = this.queryRange.right;
        }

        if (activeLeft >= 0 && activeRight >= 0 && activeLeft < this.prices.length) {
            const x1 = this._indexToX(activeLeft);
            const x2 = this._indexToX(activeRight);
            const rangeW = Math.max(6, x2 - x1);

            // Shaded overlay
            ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
            ctx.fillRect(x1 - 3, chartY, rangeW + 6, chartH);

            // Borders
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x1, chartY);
            ctx.lineTo(x1, chartY + chartH);
            ctx.moveTo(x2, chartY);
            ctx.lineTo(x2, chartY + chartH);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label at top of range
            ctx.fillStyle = '#10b981';
            ctx.font = '10px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            const rangeLabel = `Query [${activeLeft}..${activeRight}]`;
            ctx.fillText(rangeLabel, (x1 + x2) / 2, chartY - 10);
        }

        // 3. Draw Price Line & Gradient Area
        const gradient = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        gradient.addColorStop(1, 'rgba(56, 189, 248, 0.01)');

        ctx.beginPath();
        for (let i = 0; i < this.prices.length; i++) {
            const x = this._indexToX(i);
            const y = this._priceToY(this.prices[i], minP, maxP);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        // Fill area
        ctx.lineTo(this._indexToX(this.prices.length - 1), chartY + chartH);
        ctx.lineTo(this._indexToX(0), chartY + chartH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Stroke line
        ctx.beginPath();
        for (let i = 0; i < this.prices.length; i++) {
            const x = this._indexToX(i);
            const y = this._priceToY(this.prices[i], minP, maxP);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // 4. Data points (dots) if N <= 40
        if (this.prices.length <= 40) {
            for (let i = 0; i < this.prices.length; i++) {
                const x = this._indexToX(i);
                const y = this._priceToY(this.prices[i], minP, maxP);
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#0f172a';
                ctx.fill();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // 5. Min / Max Markers if Query is active
        if (this.queryRange) {
            const { minIdx, maxIdx, minPrice, maxPrice } = this.queryRange;

            // Min Price Marker
            if (minIdx >= 0 && minIdx < this.prices.length) {
                const x = this._indexToX(minIdx);
                const y = this._priceToY(minPrice, minP, maxP);
                this._drawMarker(ctx, x, y, `Min: $${minPrice.toFixed(2)}`, '#10b981', true);
            }

            // Max Price Marker
            if (maxIdx >= 0 && maxIdx < this.prices.length) {
                const x = this._indexToX(maxIdx);
                const y = this._priceToY(maxPrice, minP, maxP);
                this._drawMarker(ctx, x, y, `Max: $${maxPrice.toFixed(2)}`, '#f43f5e', false);
            }
        }

        // 6. Hover Crosshair & Tooltip
        if (this.hoverIdx >= 0 && this.hoverIdx < this.prices.length) {
            const x = this._indexToX(this.hoverIdx);
            const price = this.prices[this.hoverIdx];
            const y = this._priceToY(price, minP, maxP);
            const time = this.timestamps[this.hoverIdx] || `[${this.hoverIdx}]`;

            // Crosshair lines
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(x, chartY);
            ctx.lineTo(x, chartY + chartH);
            ctx.moveTo(chartX, y);
            ctx.lineTo(chartX + chartW, y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Dot on point
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Tooltip box
            const tooltipText = `Idx ${this.hoverIdx} | ${time} | $${price.toFixed(2)}`;
            ctx.font = '11px JetBrains Mono, monospace';
            const textWidth = ctx.measureText(tooltipText).width;
            let tooltipX = x - textWidth / 2 - 8;
            tooltipX = Math.max(chartX, Math.min(chartX + chartW - textWidth - 16, tooltipX));
            const tooltipY = Math.max(chartY + 10, y - 35);

            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(tooltipX, tooltipY, textWidth + 16, 24, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#f8fafc';
            ctx.textAlign = 'left';
            ctx.fillText(tooltipText, tooltipX + 8, tooltipY + 16);
        }
    }

    _drawMarker(ctx, x, y, text, color, isBottom) {
        // Glowing target dot
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Pin badge
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        const w = ctx.measureText(text).width + 12;
        const h = 20;
        const boxX = Math.max(10, Math.min(this.width - w - 10, x - w / 2));
        const boxY = isBottom ? Math.min(this.height - 25, y + 12) : Math.max(10, y - 28);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, w, h, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(text, boxX + w / 2, boxY + 14);
    }
}

window.StockPriceChart = StockPriceChart;
