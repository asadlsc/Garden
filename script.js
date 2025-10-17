// --- GAME CONSTANTS ---

// Plant Data: Cost, Value, and Growth Time in days
const PLANT_DATA = [
    { id: 'tomato', name: 'Tomato', cost: 5, value: 15, growthTime: 3, emoji: '🍅' },
    { id: 'carrot', name: 'Carrot', cost: 10, value: 35, growthTime: 4, emoji: '🥕' },
    { id: 'melon', name: 'Melon', cost: 25, value: 80, growthTime: 5, emoji: '🍉' },
];
// Map for quick lookup
const PLANT_MAP = PLANT_DATA.reduce((map, plant) => {
    map[plant.id] = plant;
    return map;
}, {});

// --- NEW CONSTANTS FOR TIME / COST ---
// Day duration changed from 10 minutes (600000ms) to 2 minutes (120000ms)
const CYCLE_DURATION_MS = 120000; // 2 minutes
// Day theme duration is half the cycle: 1 minute (60000ms)
const DAY_DURATION_MS = 60000; 
const TIME_TICK_MS = 1000; 
const SKIP_DAY_COST = 100; 
const EXPANSION_COST = 1000; 

// --- GAME STATE ---
let gameState = {
    money: 50,
    day: 1,
    grid: [],
    gridSideLength: 3, // Initial grid size (3x3)
    currentSeedId: 'tomato', 
    currentCycleTime: 0, 
    dayCycleInterval: null,
};

// --- DOM ELEMENTS ---
const gardenGridEl = document.getElementById('gardenGrid');
const moneyDisplayEl = document.getElementById('moneyDisplay');
const dayDisplayEl = document.getElementById('dayDisplay');
const plotsDisplayEl = document.getElementById('plotsDisplay');
const messageBoxEl = document.getElementById('messageBox');
const modalEl = document.getElementById('modal');
const modalTitleEl = document.getElementById('modalTitle');
const modalMessageEl = document.getElementById('modalMessage');
const modalCloseButtonEl = document.getElementById('modalCloseButton');
const seedSelectorEl = document.getElementById('seedSelector'); // Updated reference
const currentSeedNameEl = document.getElementById('currentSeedName');

const skipDayButtonEl = document.getElementById('skipDayButton');
const expandMapButtonEl = document.getElementById('expandMapButton');
const timeBarProgressEl = document.getElementById('timeBarProgress');


// --- UTILITY FUNCTIONS ---

/**
 * Shows a non-blocking message box with a temporary message.
 */
function showMessage(message, type = 'info') {
    let bgColor, textColor;
    switch (type) {
        case 'success':
            bgColor = '#e8f5e9'; textColor = '#2E7D32'; break;
        case 'error':
            bgColor = '#ffebee'; textColor = '#C62828'; break;
        case 'info':
        default:
            bgColor = '#fff3e0'; textColor = '#E65100'; break;
    }
    messageBoxEl.style.backgroundColor = bgColor;
    messageBoxEl.style.color = textColor;
    messageBoxEl.textContent = message;

    setTimeout(() => {
        messageBoxEl.style.backgroundColor = '#fff3e0';
        messageBoxEl.style.color = '#E65100';
        messageBoxEl.textContent = 'Ready to grow!';
    }, 3000);
}

/**
 * Shows a modal dialog for important messages (like harvest).
 */
function showModal(title, message) {
    modalTitleEl.textContent = title;
    modalMessageEl.textContent = message;
    modalEl.style.display = 'flex';
}

// --- SHOP LOGIC ---

/**
 * Initializes the seed shop dropdown.
 */
function initializeShop() {
    seedSelectorEl.innerHTML = ''; // Clear existing options

    PLANT_DATA.forEach(plant => {
        const option = document.createElement('option');
        option.value = plant.id;
        // The text now includes cost and growth time
        option.textContent = `${plant.emoji} ${plant.name} (\$${plant.cost} | Grow: ${plant.growthTime}d)`;
        option.dataset.cost = plant.cost;
        seedSelectorEl.appendChild(option);
    });

    // Set initial selection and add listener
    seedSelectorEl.value = gameState.currentSeedId;
    // Listen for changes on the dropdown
    seedSelectorEl.addEventListener('change', (event) => selectSeed(event.target.value));
    
    // Ensure the initial state is selected and displayed
    selectSeed(gameState.currentSeedId);
}

/**
 * Sets the currently selected seed for planting.
 */
function selectSeed(seedId) {
    gameState.currentSeedId = seedId;
    const selectedPlant = PLANT_MAP[seedId];

    // Ensure the dropdown reflects the selected state
    if (seedSelectorEl.value !== seedId) {
        seedSelectorEl.value = seedId;
    }
    
    // Update money requirement status
    const canAfford = gameState.money >= selectedPlant.cost;
    if (!canAfford) {
        seedSelectorEl.classList.add('border-red-500');
        seedSelectorEl.classList.remove('border-green-500');
    } else {
         seedSelectorEl.classList.remove('border-red-500');
        seedSelectorEl.classList.add('border-green-500');
    }

    currentSeedNameEl.textContent = selectedPlant.name;
    showMessage(`Selected ${selectedPlant.name} seeds. Click a plot to plant!`);
    render();
}

// --- AUTOMATIC TIME CYCLE LOGIC ---

/**
 * Converts milliseconds to MM:SS string.
 */
function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Handles time progression, theme switching, and automatic day advance.
 */
function updateTimeCycle() {
    gameState.currentCycleTime += TIME_TICK_MS;
    
    // Correct overflow if timer runs past the cycle duration (e.g., after skipDay)
    if (gameState.currentCycleTime > CYCLE_DURATION_MS) {
         gameState.currentCycleTime = CYCLE_DURATION_MS;
    }

    // Calculate progress percentage
    const progress = (gameState.currentCycleTime / CYCLE_DURATION_MS) * 100;
    timeBarProgressEl.style.width = `${progress}%`;
    
    const isNight = gameState.currentCycleTime >= DAY_DURATION_MS;

    // Calculate remaining time
    const timeRemaining = CYCLE_DURATION_MS - gameState.currentCycleTime;
    timeBarProgressEl.setAttribute('data-time', formatTime(timeRemaining));

    // Handle Day/Night Theme Switch
    document.body.classList.toggle('theme-night', isNight);
    document.body.classList.toggle('theme-day', !isNight);
    timeBarProgressEl.dataset.theme = isNight ? 'night' : 'day';

    // Check for cycle completion
    if (gameState.currentCycleTime >= CYCLE_DURATION_MS) {
        clearInterval(gameState.dayCycleInterval);
        advanceDay(false); // Normal advance
        startDayCycle();
    }
}

/**
 * Starts the automatic time cycle interval.
 */
function startDayCycle() {
    gameState.currentCycleTime = 0;
    updateTimeCycle(); // Set initial state immediately
    
    // Start the 1-second tick
    gameState.dayCycleInterval = setInterval(updateTimeCycle, TIME_TICK_MS);
}

/**
 * Stops the cycle and forces an immediate day advance, if the user has enough money.
 */
function skipDay() {
    if (gameState.money >= SKIP_DAY_COST) {
        gameState.money -= SKIP_DAY_COST; // Deduct cost
        clearInterval(gameState.dayCycleInterval);
        showMessage(`Skipped day immediately! Spent \$${SKIP_DAY_COST}.`, 'success');
        advanceDay(true); // true means force advance
        startDayCycle();
    } else {
        showMessage(`You need \$${SKIP_DAY_COST} to skip the day!`, 'error');
    }
    render(); // Always re-render to update money display
}

// --- MAP EXPANSION LOGIC ---

/**
 * Doubles the grid size, preserves existing plots, and re-initializes the DOM.
 */
function expandMap() {
    if (gameState.money < EXPANSION_COST) {
        showMessage(`Map expansion costs \$${EXPANSION_COST}! You need more money.`, 'error');
        return;
    }
    
    // Hardcoded limit to keep the game playable on a small screen
    if (gameState.gridSideLength >= 12) {
        showMessage('The garden is already massive! Cannot expand further.', 'error');
        return;
    }

    gameState.money -= EXPANSION_COST;
    const oldSize = gameState.gridSideLength;
    const newSize = oldSize * 2;
    gameState.gridSideLength = newSize;

    // 1. Create the new, larger grid array structure
    const newGrid = [];
    for (let r = 0; r < newSize; r++) {
        newGrid[r] = [];
        for (let c = 0; c < newSize; c++) {
            
            // Check if this new coordinate was part of the old grid
            if (r < oldSize && c < oldSize) {
                // Preserve existing plot data
                newGrid[r][c] = gameState.grid[r][c];
            } else {
                // Initialize new plots as empty
                newGrid[r][c] = {
                    state: 'EMPTY',
                    growthProgress: 0,
                    isWatered: false,
                    plantId: null,
                    maxGrowth: null,
                    harvestValue: null,
                };
            }
        }
    }

    // 2. Replace the old grid with the new one
    gameState.grid = newGrid;

    // 3. Re-initialize and re-render the entire DOM grid
    initializeGridDOM();
    
    showMessage(`Map expanded to ${newSize}x${newSize}! Plots are smaller but you have more space. -\$${EXPANSION_COST}`, 'success');
    render();
}


// --- CORE GAME LOGIC ---

/**
 * Creates and attaches all plot DOM elements to the grid container, 
 * setting the dynamic CSS grid columns.
 */
function initializeGridDOM() {
    gardenGridEl.innerHTML = ''; // Clear old DOM elements

    // Set dynamic CSS grid columns to make plots smaller
    gardenGridEl.style.gridTemplateColumns = `repeat(${gameState.gridSideLength}, 1fr)`;
    
    for (let r = 0; r < gameState.gridSideLength; r++) {
        // Ensure the state array structure is complete
        if (!gameState.grid[r]) gameState.grid[r] = [];

        for (let c = 0; c < gameState.gridSideLength; c++) {
            
            // If a new plot, ensure state is initialized (important for first run)
            if (!gameState.grid[r][c]) {
                 gameState.grid[r][c] = {
                    state: 'EMPTY',
                    growthProgress: 0,
                    isWatered: false,
                    plantId: null,
                    maxGrowth: null,
                    harvestValue: null,
                };
            }

            // Create DOM element for the plot
            const plotEl = document.createElement('div');
            plotEl.id = `plot-${r}-${c}`;
            plotEl.className = 'plot';
            plotEl.dataset.row = r;
            plotEl.dataset.col = c;

            plotEl.addEventListener('click', () => handlePlotClick(r, c));
            gardenGridEl.appendChild(plotEl);
        }
    }
}


/**
 * Renders the game state to the DOM.
 */
function render() {
    const sideLength = gameState.gridSideLength;
    const totalPlots = sideLength * sideLength;

    // Update stats
    moneyDisplayEl.textContent = `\$${gameState.money}`;
    dayDisplayEl.textContent = gameState.day;
    
    const plantedPlots = gameState.grid.flat().filter(p => p.state !== 'EMPTY').length;
    plotsDisplayEl.textContent = `${plantedPlots}/${totalPlots}`;

    // Update grid appearance
    for (let r = 0; r < sideLength; r++) {
        for (let c = 0; c < sideLength; c++) {
            const plot = gameState.grid[r][c];
            const plotEl = document.getElementById(`plot-${r}-${c}`);
            if (!plotEl) continue; // Skip if element doesn't exist (shouldn't happen after initGridDOM)

            const plantInfo = plot.plantId ? PLANT_MAP[plot.plantId] : null;

            plotEl.dataset.state = plot.state;
            plotEl.dataset.growth = plot.growthProgress;
            
            // Clear existing icons
            plotEl.innerHTML = '';

            let emoji = '';
            let needsWater = false;
            
            if (plot.state !== 'EMPTY' && plantInfo) {
                
                if (plot.state === 'MATURE') {
                    emoji = plantInfo.emoji;
                    plotEl.dataset.state = 'MATURE';
                } else if (plot.growthProgress === 0) {
                    emoji = '🌱'; // Seed
                    needsWater = !plot.isWatered;
                } else if (plot.growthProgress > 0 && plot.growthProgress < plot.maxGrowth) {
                    emoji = plot.growthProgress < Math.floor(plot.maxGrowth / 2) ? '🌿' : '🌳'; 
                    needsWater = !plot.isWatered;
                    plotEl.dataset.state = 'GROWING';
                }

                // Display Plant Info / Status on the plot for visual feedback
                const contentEl = document.createElement('div');
                contentEl.className = 'plot-content';
                contentEl.innerHTML = `<span class="text-3xl">${emoji}</span><br><span class="text-xs font-semibold">(${plantInfo.name})</span>`;
                plotEl.appendChild(contentEl);

                // Add water icon if needed
                if (needsWater) {
                    const waterIcon = document.createElement('div');
                    waterIcon.className = 'water-icon';
                    waterIcon.textContent = '💧';
                    plotEl.appendChild(waterIcon);
                }
            }
        }
    }
    
    // Update money requirement styling on the dropdown
    const selectedPlant = PLANT_MAP[gameState.currentSeedId];
    const canAfford = gameState.money >= selectedPlant.cost;

    if (canAfford) {
        seedSelectorEl.classList.remove('border-red-500');
        seedSelectorEl.classList.add('border-green-500');
    } else {
        seedSelectorEl.classList.add('border-red-500');
        seedSelectorEl.classList.remove('border-green-500');
    }

    // Update Skip Day button status
    skipDayButtonEl.disabled = gameState.money < SKIP_DAY_COST;
    skipDayButtonEl.classList.toggle('opacity-50', gameState.money < SKIP_DAY_COST);
    skipDayButtonEl.classList.toggle('cursor-not-allowed', gameState.money < SKIP_DAY_COST);
    
    // Update Expand Map button status
    expandMapButtonEl.disabled = gameState.money < EXPANSION_COST;
    expandMapButtonEl.classList.toggle('opacity-50', gameState.money < EXPANSION_COST);
    expandMapButtonEl.classList.toggle('cursor-not-allowed', gameState.money < EXPANSION_COST);
}

/**
 * Handles the logic when a plot is clicked (Plant, Water, Harvest).
 */
function handlePlotClick(r, c) {
    // Parse r and c as integers since they come from event data
    r = parseInt(r); 
    c = parseInt(c); 
    
    const plot = gameState.grid[r][c];
    const currentPlantId = gameState.currentSeedId;
    const plantToBuy = PLANT_MAP[currentPlantId];

    if (plot.state === 'EMPTY') {
        // ACTION: PLANT
        if (gameState.money >= plantToBuy.cost) {
            gameState.money -= plantToBuy.cost;
            plot.state = 'SEED';
            plot.growthProgress = 0;
            plot.isWatered = false;
            
            // Store plant-specific data
            plot.plantId = currentPlantId; 
            plot.maxGrowth = plantToBuy.growthTime;
            plot.harvestValue = plantToBuy.value;

            showMessage(`Planted a ${plantToBuy.name} seed! -\$${plantToBuy.cost}`, 'success');
        } else {
            showMessage(`You need \$${plantToBuy.cost} to plant ${plantToBuy.name}!`, 'error');
        }
    } else if (plot.state === 'MATURE') {
        // ACTION: HARVEST
        const harvestedValue = plot.harvestValue;
        const plantName = PLANT_MAP[plot.plantId].name;

        gameState.money += harvestedValue;
        
        // Reset plot state
        plot.state = 'EMPTY';
        plot.growthProgress = 0;
        plot.isWatered = false;
        plot.plantId = null; 
        plot.maxGrowth = null;
        plot.harvestValue = null;

        showModal(`Harvest Successful!`, `You sold your mature ${plantName} for \$${harvestedValue}! Keep expanding your farm!`);
        showMessage(`Harvested ${plantName}! +$${harvestedValue}`, 'success');
    } else if (plot.state === 'SEED' || plot.state === 'GROWING') {
        // ACTION: WATER
        if (!plot.isWatered) {
            plot.isWatered = true;
            const plantName = PLANT_MAP[plot.plantId].name;
            showMessage(`Watered the ${plantName}! It needs water every day to grow.`, 'info');
        } else {
            showMessage('This plant is already sufficiently watered for the day.', 'info');
        }
    }
    render();
}

/**
 * Advances the game time by one day.
 * @param {boolean} forced - True if the day was skipped manually.
 */
function advanceDay(forced = false) {
    let plotsGrown = 0;

    gameState.day++;

    gameState.grid.forEach(row => {
        row.forEach(plot => {
            if (plot.state !== 'EMPTY' && plot.state !== 'MATURE') {
                
                if (plot.isWatered) {
                    // Successful growth
                    plot.growthProgress++;
                    
                    if (plot.growthProgress >= plot.maxGrowth) { 
                        plot.state = 'MATURE';
                        const plantName = PLANT_MAP[plot.plantId].name;
                        showMessage(`A ${plantName} has matured! Time to harvest!`, 'success');
                    } else {
                        plot.state = 'GROWING';
                    }
                    plotsGrown++;
                }
                // Reset water status for the new day
                plot.isWatered = false;
            }
        });
    });

    if (plotsGrown > 0) {
        showMessage(`Day ${gameState.day}: ${plotsGrown} plants grew!`, 'success');
    } else if (gameState.grid.flat().filter(p => p.state !== 'EMPTY').length > 0) {
         showMessage(`Day ${gameState.day}: No plants grew! Remember to water them!`, 'error');
    } else {
        showMessage(`Day ${gameState.day}: The sun shines on your garden.`, 'info');
    }

    render();
}

/**
 * Initializes the game state and DOM structure.
 */
function initializeGame() {
    // 1. Setup Grid State and DOM
    initializeGridDOM();

    // 2. Setup Controls and Shop
    skipDayButtonEl.addEventListener('click', skipDay);
    expandMapButtonEl.addEventListener('click', expandMap); // New event listener
    modalCloseButtonEl.addEventListener('click', () => { modalEl.style.display = 'none'; });
    
    initializeShop();
    
    // 3. Start automatic cycle
    startDayCycle(); 
    
    // 4. Initial Render
    render();
}

// Start the game when the window loads
window.onload = initializeGame;
