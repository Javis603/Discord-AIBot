const Player = require('./Player');
const Territory = require('./Territory');
const boardData = require('./board.json');

class Game {
    constructor() {
        this.players = [];
        this.territories = new Map();
        this.continents = new Map();

        boardData.continents.forEach(continentData => {
            this.continents.set(continentData.id, {
                name: continentData.name,
                bonus_armies: continentData.bonus_armies,
                territories: []
            });
        });

        boardData.territories.forEach(territoryData => {
            const territory = new Territory(territoryData.name, territoryData.continent, territoryData.neighbors);
            this.territories.set(territoryData.id, territory);
            this.continents.get(territoryData.continent).territories.push(territoryData.id);
        });

        this.turn = 0;
        this.phase = 'setup'; // 'setup', 'deployment', 'attack', 'fortification'
    }

    addPlayer(playerId) {
        const player = new Player(playerId);
        this.players.push(player);
        player.troopsToDeploy = this.getInitialTroops(this.players.length);
        return player;
    }

    getInitialTroops(numPlayers) {
        switch (numPlayers) {
            case 2: return 40;
            case 3: return 35;
            case 4: return 30;
            case 5: return 25;
            case 6: return 20;
            default: return 0;
        }
    }

    setup() {
        // Assign territories to players
        const territoryIds = Array.from(this.territories.keys());
        this.shuffleArray(territoryIds);

        let playerIndex = 0;
        for (const territoryId of territoryIds) {
            const territory = this.territories.get(territoryId);
            const player = this.players[playerIndex];
            territory.setOwner(player);
            player.territories.push(territoryId);
            territory.addTroops(1); // Each territory starts with 1 troop
            player.troopsToDeploy--; // Deduct 1 troop for initial placement
            playerIndex = (playerIndex + 1) % this.players.length;
        }
        this.phase = 'deployment'; // Move to deployment phase after initial territory assignment
    }

    getCurrentPlayer() {
        return this.players[this.turn];
    }

    nextPhase() {
        if (this.phase === 'deployment') {
            this.phase = 'attack';
        } else if (this.phase === 'attack') {
            this.phase = 'fortification';
        } else if (this.phase === 'fortification') {
            this.nextTurn();
        }
        return this.phase;
    }

    nextTurn() {
        this.turn = (this.turn + 1) % this.players.length;
        this.phase = 'deployment';
        // Award new troops for the new turn
        const currentPlayer = this.getCurrentPlayer();
        currentPlayer.troopsToDeploy = Math.max(3, Math.floor(currentPlayer.territories.length / 3));
        // Add continent bonuses
        this.continents.forEach(continent => {
            const ownedTerritories = continent.territories.filter(tId => this.territories.get(tId).owner.id === currentPlayer.id);
            if (ownedTerritories.length === continent.territories.length) {
                currentPlayer.troopsToDeploy += continent.bonus_armies;
            }
        });
        return this.getCurrentPlayer();
    }

    checkWinCondition() {
        if (this.players.length === 1) {
            return this.players[0]; // The last player remaining wins
        }

        const firstPlayer = this.players[0];
        let allTerritoriesOwnedByOnePlayer = true;
        for (const territory of this.territories.values()) {
            if (territory.owner.id !== firstPlayer.id) {
                allTerritoriesOwnedByOnePlayer = false;
                break;
            }
        }

        if (allTerritoriesOwnedByOnePlayer) {
            return firstPlayer;
        }

        return null; // No winner yet
    }

    rollDice(numDice) {
        const rolls = [];
        for (let i = 0; i < numDice; i++) {
            rolls.push(Math.floor(Math.random() * 6) + 1);
        }
        return rolls.sort((a, b) => b - a); // Sort in descending order
    }

    attack(attackingTerritoryId, defendingTerritoryId, numAttackingTroops) {
        const attackingTerritory = this.territories.get(attackingTerritoryId);
        const defendingTerritory = this.territories.get(defendingTerritoryId);

        if (!attackingTerritory || !defendingTerritory) {
            return { success: false, message: 'Invalid territories.' };
        }

        if (attackingTerritory.owner.id !== this.players[this.turn].id) {
            return { success: false, message: 'You do not own the attacking territory.' };
        }

        if (defendingTerritory.owner.id === this.players[this.turn].id) {
            return { success: false, message: 'You cannot attack your own territory.' };
        }

        if (!attackingTerritory.adjacentTerritories.includes(defendingTerritoryId)) {
            return { success: false, message: 'Territories are not adjacent.' };
        }

        if (attackingTerritory.troops <= numAttackingTroops) {
            return { success: false, message: 'You must leave at least one troop behind in the attacking territory.' };
        }

        if (numAttackingTroops > 3 || numAttackingTroops < 1) {
            return { success: false, message: 'You can attack with 1, 2, or 3 troops.' };
        }

        const attackerDice = this.rollDice(numAttackingTroops);
        const defenderDice = this.rollDice(Math.min(defendingTerritory.troops, 2)); // Defender rolls max 2 dice

        let attackerLosses = 0;
        let defenderLosses = 0;

        for (let i = 0; i < Math.min(attackerDice.length, defenderDice.length); i++) {
            if (attackerDice[i] > defenderDice[i]) {
                defenderLosses++;
            } else {
                attackerLosses++;
            }
        }

        attackingTerritory.removeTroops(attackerLosses);
        defendingTerritory.removeTroops(defenderLosses);

        let message = `Attacker rolled: ${attackerDice.join(', ')}\nDefender rolled: ${defenderDice.join(', ')}\n`;
        message += `Attacker lost ${attackerLosses} troops. Defender lost ${defenderLosses} troops.\n`;

        if (defendingTerritory.troops <= 0) {
            // Attacker conquers the territory
            const oldOwner = defendingTerritory.owner;
            oldOwner.territories = oldOwner.territories.filter(t => t !== defendingTerritoryId);
            
            defendingTerritory.setOwner(attackingTerritory.owner);
            attackingTerritory.owner.territories.push(defendingTerritoryId);
            
            // Move attacking troops to the conquered territory (at least numAttackingTroops)
            const troopsToMove = numAttackingTroops - attackerLosses;
            attackingTerritory.removeTroops(troopsToMove);
            defendingTerritory.addTroops(troopsToMove);

            message += `${attackingTerritory.owner.name} conquered ${defendingTerritory.name} and moved ${troopsToMove} troops.\n`;
            
            // Check if old owner is eliminated
            if (oldOwner.territories.length === 0) {
                this.players = this.players.filter(p => p.id !== oldOwner.id);
                message += `${oldOwner.name} has been eliminated from the game!\n`;
            }
        }

        return { success: true, message: message };
    }

    fortify(sourceTerritoryId, destinationTerritoryId, numTroops) {
        const sourceTerritory = this.territories.get(sourceTerritoryId);
        const destinationTerritory = this.territories.get(destinationTerritoryId);

        if (!sourceTerritory || !destinationTerritory) {
            return { success: false, message: 'Invalid territories.' };
        }

        if (sourceTerritory.owner.id !== this.players[this.turn].id || destinationTerritory.owner.id !== this.players[this.turn].id) {
            return { success: false, message: 'You can only fortify between your own territories.' };
        }

        if (!sourceTerritory.adjacentTerritories.includes(destinationTerritoryId)) {
            return { success: false, message: 'Territories are not adjacent.' };
        }

        if (sourceTerritory.troops <= numTroops) {
            return { success: false, message: 'You must leave at least one troop behind in the source territory.' };
        }

        if (numTroops <= 0) {
            return { success: false, message: 'You must move at least one troop.' };
        }

        sourceTerritory.removeTroops(numTroops);
        destinationTerritory.addTroops(numTroops);

        return { success: true, message: `Moved ${numTroops} troops from ${sourceTerritory.name} to ${destinationTerritory.name}.` };
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
}

