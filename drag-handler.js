// Drag and touch interaction handler module
export class DragHandler {
    constructor(gameState, gameBoard) {
        this.gameState = gameState;
        this.gameBoard = gameBoard;
        this.isDragging = false;
        this.dragStartIndex = -1;
        this.dragEndIndex = -1;
        this.dragLine = null;
        this.dragStartPos = { x: 0, y: 0 };
        
        this.setupGlobalEvents();
    }
    
    setupGlobalEvents() {
        // Global mouse events
        document.addEventListener('mousemove', (e) => {
            this.handleDragMove(e.clientX, e.clientY);
        });

        document.addEventListener('mouseup', (e) => {
            this.handleDragEnd(e.clientX, e.clientY);
        });

        // Global touch events
        document.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                e.preventDefault();
                const touch = e.touches[0];
                this.handleDragMove(touch.clientX, touch.clientY);
            }
        });

        document.addEventListener('touchend', (e) => {
            if (this.isDragging) {
                const touch = e.changedTouches[0];
                this.handleDragEnd(touch.clientX, touch.clientY);
            } else {
                 this.handleDragEnd();
            }
        });
    }
    
    getIndexFromPosition(x, y) {
        const boardRect = this.gameBoard.getBoundingClientRect();
        
        // Account for CSS scaling on the container
        const gameContainer = document.getElementById('game-container');
        const containerRect = gameContainer.getBoundingClientRect();
        const style = window.getComputedStyle(gameContainer);
        const transform = style.transform;
        
        let scale = 1;
        if (transform && transform !== 'none') {
            const matrix = new DOMMatrix(transform);
            scale = matrix.a; // Assuming uniform scaling (matrix.a === matrix.d)
        }

        const relativeX = (x - boardRect.left) / scale;
        const relativeY = (y - boardRect.top) / scale;
        
        const boardSize = this.gameBoard.clientWidth;
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
        const cellSize = (boardSize - (this.gameState.gridSize + 1) * gap) / this.gameState.gridSize;
        
        const col = Math.floor((relativeX - gap) / (cellSize + gap));
        const row = Math.floor((relativeY - gap) / (cellSize + gap));
        
        if (col >= 0 && col < this.gameState.gridSize && row >= 0 && row < this.gameState.gridSize) {
            return row * this.gameState.gridSize + col;
        }
        return -1;
    }
    
    getBlockCenterPosition(index) {
        const boardRect = this.gameBoard.getBoundingClientRect();
        const boardSize = this.gameBoard.clientWidth;
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
        const cellSize = (boardSize - (this.gameState.gridSize + 1) * gap) / this.gameState.gridSize;
        
        const row = Math.floor(index / this.gameState.gridSize);
        const col = index % this.gameState.gridSize;
        
        const centerX = boardRect.left + window.scrollX + gap + col * (cellSize + gap) + cellSize / 2;
        const centerY = boardRect.top + window.scrollY + gap + row * (cellSize + gap) + cellSize / 2;
        
        return { x: centerX, y: centerY };
    }
    
    createDragLine(startPos, endPos) {
        if (this.dragLine) {
            this.dragLine.remove();
        }
        
        this.dragLine = document.createElement('div');
        this.dragLine.style.position = 'fixed';
        this.dragLine.style.background = '#2ecc71';
        this.dragLine.style.height = '4px';
        this.dragLine.style.borderRadius = '2px';
        this.dragLine.style.pointerEvents = 'none';
        this.dragLine.style.zIndex = '1000';
        this.dragLine.style.transformOrigin = 'left center';
        
        const deltaX = endPos.x - startPos.x;
        const deltaY = endPos.y - startPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);
        
        this.dragLine.style.width = distance + 'px';
        this.dragLine.style.left = startPos.x + 'px';
        this.dragLine.style.top = startPos.y + 'px';
        this.dragLine.style.transform = `rotate(${angle}rad)`;
        
        document.body.appendChild(this.dragLine);
    }
    
    removeDragLine() {
        if (this.dragLine) {
            this.dragLine.remove();
            this.dragLine = null;
        }
    }
    
    handleDragStart(startIndex, clientX, clientY) {
        if (this.gameState.getBlockValue(startIndex) === 0) return false;
        
        this.isDragging = true;
        this.dragStartIndex = startIndex;
        this.gameState.selectBlock(startIndex);
        
        // The visual line should start exactly where the user clicked.
        this.dragStartPos = { x: clientX, y: clientY };
        
        // Initially, the line is from the start point to itself (zero length)
        // It will be updated by the first handleDragMove call.
        this.createDragLine(this.dragStartPos, this.dragStartPos);
        
        return true;
    }
    
    handleDragMove(clientX, clientY) {
        if (!this.isDragging) return;
        
        this.createDragLine(this.dragStartPos, { x: clientX, y: clientY });
        
        const currentIndex = this.getIndexFromPosition(clientX, clientY);
        // We don't need to update dragEndIndex on move, we can get it once on drop.
    }
    
    handleDragEnd(clientX, clientY) {
        if (!this.isDragging) return;
        
        this.removeDragLine();
        
        let boardChanged = false;
        
        const endIndex = this.getIndexFromPosition(clientX, clientY);

        const isTargetingIndicator = endIndex !== -1 && this.gameState.nextSpawnIndices.includes(endIndex);

        if (endIndex !== -1 && endIndex !== this.dragStartIndex) {
             if (isTargetingIndicator && (this.gameState.currentDifficulty === 'easy' || this.gameState.currentDifficulty === 'zen')) {
                if (this.onIndicatorDrop) {
                    this.onIndicatorDrop(endIndex);
                }
                // The drop action itself doesn't change the board (the spawn does), so boardChanged remains false.
            } else {
                boardChanged = this.processDragAction(this.dragStartIndex, endIndex);
            }
        }
        
        this.isDragging = false;
        this.dragStartIndex = -1;
        this.dragEndIndex = -1; // Reset this for safety, though it's no longer used for the final position
        this.dragStartPos = { x: 0, y: 0 };
        this.gameState.deselectBlock();
        
        // Trigger board re-render after drag operations
        if (this.onDragComplete) {
            this.onDragComplete(boardChanged);
        }
    }
    
    processDragAction(startIndex, endIndex) {
        const startValue = this.gameState.getBlockValue(startIndex);
        const endValue = this.gameState.getBlockValue(endIndex);
        const isNeighbor = this.gameState.areNeighbors(startIndex, endIndex);
        let boardChanged = false;

        const isTargetingIndicator = this.gameState.nextSpawnIndices.includes(endIndex);
        if (isTargetingIndicator && this.gameState.currentDifficulty !== 'easy' && this.gameState.currentDifficulty !== 'zen') {
            return false; // Disallow interaction with indicators on non-easy/zen modes.
        }
        
        if (endValue === 0) {
            // Moving to empty cell
            if (isNeighbor) {
                this.gameState.placeBlock(endIndex, startValue);
                this.gameState.removeBlock(startIndex);
                this.gameState.logEvent('move', { from: startIndex, to: endIndex, value: startValue });
                boardChanged = true;
            }
        } else {
            // Merging with another block
            const sameValue = startValue === endValue;
            const sumValue = startValue + endValue;
            
            if (isNeighbor && sameValue) {
                const mergedValue = endValue + 1;
                this.gameState.placeBlock(endIndex, mergedValue);
                this.gameState.removeBlock(startIndex);
                this.gameState.updateScore(mergedValue);
                this.gameState.logEvent('merge', { from: startIndex, to: endIndex, value: startValue, result: mergedValue, scoreChange: mergedValue });
                boardChanged = true;
            } else if (isNeighbor && sumValue % 2 === 0) {
                const halfValue = sumValue / 2;
                this.gameState.placeBlock(startIndex, halfValue);
                this.gameState.placeBlock(endIndex, halfValue);
                this.gameState.updateScore(halfValue * 2);
                this.gameState.logEvent('split', { from: startIndex, to: endIndex, values: [startValue, endValue], result: halfValue, scoreChange: halfValue * 2 });
                boardChanged = true;
            }
        }
        return boardChanged;
    }
}