// Game state management module
export class GameState {
    constructor() {
        this.GAME_CONFIG = {
            easy: { gridSize: 4, initialBlocks: 2, sandGrains: 15, lives: 5, lapsToLose: 3 },
            medium: { gridSize: 5, initialBlocks: 5, sandGrains: 20, lives: 3, lapsToLose: 2 },
            hard: { gridSize: 6, initialBlocks: 6, sandGrains: 25, lives: 1, lapsToLose: 1 },
            zen: { gridSize: 4, initialBlocks: 2, sandGrains: 15, lives: -1, lapsToLose: 3 }
        };
        
        this.reset();
    }
    
    reset() {
        this.gridSize = 0;
        this.boardState = [];
        this.score = 0;
        this.selectedBlockIndex = -1;
        this.currentDifficulty = 'easy';
        this.theme = null;
        this.blockImages = {};
        this.nextSpawnIndices = [];
        this.eventLog = [];
        
        // Tower Defense elements
        this.towers = {}; // Map of board index to tower data
        this.towerImages = {}; // Map of tower level to image URL
        this.towerAbilities = {}; // Map of tower level to ability description
        this.enemies = []; // Array of enemy objects
        this.enemyImages = {}; // Map of enemy type to image URL
        this.currentWave = 0;
        this.lives = 5;
        this.waveInProgress = false;
        this.waveStartTime = null;
        this.path = []; // Array of coordinates for enemy path
        this.enemyIdCounter = 0;
    }
    
    initializeGame(difficulty, theme) {
        this.currentDifficulty = difficulty;
        this.theme = theme;
        this.eventLog = [];
        this.logEvent('game_start', { difficulty, theme });
        
        const config = this.GAME_CONFIG[difficulty];
        this.gridSize = config.gridSize;
        this.lives = config.lives;
        this.score = 0;
        this.selectedBlockIndex = -1;
        this.boardState = new Array(this.gridSize * this.gridSize).fill(0);
        this.nextSpawnIndices = [];
        this.towers = {};
        this.towerImages = {};
        this.towerAbilities = {};
        this.enemies = [];
        this.enemyImages = {};
        this.currentWave = 0;
        this.waveInProgress = false;
        this.waveStartTime = null;
        this.enemyIdCounter = 0;
        
        // Initialize path around the board
        this.initializePath();
        
        // Preserve pre-loaded images if they exist
        if (Object.keys(this.blockImages).length === 0) {
            this.blockImages = {};
        }
        
        return config;
    }
    
    initializePath() {
        this.path = [];
        const pathPadding = 40; // Distance from board edge
        const boardSize = 500; // From CSS
        const pathWidth = boardSize + (pathPadding * 2);
        const pathHeight = boardSize + (pathPadding * 2);
        
        // Create a rectangular path around the board
        const steps = 100;
        const perimeter = (pathWidth + pathHeight) * 2;
        const stepSize = perimeter / steps;
        
        for (let i = 0; i < steps; i++) {
            const progress = i / steps;
            let x, y;
            
            if (progress < 0.25) {
                // Top edge
                const edgeProgress = progress * 4;
                x = -pathPadding + (edgeProgress * pathWidth);
                y = -pathPadding;
            } else if (progress < 0.5) {
                // Right edge
                const edgeProgress = (progress - 0.25) * 4;
                x = boardSize + pathPadding;
                y = -pathPadding + (edgeProgress * pathHeight);
            } else if (progress < 0.75) {
                // Bottom edge
                const edgeProgress = (progress - 0.5) * 4;
                x = boardSize + pathPadding - (edgeProgress * pathWidth);
                y = boardSize + pathPadding;
            } else {
                // Left edge
                const edgeProgress = (progress - 0.75) * 4;
                x = -pathPadding;
                y = boardSize + pathPadding - (edgeProgress * pathHeight);
            }
            
            this.path.push({ x, y });
        }
    }
    
    getNewBlockValue() {
        const rand = Math.random();

        if (this.score < 100) {
            return 1;
        } else if (this.score < 500) {
            return rand < 0.8 ? 1 : 2;
        } else if (this.score < 1500) {
            if (rand < 0.6) return 1;
            if (rand < 0.9) return 2;
            return 3;
        } else if (this.score < 3000) {
            if (rand < 0.40) return 1;
            if (rand < 0.75) return 2;
            if (rand < 0.95) return 3;
            return 4;
        } else {
            if (rand < 0.20) return 1;
            if (rand < 0.50) return 2;
            if (rand < 0.80) return 3;
            if (rand < 0.95) return 4;
            return 5;
        }
    }
    
    areNeighbors(index1, index2) {
        const row1 = Math.floor(index1 / this.gridSize);
        const col1 = index1 % this.gridSize;
        const row2 = Math.floor(index2 / this.gridSize);
        const col2 = index2 % this.gridSize;

        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);

        return rowDiff <= 1 && colDiff <= 1 && (rowDiff + colDiff > 0);
    }
    
    getEmptyCells() {
        const emptyCells = [];
        for (let i = 0; i < this.boardState.length; i++) {
            if (this.boardState[i] === 0) {
                emptyCells.push(i);
            }
        }
        return emptyCells;
    }
    
    updateScore(points) {
        this.score += points;
        document.getElementById('score').textContent = this.score;
    }
    
    selectBlock(index) {
        this.selectedBlockIndex = index;
    }
    
    deselectBlock() {
        this.selectedBlockIndex = -1;
    }
    
    placeBlock(index, value) {
        this.boardState[index] = value;
        // When a block is placed, it becomes a tower
        this.createTower(index, value);
    }
    
    removeBlock(index) {
        this.boardState[index] = 0;
    }
    
    getBlockValue(index) {
        return this.boardState[index];
    }
    
    isBlockSelected(index) {
        return this.selectedBlockIndex === index;
    }
    
    hasSelectedBlock() {
        return this.selectedBlockIndex !== -1;
    }
    
    getSelectedBlockIndex() {
        return this.selectedBlockIndex;
    }
    
    createTower(index, level) {
        this.towers[index] = {
            level,
            lastFired: 0,
            target: null,
            range: 80 + (level * 20),
            damage: level * 10,
            fireRate: Math.max(500 - (level * 50), 100), // Faster fire rate for higher levels
            projectiles: []
        };
        
        this.logEvent('tower_built', { index, level });
    }
    
    removeTower(index) {
        delete this.towers[index];
    }
    
    spawnEnemy(type, health, speed, reward) {
        const enemy = {
            id: this.enemyIdCounter++,
            type,
            health,
            maxHealth: health,
            speed,
            reward,
            pathIndex: 0,
            pathProgress: 0,
            x: this.path[0].x,
            y: this.path[0].y,
            laps: 0
        };
        
        this.enemies.push(enemy);
        this.logEvent('enemy_spawned', { type, health, speed, reward });
        return enemy;
    }
    
    removeEnemy(enemyId) {
        const index = this.enemies.findIndex(e => e.id === enemyId);
        if (index !== -1) {
            this.enemies.splice(index, 1);
        }
    }
    
    loseLife() {
        if (this.lives > 0) {
            this.lives--;
            this.logEvent('life_lost', { remaining: this.lives });
            return this.lives <= 0;
        }
        return false;
    }
    
    logEvent(type, data) {
        this.eventLog.push({
            type,
            data,
            timestamp: new Date().toISOString()
        });
    }

    getImageForValue(value) {
        return this.blockImages[value];
    }

    setImageForValue(value, url) {
        this.blockImages[value] = url;
    }
}