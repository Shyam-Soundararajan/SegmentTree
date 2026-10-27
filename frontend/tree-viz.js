/**
 * Minimal SVG Segment Tree Visualizer
 * Clean, lightweight, non-distracting presentation.
 */

class SegmentTreeVisualizer {
    constructor(containerElement, onNodeClicked) {
        this.container = containerElement;
        this.onNodeClicked = onNodeClicked;

        this.flatNodes = {};
        this.rootNode = null;
        this.n = 0;

        this.highlightState = {
            activeIndices: new Set(),
            visitedIndices: new Set(),
            updatedIndices: new Set()
        };

        // Layout parameters
        this.nodeW = 104;
        this.nodeH = 58;
        this.leafSpacing = 120;
        this.levelHeight = 90;

        // Viewport transform
        this.scale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.startPan = { x: 0, y: 0 };

        this._createDOM();
        this._setupEvents();
    }

    _createDOM() {
        this.container.innerHTML = `
            <div style="position: relative; width: 100%; height: 100%; overflow: hidden;">
                <svg id="tree-svg" style="width: 100%; height: 100%; cursor: grab; user-select: none;">
                    <g id="tree-root-g">
                        <g id="tree-links-g"></g>
                        <g id="tree-nodes-g"></g>
                    </g>
                </svg>
                <div id="tree-tooltip" class="tree-tooltip" style="display:none; position:absolute; pointer-events:none;"></div>
            </div>
        `;

        this.svg = this.container.querySelector('#tree-svg');
        this.rootG = this.container.querySelector('#tree-root-g');
        this.linksG = this.container.querySelector('#tree-links-g');
        this.nodesG = this.container.querySelector('#tree-nodes-g');
        this.tooltip = this.container.querySelector('#tree-tooltip');
    }

    _setupEvents() {
        this.svg.addEventListener('mousedown', (e) => {
            if (e.target.closest('.tree-node')) return;
            this.isPanning = true;
            this.svg.style.cursor = 'grabbing';
            this.startPan = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;
            this.panX = e.clientX - this.startPan.x;
            this.panY = e.clientY - this.startPan.y;
            this._applyTransform();
        });

        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.svg.style.cursor = 'grab';
            }
        });

        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
            const newScale = Math.min(3.0, Math.max(0.2, this.scale * zoomFactor));

            this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
            this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
            this.scale = newScale;

            this._applyTransform();
        }, { passive: false });
    }

    _applyTransform() {
        this.rootG.setAttribute('transform', `matrix(${this.scale}, 0, 0, ${this.scale}, ${this.panX}, ${this.panY})`);
    }

    setTreeData(treeHierarchy, flatNodes, n) {
        this.rootNode = treeHierarchy;
        this.flatNodes = flatNodes || {};
        this.n = n || 0;
        this.clearHighlights();

        if (this.rootNode) {
            this._computeLayout();
            this.render();
            this.fitToView();
        } else {
            this.nodesG.innerHTML = '';
            this.linksG.innerHTML = '';
        }
    }

    _computeLayout() {
        if (!this.rootNode || this.n === 0) return;
        let leafCount = 0;
        const self = this;
        let maxD = 0;

        function assignPositions(node, depth) {
            if (!node) return;
            maxD = Math.max(maxD, depth);
            node.depth = depth;

            if (node.is_leaf || (!node.left && !node.right)) {
                node.x = leafCount * self.leafSpacing;
                leafCount++;
            } else {
                if (node.left) assignPositions(node.left, depth + 1);
                if (node.right) assignPositions(node.right, depth + 1);

                const leftX = node.left ? node.left.x : 0;
                const rightX = node.right ? node.right.x : leftX;
                node.x = (leftX + rightX) / 2;
            }
            node.y = depth * self.levelHeight + 35;
        }

        assignPositions(this.rootNode, 0);
        this.calculatedMaxDepth = maxD;
    }

    render() {
        this.nodesG.innerHTML = '';
        this.linksG.innerHTML = '';
        if (!this.rootNode) return;

        const renderedNodes = [];
        const renderedLinks = [];

        function traverse(node) {
            if (!node) return;
            renderedNodes.push(node);
            if (node.left) {
                renderedLinks.push({ parent: node, child: node.left });
                traverse(node.left);
            }
            if (node.right) {
                renderedLinks.push({ parent: node, child: node.right });
                traverse(node.right);
            }
        }
        traverse(this.rootNode);

        // Draw Links
        let linksHtml = '';
        for (const link of renderedLinks) {
            const x1 = link.parent.x;
            const y1 = link.parent.y + this.nodeH / 2;
            const x2 = link.child.x;
            const y2 = link.child.y - this.nodeH / 2;
            const midY = (y1 + y2) / 2;

            const isHighlighted = this.highlightState.activeIndices.has(link.child.node_idx);
            const isVisited = this.highlightState.visitedIndices.has(link.child.node_idx);
            const strokeColor = isHighlighted ? '#22c55e' : (isVisited ? '#3b82f6' : '#212836');
            const strokeWidth = (isHighlighted || isVisited) ? 2 : 1;

            linksHtml += `<path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" />`;
        }
        this.linksG.innerHTML = linksHtml;

        // Draw Nodes
        let nodesHtml = '';
        for (const node of renderedNodes) {
            nodesHtml += this._renderNode(node);
        }
        this.nodesG.innerHTML = nodesHtml;

        this._attachNodeListeners();
    }

    _renderNode(node) {
        const x = node.x - this.nodeW / 2;
        const y = node.y - this.nodeH / 2;
        const idx = node.node_idx;

        const isActive = this.highlightState.activeIndices.has(idx);
        const isVisited = this.highlightState.visitedIndices.has(idx);
        const isUpdated = this.highlightState.updatedIndices.has(idx);
        const hasHighlights = this.highlightState.activeIndices.size > 0 || this.highlightState.visitedIndices.size > 0;

        let stroke = '#212836';
        let bg = '#12161f';
        let opacity = 1.0;

        if (isActive) {
            stroke = '#22c55e';
            bg = '#14221a';
        } else if (isVisited) {
            stroke = '#3b82f6';
            bg = '#141d2e';
        } else if (isUpdated) {
            stroke = '#eab308';
            bg = '#241f12';
        } else if (hasHighlights) {
            opacity = 0.35;
        }

        const minStr = `$${Number(node.min_price).toFixed(2)}`;
        const maxStr = `$${Number(node.max_price).toFixed(2)}`;
        const spreadStr = `$${Number(node.spread).toFixed(2)}`;

        return `
            <g class="tree-node" data-idx="${idx}" transform="translate(${x}, ${y})" opacity="${opacity}" style="cursor: pointer;">
                <rect width="${this.nodeW}" height="${this.nodeH}" rx="5" fill="${bg}" stroke="${stroke}" stroke-width="1.2"/>
                <text x="7" y="15" font-size="10" font-weight="600" fill="#9ca3af" font-family="JetBrains Mono, monospace">[${node.start}..${node.end}]</text>
                <text x="${this.nodeW - 7}" y="15" text-anchor="end" font-size="9" fill="#4b5563" font-family="JetBrains Mono, monospace">#${idx}</text>
                <line x1="7" y1="21" x2="${this.nodeW - 7}" y2="21" stroke="${stroke}" stroke-width="0.8" opacity="0.4"/>
                <text x="7" y="34" font-size="9" fill="#22c55e" font-family="JetBrains Mono, monospace">Min: ${minStr}</text>
                <text x="7" y="45" font-size="9" fill="#ef4444" font-family="JetBrains Mono, monospace">Max: ${maxStr}</text>
                <text x="7" y="54" font-size="8" fill="#6b7280" font-family="JetBrains Mono, monospace">Spr: ${spreadStr}</text>
            </g>
        `;
    }

    _attachNodeListeners() {
        const els = this.nodesG.querySelectorAll('.tree-node');
        els.forEach(el => {
            const idx = parseInt(el.getAttribute('data-idx'), 10);
            const node = this.flatNodes[idx];

            el.addEventListener('mouseenter', () => {
                if (!node) return;
                this.tooltip.style.display = 'block';
                this.tooltip.innerHTML = `
                    <div style="color: #60a5fa; margin-bottom: 2px;">Interval [${node.start}..${node.end}]</div>
                    <div style="color: #9ca3af; font-size: 10px;">${node.start_time} - ${node.end_time}</div>
                    <div style="color: #22c55e;">Min: $${Number(node.min_price).toFixed(2)}</div>
                    <div style="color: #ef4444;">Max: $${Number(node.max_price).toFixed(2)}</div>
                    <div style="color: #9ca3af;">Spread: $${Number(node.spread).toFixed(2)}</div>
                `;
            });

            el.addEventListener('mousemove', (e) => {
                const rect = this.container.getBoundingClientRect();
                this.tooltip.style.left = `${e.clientX - rect.left + 12}px`;
                this.tooltip.style.top = `${e.clientY - rect.top + 12}px`;
            });

            el.addEventListener('mouseleave', () => {
                this.tooltip.style.display = 'none';
            });

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (node && this.onNodeClicked) {
                    this.onNodeClicked(node);
                }
            });
        });
    }

    highlightQueryTrace(visitedList, canonicalList) {
        this.highlightState.activeIndices = new Set(canonicalList || []);
        this.highlightState.visitedIndices = new Set();
        this.highlightState.updatedIndices.clear();

        if (visitedList) {
            visitedList.forEach(item => {
                if (!this.highlightState.activeIndices.has(item.node_idx) && item.status === 'partial') {
                    this.highlightState.visitedIndices.add(item.node_idx);
                }
            });
        }
        this.render();
    }

    highlightUpdatePath(path) {
        this.highlightState.activeIndices.clear();
        this.highlightState.visitedIndices.clear();
        this.highlightState.updatedIndices = new Set(path || []);
        this.render();
    }

    clearHighlights() {
        this.highlightState.activeIndices.clear();
        this.highlightState.visitedIndices.clear();
        this.highlightState.updatedIndices.clear();
        this.render();
    }

    zoomIn() {
        this.scale = Math.min(3.0, this.scale * 1.25);
        this._applyTransform();
    }

    zoomOut() {
        this.scale = Math.max(0.2, this.scale * 0.8);
        this._applyTransform();
    }

    resetView() {
        this.scale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this._applyTransform();
    }

    fitToView() {
        if (!this.rootNode || this.n === 0) return;
        const rect = this.container.getBoundingClientRect();
        const treeWidth = Math.max(1, (this.n - 1) * this.leafSpacing + this.nodeW + 40);
        const treeHeight = Math.max(1, (this.calculatedMaxDepth + 1) * this.levelHeight + 70);

        const scaleX = (rect.width - 30) / treeWidth;
        const scaleY = (rect.height - 30) / treeHeight;
        this.scale = Math.min(1.1, Math.max(0.2, Math.min(scaleX, scaleY)));

        this.panX = (rect.width - treeWidth * this.scale) / 2 + 20;
        this.panY = 15;
        this._applyTransform();
    }
}

window.SegmentTreeVisualizer = SegmentTreeVisualizer;
