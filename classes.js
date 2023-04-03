class user 
{
    constructor(id, totalSustenance = 0, totalDamage = 0)
    {
        this.id = id; //either '1' or '2', to help indetify user among the two in a room
        this.totalSustenance = totalSustenance; //score
        this.totalDamage = totalDamage; //score
        this.cards = [];
    }
};
class room
{
    constructor(roomNumber, numOfPlayers = 0, player1 = undefined, player2 = undefined)
    {
        //Room Info
        this.roomNumber = roomNumber;

        //Player Info
        this.numOfPlayers = numOfPlayers;
        this.player1 = player1;
        this.player2 = player2;

        //Request Control and Sync Checks
        this.currentPlayer = NaN; //Necessary to restrict current player to play
        this.requestsToChangeTurn = 0; //Used to sync players for a change of turn
        this.lastCardPlayed = undefined; //Holds the ID of the last card to have its ID changed
        this.lastCardPlayedOldID = undefined; //Holds the old ID of the last card to have its ID changed
        this.lastFrom = undefined; //Holds the origin of the last card to have been played (hands or table)
        this.effectsTurnReq = 0; //Holds number of requests to get data from effects turn
        this.startingCardsReq = 0; //Holds the number of requests to get initial game cards. More than 2 result in game block.
        this.gameWinner = undefined; //Hold the number of the player that won. If it's not undefined, the game has ended.

        //Card IDs
        this.cardIDs = {};
    }
}


//About status:
//Total Sustenance: How much sustenance is held by the player during that round.
//Total Damage: How much damage is held by the player during that round. It's not how much the player has been damaged, but rather how much potential they have to damage with their cards.

/**
 * Class that represents a card's standard status. It may be changed during game session.
 */
class cardObj
{
    /**
     * @param {string} img Name of card that is included in src attribute in img tags. 
     * @param {number} totalSustenance How much sustenance this card provides to the one holding it [while in hand].
     * @param {number} totalDamage How much sustenance this card can reduce from those nearby (on table) [every round].
     * @param {number} [constructiveness=0] How much sustenance this card gets every round on table.
     * @param {number} [range=0] How many cards to the right or to the left are affected by this card.
     * @param {number} [absorption=0] How much sustenance this card can drain from its neighbourhood with its TotalDamage. Default is _0_.
     * @param {boolean} [infected=false]  Can this card affect those in hand? Default is _false_.
     * @param {number} [resistance=Infinity] How many rounds this card can withstand not being seen at all (cover). Default is _infinity_.
     * @callback ability Function representing bonus ability.
     */
    constructor(img, totalSustenance, totalDamage, constructiveness = 0, range = 0, absorption = 0, infected = false, resistance = Infinity, ability = ()=>{})
    {
        this.img = img;
        this.totalSustenance = totalSustenance;
        this.totalDamage = totalDamage;
        this.constructiveness = constructiveness;
        this.range = range;
        this.absorption = absorption;
        this.infected = infected;
        this.resistance = resistance;
        this.ability = ability;

        this.currentSustenance = this.totalSustenance;
        this.currentDamage = this.totalDamage;
    }
}

module.exports = {user, room, cardObj}