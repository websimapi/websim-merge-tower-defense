// Hourglass physics simulation module
export class HourglassManager {
    constructor(gameState) {
        this.gameState = gameState;
        this.engine = null;
        this.world = null;
        this.sandGrains = [];
        this.canvas = null;
        this.render = null;
        this.checkInterval = null;
        this.onSandFallComplete = null;
        this.onProgressUpdate = null;
    }
    
    create(numGrains, onSandFallComplete, onProgressUpdate) {
        this.onSandFallComplete = onSandFallComplete;
        this.onProgressUpdate = onProgressUpdate;
        this.canvas = document.getElementById('hourglass-canvas');
        this.engine = Matter.Engine.create();
        this.world = this.engine.world;
        
        // Set gravity based on difficulty
        const difficulty = this.gameState.currentDifficulty;
        if (difficulty === 'easy' || difficulty === 'zen') {
            this.engine.world.gravity.y = 0.025;
        } else if (difficulty === 'medium') {
            this.engine.world.gravity.y = 0.167;
        } else {
            this.engine.world.gravity.y = 0.233;
        }
        
        this.canvas.width = 150;
        this.canvas.height = 250;
        
        this.render = Matter.Render.create({
            canvas: this.canvas,
            engine: this.engine,
            options: {
                width: 150,
                height: 250,
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
    
    createHourglassStructure() {
        const wallThickness = 5;
        const centerX = 75;
        const centerY = 125;
        
        const walls = [
            // Outer walls
            Matter.Bodies.rectangle(centerX, 12, 125, wallThickness, { 
                isStatic: true, 
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            Matter.Bodies.rectangle(centerX, 238, 125, wallThickness, { 
                isStatic: true, 
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            Matter.Bodies.rectangle(12, centerY, wallThickness, 250, { 
                isStatic: true, 
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            Matter.Bodies.rectangle(138, centerY, wallThickness, 250, { 
                isStatic: true, 
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            // Top funnel
            Matter.Bodies.rectangle(37, 94, 75, wallThickness, { 
                isStatic: true, 
                angle: Math.PI / 6,
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            Matter.Bodies.rectangle(113, 94, 75, wallThickness, { 
                isStatic: true, 
                angle: -Math.PI / 6,
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            // Bottom funnel
            Matter.Bodies.rectangle(37, 156, 75, wallThickness, { 
                isStatic: true, 
                angle: -Math.PI / 6,
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            Matter.Bodies.rectangle(113, 156, 75, wallThickness, { 
                isStatic: true, 
                angle: Math.PI / 6,
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1
            }),
            // Center opening
            Matter.Bodies.rectangle(69, centerY, wallThickness, 30, { 
                isStatic: true, 
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1,
                chamfer: { radius: 2 }
            }),
            Matter.Bodies.rectangle(81, centerY, wallThickness, 30, { 
                isStatic: true, 
                render: { fillStyle: '#8B4513' },
                friction: 0.1,
                frictionStatic: 0.1,
                chamfer: { radius: 2 }
            })
        ];

        Matter.World.add(this.world, walls);
    }
    
    createSandGrains(numGrains) {
        this.sandGrains = [];
        for (let i = 0; i < numGrains; i++) {
            const grain = Matter.Bodies.circle(
                31 + Math.random() * 88, 
                31 + Math.random() * 50, 
                3,
                {
                    render: { fillStyle: '#F4A460' },
                    restitution: 0.3,
                    friction: 0.3,
                    frictionAir: 0.01,
                    collisionFilter: { group: -1 },
                    chamfer: { radius: 1 }
                }
            );
            this.sandGrains.push(grain);
            Matter.World.add(this.world, grain);
        }
    }
    
    startSandFallCheck() {
        this.checkInterval = setInterval(() => {
            if (!this.engine) {
                clearInterval(this.checkInterval);
                return;
            }

            const bottomGrains = this.sandGrains.filter(grain => grain.position.y > 175);
            
            if (this.onProgressUpdate && this.sandGrains.length > 0) {
                const progress = bottomGrains.length / this.sandGrains.length;
                this.onProgressUpdate(progress);
            }
            
            if (bottomGrains.length === this.sandGrains.length) {
                if (this.onSandFallComplete) {
                    this.onSandFallComplete();
                }
                this.reset();
            }
        }, 100);
    }
    
    reset() {
        if (!this.world) return;

        this.sandGrains.forEach(grain => {
            Matter.World.remove(this.world, grain);
        });

        const config = this.gameState.GAME_CONFIG[this.gameState.currentDifficulty];
        this.createSandGrains(config.sandGrains);
        
        this.checkInterval = null;
    }
    
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        if (this.render) {
            Matter.Render.stop(this.render);
            this.render = null;
        }
        
        if (this.engine) {
            Matter.Engine.clear(this.engine);
            this.engine = null;
        }
        
        this.world = null;
        this.sandGrains = [];
        this.onProgressUpdate = null;
    }
}