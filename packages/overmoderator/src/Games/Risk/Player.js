class Player {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.territories = [];
        this.cards = [];
        this.troopsToDeploy = 0;
    }
}

module.exports = Player;
