// Tower Defense game mechanics
export class TowerDefenseManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.waveTimeout = null;
        this.waveCountdownInterval = null;
        this.countdownSeconds = 30;
        
        this.onGameOver = null;
        this.onWaveComplete = null;
        
        // Enemy wave configurations
        this.waveConfigs = [
            { enemies: [{ type: 'basic', count: 5, health: 20, speed: 1, reward: 10 }] },
            { enemies: [{ type: 'basic', count: 8, health: 30, speed: 1.2, reward: 10 }] },
            { enemies: [{ type: 'basic', count: 6, health: 40, speed: 1, reward: 15 }, { type: 'fast', count: 3, health: 20, speed: 2, reward: 20 }] },
            { enemies: [{ type: 'armored', count: 4, health: 100, speed: 0.8, reward: 30 }] },
            { enemies: [{ type: 'basic', count: 10, health: 50, speed: 1.5, reward: 15 }, { type: 'fast', count: 5, health: 30, speed: 2.5, reward: 25 }] }
        ];
    }
    
    initialize() {
        this.canvas = document.getElementById('tower-defense-canvas');
        if (!this.canvas) {
            console.error('Tower defense canvas not found');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        // Increase canvas size to accommodate the path padding
        this.canvas.width = 580;
        this.canvas.height = 580;
        
        this.render = Matter.Render.create({
            canvas: this.canvas,
            engine: this.engine,
            options: {
                width: 580,
                height: 580,
                wireframes: false,
                background: 'transparent',
                showAngleIndicator: false,
                showVelocity: false
            }
        });

        this.createHourglassStructure();
        this.createSandGrains(numGrains);
        
        Matter.Engine.run(this.engine);
        Matter.Render.run(this.render);
        
        this.startSandFallCheck();
    }
    
    initializePath() {
        this.path = [];
        const pathPadding = 40; // Distance from board edge
        const boardSize = 500; // From CSS
        const canvasOffset = 40; // Offset to center the board in the larger canvas
        
        // Create a rectangular path around the board
        const steps = 120;
        
        for (let i = 0; i < steps; i++) {
            const progress = i / steps;
            let x, y;
            
            if (progress < 0.25) {
                // Top edge (left to right)
                const edgeProgress = progress * 4;
                x = canvasOffset - pathPadding + (edgeProgress * (boardSize + pathPadding * 2));
                y = canvasOffset - pathPadding;
            } else if (progress < 0.5) {
                // Right edge (top to bottom)
                const edgeProgress = (progress - 0.25) * 4;
                x = canvasOffset + boardSize + pathPadding;
                y = canvasOffset - pathPadding + (edgeProgress * (boardSize + pathPadding * 2));
            } else if (progress < 0.75) {
                // Bottom edge (right to left)
                const edgeProgress = (progress - 0.5) * 4;
                x = canvasOffset + boardSize + pathPadding - (edgeProgress * (boardSize + pathPadding * 2));
                y = canvasOffset + boardSize + pathPadding;
            } else {
                // Left edge (bottom to top)
                const edgeProgress = (progress - 0.75) * 4;
                x = canvasOffset - pathPadding;
                y = canvasOffset + boardSize + pathPadding - (edgeProgress * (boardSize + pathPadding * 2));
            }
            
            this.path.push({ x, y });
        }
    }
    
    startWaveCountdown() {
        this.countdownSeconds = 30;
        this.updateCountdownDisplay();
        
        this.waveCountdownInterval = setInterval(() => {
            this.countdownSeconds--;
            this.updateCountdownDisplay();
            
            if (this.countdownSeconds <= 0) {
                this.startWave();
            }
        }, 1000);
    }
    
    updateCountdownDisplay() {
        const countdownSpan = document.getElementById('wave-countdown');
        if (countdownSpan) {
            countdownSpan.textContent = this.countdownSeconds;
        }
    }
    
    startWave() {
        if (this.gameState.waveInProgress) return;
        
        this.clearCountdown();
        this.gameState.currentWave++;
        this.gameState.waveInProgress = true;
        this.gameState.waveStartTime = Date.now();
        
        document.getElementById('wave').textContent = this.gameState.currentWave;
        
        // Generate enemy images for this wave
        this.generateEnemyImages();
        
        // Spawn enemies based on wave configuration
        this.spawnWaveEnemies();
        
        this.gameState.logEvent('wave_started', { wave: this.gameState.currentWave });
    }
    
    clearCountdown() {
        if (this.waveCountdownInterval) {
            clearInterval(this.waveCountdownInterval);
            this.waveCountdownInterval = null;
        }
        
        if (this.waveTimeout) {
            clearTimeout(this.waveTimeout);
            this.waveTimeout = null;
        }
    }
    
    async generateEnemyImages() {
        const waveConfig = this.waveConfigs[Math.min(this.gameState.currentWave - 1, this.waveConfigs.length - 1)];
        
        for (const enemyConfig of waveConfig.enemies) {
            if (!this.gameState.enemyImages[enemyConfig.type]) {
                this.gameState.enemyImages[enemyConfig.type] = 'loading';
                
                try {
                    const result = await websim.imageGen({
                        prompt: `A small ${enemyConfig.type} enemy creature for a tower defense game. Cute but menacing style. Top-down view. No background.`,
                        transparent: true,
                        aspect: "square"
                    });
                    this.gameState.enemyImages[enemyConfig.type] = result.url;
                } catch (error) {
                    console.error(`Failed to generate enemy image for ${enemyConfig.type}:`, error);
                    this.gameState.enemyImages[enemyConfig.type] = null;
                }
            }
        }
    }
    
    spawnWaveEnemies() {
        const waveConfig = this.waveConfigs[Math.min(this.gameState.currentWave - 1, this.waveConfigs.length - 1)];
        let delay = 0;
        
        for (const enemyConfig of waveConfig.enemies) {
            for (let i = 0; i < enemyConfig.count; i++) {
                setTimeout(() => {
                    this.gameState.spawnEnemy(
                        enemyConfig.type,
                        enemyConfig.health + (this.gameState.currentWave * 10),
                        enemyConfig.speed,
                        enemyConfig.reward
                    );
                }, delay);
                delay += 500; // 0.5 second between each enemy
            }
        }
    }
    
    startGameLoop() {
        const gameLoop = () => {
            this.updateGame();
            this.renderGame();
            this.animationId = requestAnimationFrame(gameLoop);
        };
        gameLoop();
    }
    
    updateGame() {
        const currentTime = Date.now();
        
        // Update enemy positions
        this.updateEnemies();
        
        // Update towers (firing)
        this.updateTowers(currentTime);
        
        // Update projectiles
        this.updateProjectiles();
        
        // Check wave completion
        if (this.gameState.waveInProgress && this.gameState.enemies.length === 0) {
            this.completeWave();
        }
    }
    
    updateEnemies() {
        const lapsToLose = this.gameState.GAME_CONFIG[this.gameState.currentDifficulty].lapsToLose;
        
        this.gameState.enemies.forEach(enemy => {
            // Move enemy along path
            enemy.pathProgress += enemy.speed * 0.008; // Slower movement for visibility
            
            if (enemy.pathProgress >= 1) {
                enemy.pathProgress = 0;
                enemy.pathIndex = (enemy.pathIndex + 1) % this.gameState.path.length;
                
                // Check if enemy completed a lap
                if (enemy.pathIndex === 0) {
                    enemy.laps++;
                    if (enemy.laps >= lapsToLose) {
                        // Enemy reached the end, player loses a life
                        this.gameState.removeEnemy(enemy.id);
                        const isGameOver = this.gameState.loseLife();
                        this.updateLivesDisplay();
                        
                        if (isGameOver && this.onGameOver) {
                            this.onGameOver();
                        }
                        return;
                    }
                }
            }
            
            // Interpolate position
            const currentPoint = this.gameState.path[enemy.pathIndex];
            const nextPoint = this.gameState.path[(enemy.pathIndex + 1) % this.gameState.path.length];
            
            enemy.x = currentPoint.x + (nextPoint.x - currentPoint.x) * enemy.pathProgress;
            enemy.y = currentPoint.y + (nextPoint.y - currentPoint.y) * enemy.pathProgress;
        });
    }
    
    updateTowers(currentTime) {
        Object.entries(this.gameState.towers).forEach(([index, tower]) => {
            const boardIndex = parseInt(index);
            const towerPos = this.getBoardPosition(boardIndex);
            
            // Find target
            let nearestEnemy = null;
            let nearestDistance = Infinity;
            
            this.gameState.enemies.forEach(enemy => {
                const distance = Math.sqrt(
                    Math.pow(enemy.x - towerPos.x, 2) + 
                    Math.pow(enemy.y - towerPos.y, 2)
                );
                
                if (distance <= tower.range && distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestEnemy = enemy;
                }
            });
            
            tower.target = nearestEnemy;
            
            // Fire at target
            if (tower.target && currentTime - tower.lastFired > tower.fireRate) {
                this.fireTower(tower, towerPos);
                tower.lastFired = currentTime;
            }
        });
    }
    
    fireTower(tower, towerPos) {
        if (!tower.target) return;
        
        const projectile = {
            x: towerPos.x,
            y: towerPos.y,
            targetX: tower.target.x,
            targetY: tower.target.y,
            targetId: tower.target.id,
            damage: tower.damage,
            speed: 5,
            life: 100 // Frames to live
        };
        
        tower.projectiles.push(projectile);
    }
    
    updateProjectiles() {
        Object.values(this.gameState.towers).forEach(tower => {
            tower.projectiles = tower.projectiles.filter(projectile => {
                // Move projectile
                const dx = projectile.targetX - projectile.x;
                const dy = projectile.targetY - projectile.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < projectile.speed) {
                    // Hit target
                    const target = this.gameState.enemies.find(e => e.id === projectile.targetId);
                    if (target) {
                        target.health -= projectile.damage;
                        if (target.health <= 0) {
                            this.gameState.updateScore(target.reward);
                            this.gameState.removeEnemy(target.id);
                            this.gameState.logEvent('enemy_killed', { type: target.type, reward: target.reward });
                        }
                    }
                    return false; // Remove projectile
                }
                
                // Move towards target
                projectile.x += (dx / distance) * projectile.speed;
                projectile.y += (dy / distance) * projectile.speed;
                
                projectile.life--;
                return projectile.life > 0;
            });
        });
    }
    
    getBoardPosition(boardIndex) {
        const row = Math.floor(boardIndex / this.gameState.gridSize);
        const col = boardIndex % this.gameState.gridSize;
        const cellSize = 500 / this.gameState.gridSize;
        const canvasOffset = 40; // Match the offset used in path creation
        
        return {
            x: canvasOffset + col * cellSize + cellSize / 2,
            y: canvasOffset + row * cellSize + cellSize / 2
        };
    }
    
    renderGame() {
        if (!this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw path
        this.drawPath();
        
        // Draw enemies
        this.drawEnemies();
        
        // Draw projectiles
        this.drawProjectiles();
        
        // Draw tower ranges (for selected tower)
        this.drawTowerRanges();
        
        // Draw tower firing effects
        this.drawTowerEffects();
    }
    
    drawPath() {
        if (this.gameState.path.length === 0) return;
        
        // Draw the path background
        this.ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)';
        this.ctx.lineWidth = 35;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.beginPath();
        
        this.gameState.path.forEach((point, index) => {
            if (index === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        
        this.ctx.closePath();
        this.ctx.stroke();
        
        // Draw the path center line
        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = 20;
        this.ctx.beginPath();
        
        this.gameState.path.forEach((point, index) => {
            if (index === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        
        this.ctx.closePath();
        this.ctx.stroke();
        
        // Draw path edges
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        
        this.gameState.path.forEach((point, index) => {
            if (index === 0) {
                this.ctx.moveTo(point.x, point.y);
            } else {
                this.ctx.lineTo(point.x, point.y);
            }
        });
        
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Reset line dash
    }
    
    drawEnemies() {
        this.gameState.enemies.forEach(enemy => {
            const imageUrl = this.gameState.enemyImages[enemy.type];
            
            // Draw enemy shadow
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.fillRect(enemy.x - 12, enemy.y - 8, 24, 16);
            
            if (imageUrl && imageUrl !== 'loading') {
                // TODO: Load and draw actual enemy image
                // For now, draw a styled enemy
                this.ctx.fillStyle = this.getEnemyColor(enemy.type);
            } else {
                this.ctx.fillStyle = this.getEnemyColor(enemy.type);
            }
            
            // Draw enemy body
            this.ctx.fillRect(enemy.x - 15, enemy.y - 15, 30, 30);
            
            // Draw enemy outline
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(enemy.x - 15, enemy.y - 15, 30, 30);
            
            // Draw health bar background
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(enemy.x - 20, enemy.y - 25, 40, 6);
            
            // Draw health bar
            const healthPercent = enemy.health / enemy.maxHealth;
            this.ctx.fillStyle = healthPercent > 0.6 ? '#00ff00' : healthPercent > 0.3 ? '#ffff00' : '#ff0000';
            this.ctx.fillRect(enemy.x - 20, enemy.y - 25, 40 * healthPercent, 6);
            
            // Draw health bar border
            this.ctx.strokeStyle = '#000';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(enemy.x - 20, enemy.y - 25, 40, 6);
        });
    }
    
    getEnemyColor(type) {
        const colors = {
            'basic': '#ff4444',
            'fast': '#44ff44',
            'armored': '#4444ff',
            'boss': '#ff44ff'
        };
        return colors[type] || '#ff0000';
    }
    
    drawProjectiles() {
        Object.values(this.gameState.towers).forEach(tower => {
            tower.projectiles.forEach(projectile => {
                // Draw projectile trail
                this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
                this.ctx.lineWidth = 3;
                this.ctx.lineCap = 'round';
                this.ctx.beginPath();
                this.ctx.moveTo(projectile.x - 2, projectile.y - 2);
                this.ctx.lineTo(projectile.x + 2, projectile.y + 2);
                this.ctx.stroke();
                
                // Draw projectile
                this.ctx.fillStyle = '#ffff00';
                this.ctx.fillRect(projectile.x - 4, projectile.y - 4, 8, 8);
                
                // Draw projectile glow
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.fillRect(projectile.x - 2, projectile.y - 2, 4, 4);
            });
        });
    }
    
    drawTowerEffects() {
        const currentTime = Date.now();
        
        Object.entries(this.gameState.towers).forEach(([index, tower]) => {
            const boardIndex = parseInt(index);
            const towerPos = this.getBoardPosition(boardIndex);
            
            // Draw firing effect if tower recently fired
            const timeSinceFired = currentTime - tower.lastFired;
            if (timeSinceFired < 200) { // Show effect for 200ms
                const intensity = 1 - (timeSinceFired / 200);
                
                // Draw muzzle flash
                this.ctx.fillStyle = `rgba(255, 255, 0, ${intensity * 0.8})`;
                this.ctx.beginPath();
                this.ctx.arc(towerPos.x, towerPos.y, 15 * intensity, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Draw firing line to target
                if (tower.target) {
                    this.ctx.strokeStyle = `rgba(255, 0, 0, ${intensity * 0.6})`;
                    this.ctx.lineWidth = 3 * intensity;
                    this.ctx.beginPath();
                    this.ctx.moveTo(towerPos.x, towerPos.y);
                    this.ctx.lineTo(tower.target.x, tower.target.y);
                    this.ctx.stroke();
                }
            }
        });
    }
    
    drawTowerRanges() {
        const selectedIndex = this.gameState.getSelectedBlockIndex();
        if (selectedIndex !== -1 && this.gameState.towers[selectedIndex]) {
            const tower = this.gameState.towers[selectedIndex];
            const towerPos = this.getBoardPosition(selectedIndex);
            
            this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(towerPos.x, towerPos.y, tower.range, 0, Math.PI * 2);
            this.ctx.stroke();
        }
    }
    
    completeWave() {
        this.gameState.waveInProgress = false;
        this.gameState.logEvent('wave_completed', { wave: this.gameState.currentWave });
        
        // Start countdown for next wave
        this.startWaveCountdown();
        
        if (this.onWaveComplete) {
            this.onWaveComplete();
        }
    }
    
    updateLivesDisplay() {
        const livesSpan = document.getElementById('lives');
        if (livesSpan) {
            livesSpan.textContent = this.gameState.lives === -1 ? '∞' : this.gameState.lives;
        }
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.clearCountdown();
    }
}