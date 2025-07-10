// combinations-display.js
export class CombinationsDisplay {
    constructor(gameState) {
        this.gameState = gameState;
        this.combinationsList = document.getElementById('combinations-list');
    }

    update() {
        if (!this.combinationsList) return;

        this.combinationsList.innerHTML = '';
        const combinations = this.findCombinations();
        
        if (combinations.length === 0) {
            this.combinationsList.innerHTML = '<li>No merges available!</li>';
            return;
        }

        combinations.forEach(combo => {
            const li = document.createElement('li');
            
            const part1 = this.createComboPart(combo.v1);
            const plus = document.createElement('span');
            plus.textContent = '+';
            const part2 = this.createComboPart(combo.v2);
            const arrow = document.createElement('span');
            arrow.textContent = '→';

            li.appendChild(part1);
            li.appendChild(plus);
            li.appendChild(part2);
            li.appendChild(arrow);
            
            if (combo.type === 'merge') {
                const resultPart = this.createComboPart(combo.result);
                li.appendChild(resultPart);
            } else { // split
                const resultPart1 = this.createComboPart(combo.result);
                const resultPart2 = this.createComboPart(combo.result);
                const resultContainer = document.createElement('div');
                resultContainer.style.display = 'flex';
                resultContainer.style.gap = '4px';
                resultContainer.appendChild(resultPart1);
                resultContainer.appendChild(resultPart2);
                li.appendChild(resultContainer);
            }
            
            if (this.gameState.currentDifficulty === 'medium') {
                li.classList.add('no-hint');
            } else {
                li.addEventListener('click', () => this.findAndHighlightCombination(combo));
            }

            this.combinationsList.appendChild(li);
        });
    }

    createComboPart(value) {
        const part = document.createElement('div');
        part.classList.add('combo-part');
        
        const imageUrl = this.gameState.getImageForValue(value);
        if (this.gameState.theme && imageUrl && imageUrl !== 'loading') {
            part.innerHTML = `<img src="${imageUrl}" alt="Image for ${value}">`;
        } else {
            part.textContent = value;
            part.classList.add(`block-${value}`);
        }
        
        return part;
    }

    findAndHighlightCombination(combo) {
        const { boardState, gridSize } = this.gameState;
        const matchingPairs = [];

        for (let i = 0; i < boardState.length; i++) {
            if (boardState[i] === 0) continue;

            const neighbors = this.getNeighborIndices(i, gridSize);

            for (const j of neighbors) {
                if (boardState[j] === 0) continue;
                if (i >= j) continue;

                const v1 = boardState[i];
                const v2 = boardState[j];

                let match = false;
                if (combo.type === 'merge') {
                    // For merge, board values must match combo.v1
                    if (v1 === combo.v1 && v2 === combo.v1) {
                        match = true;
                    }
                } else { // split
                    const minV = Math.min(v1, v2);
                    const maxV = Math.max(v1, v2);
                    // For split, board values must match combo.v1 and combo.v2
                    if (minV === combo.v1 && maxV === combo.v2) {
                        match = true;
                    }
                }

                if (match) {
                    matchingPairs.push([i, j]);
                }
            }
        }

        if (matchingPairs.length > 0) {
            const randomIndex = Math.floor(Math.random() * matchingPairs.length);
            const pairToHighlight = matchingPairs[randomIndex];
            this.highlightBlocks(pairToHighlight);
        }
    }

    highlightBlocks(indices) {
        // Clear any existing highlights first
        document.querySelectorAll('.block.highlighted').forEach(b => b.classList.remove('highlighted'));

        indices.forEach(index => {
            const blockEl = document.querySelector(`.block[data-index="${index}"]`);
            if (blockEl) {
                blockEl.classList.add('highlighted');
                setTimeout(() => {
                    blockEl.classList.remove('highlighted');
                }, 1000); // Highlight for 1 second
            }
        });
    }

    findCombinations() {
        const combinations = [];
        const { boardState, gridSize } = this.gameState;
        const checkedPairs = new Set();

        for (let i = 0; i < boardState.length; i++) {
            if (boardState[i] === 0) continue;

            const neighbors = this.getNeighborIndices(i, gridSize);

            for (const j of neighbors) {
                if (boardState[j] === 0) continue;
                
                const pairKey = i < j ? `${i}-${j}` : `${j}-${i}`;
                if (checkedPairs.has(pairKey)) continue;
                checkedPairs.add(pairKey);

                const v1 = boardState[i];
                const v2 = boardState[j];

                if (v1 === v2) {
                    combinations.push({ type: 'merge', v1, v2, result: v1 + 1 });
                } else if ((v1 + v2) % 2 === 0) {
                    combinations.push({ type: 'split', v1: Math.min(v1, v2), v2: Math.max(v1, v2), result: (v1 + v2) / 2 });
                }
            }
        }

        // Filter out duplicate combination types
        const uniqueCombinations = [];
        const seenCombinations = new Set();

        for (const combo of combinations) {
            let key;
            if (combo.type === 'merge') {
                key = `merge-${combo.v1}`;
            } else { // split
                key = `split-${combo.v1}-${combo.v2}`;
            }

            if (!seenCombinations.has(key)) {
                seenCombinations.add(key);
                uniqueCombinations.push(combo);
            }
        }

        return uniqueCombinations;
    }

    getNeighborIndices(index, gridSize) {
        const neighbors = [];
        const row = Math.floor(index / gridSize);
        const col = index % gridSize;

        for (let r = -1; r <= 1; r++) {
            for (let c = -1; c <= 1; c++) {
                if (r === 0 && c === 0) continue;

                const newRow = row + r;
                const newCol = col + c;

                if (newRow >= 0 && newRow < gridSize && newCol >= 0 && newCol < gridSize) {
                    neighbors.push(newRow * gridSize + newCol);
                }
            }
        }
        return neighbors;
    }
}