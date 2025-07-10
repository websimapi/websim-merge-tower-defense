// carousel.js
export class Carousel {
    constructor(containerId, room) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Carousel container not found');
            return;
        }
        this.wrapper = this.container.parentElement;
        this.room = room;
        this.totalSlots = 0; // Will be calculated dynamically
        
        this.isDragging = false;
        this.dragStartData = null;
        this.dragLine = null;

        this.onMergeRequest = null; // Callback for script.js
        this.getLocalPlayerState = null; // Callback to get local game state from script.js
        
        this.init();
        
        if (this.room) {
            this.room.subscribePresence(() => this.updateCarousel());
        }

        window.addEventListener('resize', () => this.init());
        this.setupGlobalDragListeners();
    }

    init() {
        this.calculateTotalSlots();
        this.updateCarousel();
    }

    calculateTotalSlots() {
        if (!this.wrapper) return;

        const itemWidth = 220; // from .carousel-item --carousel-item-size
        const itemGap = 30; // from .carousel-item --carousel-gap
        const effectiveItemWidth = itemWidth + itemGap;

        const wrapperWidth = this.wrapper.clientWidth;

        // Calculate how many items are needed to fill the screen, plus one extra
        // to ensure the scroll effect is seamless.
        const slotsNeeded = Math.ceil(wrapperWidth / effectiveItemWidth) + 1;

        // Set a minimum number of slots to ensure the carousel doesn't look too empty
        // on very small screens, based on the user's suggestion.
        this.totalSlots = Math.max(5, slotsNeeded);
    }

    updateCarousel() {
        const players = Object.entries(this.room.presence || {})
            .filter(([id, p]) => p.inGame && p.boardState && p.boardState.length > 0 && p.gridSize)
            .map(([id, p]) => ({ ...p, clientId: id })); // Add clientId to player data
        
        const slots = this.generateSlots(players);

        this.container.innerHTML = '';
        slots.forEach(slot => this.container.appendChild(slot));

        // Clone for seamless scrolling, only if there's content
        if (slots.length > 0) {
            slots.forEach(slot => this.container.appendChild(slot.cloneNode(true)));
        }
    }
    
    generateSlots(players) {
        const slots = [];
        const numPlayers = players.length;

        if (numPlayers === 0) {
            // If no players, create empty placeholder slots
            for (let i = 0; i < this.totalSlots; i++) {
                slots.push(this.createCarouselItem(null));
            }
            return slots;
        }
        
        // Distribute players across the total slots
        const slotsPerPlayer = Math.max(1, Math.floor(this.totalSlots / numPlayers));
        
        for (let i = 0; i < numPlayers; i++) {
            slots.push(this.createCarouselItem(players[i]));
            // Add empty slots for spacing, but don't exceed total slots
            for (let j = 0; j < slotsPerPlayer - 1 && slots.length < this.totalSlots; j++) {
                slots.push(this.createCarouselItem(null));
            }
        }
        
        // Fill remaining slots if any
        while (slots.length < this.totalSlots) {
             slots.push(this.createCarouselItem(null));
        }

        return slots;
    }

    createCarouselItem(playerData) {
        const item = document.createElement('div');
        item.classList.add('carousel-item');
        item.dataset.playerData = playerData ? JSON.stringify(playerData) : '';
        
        if (!playerData) {
            item.classList.add('empty');
            // An empty item should not be draggable.
            return item;
        }

        this.addDragHandlers(item);

        const { gridSize, boardState, theme, blockImages } = playerData;
        
        if (!gridSize || !boardState || boardState.length !== gridSize * gridSize) {
            item.classList.add('empty');
            return item;
        }
        
        item.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
        item.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

        for (let i = 0; i < boardState.length; i++) {
            const cell = document.createElement('div');
            cell.classList.add('carousel-cell');
            
            const value = boardState[i];
            if (value > 0) {
                const imageUrl = (blockImages || {})[value];
                if (theme && imageUrl && imageUrl !== 'loading') {
                     cell.innerHTML = `<img src="${imageUrl}" alt="Image for ${value}">`;
                } else {
                    cell.textContent = value;
                    cell.style.backgroundColor = this.getBlockColor(value);
                    if (value < 3) {
                        cell.style.color = '#776e65';
                    }
                }
            } else {
                // For empty cells, ensure they don't block pointer events from reaching the parent.
                cell.style.pointerEvents = 'none';
            }
            item.appendChild(cell);
        }
        return item;
    }

    addDragHandlers(item) {
        item.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left-click
            e.preventDefault();
            this.handleDragStart(e, item);
        });
        item.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleDragStart(e.touches[0], item);
        }, { passive: false });
    }

    setupGlobalDragListeners() {
        document.addEventListener('mousemove', (e) => this.handleDragMove(e));
        document.addEventListener('touchmove', (e) => this.handleDragMove(e.touches[0]), { passive: false });
        
        document.addEventListener('mouseup', (e) => this.handleDragEnd(e));
        document.addEventListener('touchend', (e) => this.handleDragEnd(e.changedTouches[0]));
    }

    handleDragStart(e, item) {
        const playerDataStr = item.dataset.playerData;
        if (!playerDataStr) return;

        this.isDragging = true;
        this.dragStartData = {
            player: JSON.parse(playerDataStr),
            element: item,
            startX: e.clientX,
            startY: e.clientY
        };
        document.body.style.cursor = 'grabbing';
    }

    handleDragMove(e) {
        if (!this.isDragging) return;

        const startPos = { x: this.dragStartData.startX, y: this.dragStartData.startY };
        const currentPos = { x: e.clientX, y: e.clientY };
        this.updateDragLine(startPos, currentPos);

        document.querySelectorAll('.carousel-item').forEach(item => {
            item.classList.remove('dragging-over');
        });

        const dropTarget = this.getDropTarget(e.clientX, e.clientY);
        if (dropTarget && dropTarget !== this.dragStartData.element) {
            dropTarget.classList.add('dragging-over');
        }
    }

    handleDragEnd(e) {
        if (!this.isDragging) return;

        this.removeDragLine();
        document.body.style.cursor = 'default';
        document.querySelectorAll('.carousel-item, #game-board-wrapper').forEach(item => {
            item.classList.remove('dragging-over');
        });

        const dropTargetData = this.getDropTarget(e.clientX, e.clientY);
        
        if (dropTargetData) {
            const { type, element } = dropTargetData;
            
            if (type === 'carousel' && element !== this.dragStartData.element) {
                const endPlayerDataStr = element.dataset.playerData;
                if (endPlayerDataStr && this.onMergeRequest) {
                    const endPlayerData = JSON.parse(endPlayerDataStr);
                    // Prevent merging with self if somehow the same client ID appears twice
                    if (this.dragStartData.player.clientId !== endPlayerData.clientId) {
                        this.onMergeRequest(this.dragStartData.player, endPlayerData);
                    }
                }
            } else if (type === 'board') {
                const localPlayerState = this.getLocalPlayerState ? this.getLocalPlayerState() : null;
                if (localPlayerState && this.onMergeRequest) {
                    // Prevent merging your own game from the carousel with itself
                    if (this.dragStartData.player.clientId !== localPlayerState.clientId) {
                        this.onMergeRequest(this.dragStartData.player, localPlayerState);
                    }
                }
            }
        }
        
        this.isDragging = false;
        this.dragStartData = null;
    }

    getDropTarget(x, y) {
        let target = document.elementFromPoint(x, y);

        // Hide drag line so it doesn't interfere with elementFromPoint
        if (this.dragLine) this.dragLine.style.display = 'none';
        target = document.elementFromPoint(x, y);
        if (this.dragLine) this.dragLine.style.display = 'block';

        // Traverse up to find a valid drop target
        while (target) {
            if (target.classList.contains('carousel-item')) {
                // Ensure it's not an empty placeholder item
                if (target.dataset.playerData) {
                    return { type: 'carousel', element: target };
                }
                return null; // Dropped on an empty item
            }
            if (target.id === 'game-board-wrapper') {
                return { type: 'board', element: target };
            }
            target = target.parentElement;
        }
        return null; // No valid target found
    }
    
    updateDragLine(startPos, endPos) {
        if (!this.dragLine) {
            this.dragLine = document.createElement('div');
            this.dragLine.style.position = 'fixed';
            this.dragLine.style.background = '#e91e63'; // Hot pink for visibility
            this.dragLine.style.height = '5px';
            this.dragLine.style.borderRadius = '3px';
            this.dragLine.style.pointerEvents = 'none';
            this.dragLine.style.zIndex = '2000';
            this.dragLine.style.transformOrigin = 'left center';
            document.body.appendChild(this.dragLine);
        }

        const deltaX = endPos.x - startPos.x;
        const deltaY = endPos.y - startPos.y;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX);
        
        this.dragLine.style.width = distance + 'px';
        this.dragLine.style.left = startPos.x + 'px';
        this.dragLine.style.top = startPos.y + 'px';
        this.dragLine.style.transform = `rotate(${angle}rad)`;
    }

    removeDragLine() {
        if (this.dragLine) {
            this.dragLine.remove();
            this.dragLine = null;
        }
    }

    getBlockColor(value) {
        const colors = [
            '#eee4da', '#ede0c8', '#f2b179', '#f59563',
            '#f67c5f', '#f65e3b', '#edcf72', '#edcc61'
        ];
        return colors[value - 1] || '#3c3a32';
    }
}