// Board rendering and block interaction module
export class BoardRenderer {
    constructor(gameState, gameBoard, dragHandler, onBlockClick, onEmptyCellClick) {
        this.gameState = gameState;
        this.gameBoard = gameBoard;
        this.dragHandler = dragHandler;
        this.onBlockClick = onBlockClick;
        this.onEmptyCellClick = onEmptyCellClick;
    }
    
    render() {
        this.gameBoard.innerHTML = '';
        
        const boardSize = this.gameBoard.clientWidth;
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
        const cellSize = (boardSize - (this.gameState.gridSize + 1) * gap) / this.gameState.gridSize;

        this.gameBoard.style.gridTemplateColumns = `repeat(${this.gameState.gridSize}, 1fr)`;
        this.gameBoard.style.gridTemplateRows = `repeat(${this.gameState.gridSize}, 1fr)`;
        this.gameBoard.style.gap = `${gap}px`;

        for (let i = 0; i < this.gameState.gridSize * this.gameState.gridSize; i++) {
            this.createGridCell(i);
            
            if (this.gameState.getBlockValue(i) !== 0) {
                this.createBlock(i, cellSize, gap);
            }
        }
        
        this.gameState.nextSpawnIndices.forEach(index => {
            this.createSpawnIndicator(index, cellSize, gap);
        });
    }
    
    renderBlocks() {
        // Remove only existing blocks
        this.gameBoard.querySelectorAll('.block').forEach(el => el.remove());

        const boardSize = this.gameBoard.clientWidth;
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
        const cellSize = (boardSize - (this.gameState.gridSize + 1) * gap) / this.gameState.gridSize;

        // Re-create blocks
        for (let i = 0; i < this.gameState.gridSize * this.gameState.gridSize; i++) {
            if (this.gameState.getBlockValue(i) !== 0) {
                this.createBlock(i, cellSize, gap);
            }
        }
    }

    renderIndicators() {
        // Remove only existing indicators
        this.gameBoard.querySelectorAll('.spawn-indicator').forEach(el => el.remove());
        
        const boardSize = this.gameBoard.clientWidth;
        const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gap'));
        const cellSize = (boardSize - (this.gameState.gridSize + 1) * gap) / this.gameState.gridSize;

        // Re-create indicators
        this.gameState.nextSpawnIndices.forEach(index => {
            this.createSpawnIndicator(index, cellSize, gap);
        });
    }
    
    createGridCell(index) {
        const cell = document.createElement('div');
        cell.classList.add('grid-cell');
        cell.addEventListener('click', (e) => {
            // Prevent clicks from propagating to the overlay if this cell has an indicator
            const isIndicatorCell = this.gameState.nextSpawnIndices.includes(index);
            if(isIndicatorCell && (this.gameState.currentDifficulty === 'easy' || this.gameState.currentDifficulty === 'zen')){
                e.stopPropagation();
            }
            this.onEmptyCellClick(index);
        });
        this.gameBoard.appendChild(cell);
    }
    
    createSpawnIndicator(index, cellSize, gap) {
        const indicator = document.createElement('div');
        indicator.classList.add('spawn-indicator');
        indicator.dataset.index = index;
        
        const row = Math.floor(index / this.gameState.gridSize);
        const col = index % this.gameState.gridSize;
        
        indicator.style.width = `${cellSize}px`;
        indicator.style.height = `${cellSize}px`;
        indicator.style.top = `${gap + row * (cellSize + gap)}px`;
        indicator.style.left = `${gap + col * (cellSize + gap)}px`;

        this.gameBoard.appendChild(indicator);
    }
    
    createBlock(index, cellSize, gap) {
        const block = document.createElement('div');
        const value = this.gameState.getBlockValue(index);
        block.classList.add('block', `block-${value}`);
        block.dataset.index = index;
        
        const imageUrl = this.gameState.getImageForValue(value);

        if (this.gameState.theme && imageUrl) {
            if (imageUrl === 'loading') {
                block.textContent = '...';
                block.classList.add('loading');
            } else {
                block.innerHTML = `<img src="${imageUrl}" alt="${this.gameState.theme} ${value}">`;
            }
        } else {
            block.textContent = value;
        }

        this.positionBlock(block, index, cellSize, gap);
        this.addBlockInteractions(block, index);
        
        if (this.gameState.isBlockSelected(index)) {
            block.classList.add('selected');
        }

        this.gameBoard.appendChild(block);
    }
    
    positionBlock(block, index, cellSize, gap) {
        const row = Math.floor(index / this.gameState.gridSize);
        const col = index % this.gameState.gridSize;
        
        block.style.width = `${cellSize}px`;
        block.style.height = `${cellSize}px`;
        block.style.top = `${gap + row * (cellSize + gap)}px`;
        block.style.left = `${gap + col * (cellSize + gap)}px`;
        block.style.fontSize = `${cellSize * 0.4}px`;
    }
    
    addBlockInteractions(block, index) {
        let dragStarted = false;
        let startTime = 0;

        block.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!dragStarted) {
                this.onBlockClick(index);
            }
        });

        // Mouse drag events
        block.addEventListener('mousedown', (e) => {
            e.preventDefault();
            dragStarted = false;
            startTime = Date.now();
            
            const mouseMove = (moveEvent) => {
                const timeDiff = Date.now() - startTime;
                const distance = Math.sqrt(
                    Math.pow(moveEvent.clientX - e.clientX, 2) + 
                    Math.pow(moveEvent.clientY - e.clientY, 2)
                );
                
                if ((distance > 5 || timeDiff > 150) && !dragStarted) {
                    dragStarted = true;
                    this.dragHandler.handleDragStart(index, e.clientX, e.clientY);
                    document.removeEventListener('mousemove', mouseMove);
                    document.removeEventListener('mouseup', mouseUp);
                }
            };
            
            const mouseUp = () => {
                document.removeEventListener('mousemove', mouseMove);
                document.removeEventListener('mouseup', mouseUp);
            };
            
            document.addEventListener('mousemove', mouseMove);
            document.addEventListener('mouseup', mouseUp);
        });

        // Touch drag events
        block.addEventListener('touchstart', (e) => {
            e.preventDefault();
            dragStarted = false;
            startTime = Date.now();
            const touch = e.touches[0];
            const startX = touch.clientX;
            const startY = touch.clientY;
            
            const touchMove = (moveEvent) => {
                const currentTouch = moveEvent.touches[0];
                const timeDiff = Date.now() - startTime;
                const distance = Math.sqrt(
                    Math.pow(currentTouch.clientX - startX, 2) + 
                    Math.pow(currentTouch.clientY - startY, 2)
                );
                
                if ((distance > 10 || timeDiff > 200) && !dragStarted) {
                    dragStarted = true;
                    this.dragHandler.handleDragStart(index, startX, startY);
                    document.removeEventListener('touchmove', touchMove);
                    document.removeEventListener('touchend', touchEnd);
                }
            };
            
            const touchEnd = () => {
                document.removeEventListener('touchmove', touchMove);
                document.removeEventListener('touchend', touchEnd);
            };
            
            document.addEventListener('touchmove', touchMove);
            document.addEventListener('touchend', touchEnd);
        });
    }
}