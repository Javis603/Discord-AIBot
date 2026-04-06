class Territory {
    constructor(name, continent, adjacentTerritories) {
        this.name = name;
        this.continent = continent;
        this.adjacentTerritories = adjacentTerritories;
        this.owner = null;
        this.troops = 0;
    }

    setOwner(player) {
        this.owner = player;
    }

    addTroops(number) {
        this.troops += number;
    }

    removeTroops(number) {
        this.troops -= number;
    }
}

module.exports = Territory;
