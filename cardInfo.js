const {cardObj} = require('./classes');

/**
 * Object with info about the game cards.
 */
const cards = 
{
    //Simple Cards (no bonus effects, not too dificult to spot or use)
    'Card_Poison': new cardObj('Card_Poison', 0, 1, 0, 1, 0, false, 4), //basic damage card
    'Card_Wood': new cardObj('Card_Wood', 10, 0, 1), //basic sustanance card

    'Card_Bottle_Poison': new cardObj('Card_Bottle_Poison', 0, 3, 0, 1),
    'Card_Spilled_Poison': new cardObj('Card_Spilled_Poison', 0, 3, 0, 0)
};

module.exports = {cards}