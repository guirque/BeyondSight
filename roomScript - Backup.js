//Initialization ---------------------------------------------------------------------------------------
console.log('Front-end room script loaded.');

let pageTitleNumbers = document.querySelector('title').innerHTML.match(/\d+/ig);
let roomNumber = Number(pageTitleNumbers[0]);
let thisPlayer = Number(pageTitleNumbers[1]);
let gameOver = false;
let mayPlayCard = true;
const statusSustanance = document.querySelector('#yourSustanance').querySelector('.value'); 
const statusDamage = document.querySelector('#yourDamage').querySelector('.value');
let totalSustanance = 0, totalDamage = 0;
const hands = document.querySelector('#yourCards');
let tableCards = [];
let cardData;
let serverErrorMsg = false; 
fetch('/cardData').then((response) => {response.json().then((data) => {cardData = data;})})

//Status and Requests to Back End ----------------------------------------------------------------------
/**
 * POST request to server
 * @param {string} path 
 * @param {object} dataToSend 
 * @returns {Promise}
 */
async function requestToServer(path, dataToSend)
{
    try
    {
        let requestResponse = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(dataToSend)});
        let serverResponse = await requestResponse.json();
        if(serverResponse.error != undefined) throw serverResponse.error;

        return serverResponse;
    }
    catch(error)
    {
        alert(error);
        document.querySelector('#home').click();
    }
}

/**
 * Get request to server
 * @param {string} path 
 */
async function getFromServer(path)
{
    let requestResponse = await fetch(path);
    let serverResponse = await requestResponse.json();
    return serverResponse;
}

//Getting Status and Updating Server Info
class requestDataObj 
{
    constructor(aStatus = 'getRoomInfo', aData = {})
    {
        this.status = aStatus; //Indicates what the server is supposed to do with such info
        this.data = aData; //Data to be carried over
        this.yourCards = document.getElementById('yourCards').children; //HTML Collection
        this.theirCards = document.getElementById('theirCards').children; //HTML Collection
    }
};

//GAME FLOW ---------------------------------------------------------------------------------------------
let currentPlayer = undefined; //String: either your player number or theirs or -1 (neither: effects running)
let status = {totalSustanance: 0, totalDamage: 0};
const messageNode = document.querySelector('#messages');
let firstTurn = true;
/**
 * Displays a message gor a while.
 * @param {string} msg What text message to be displayed.
 * @param {number} duration How long the message is supposed to be show for (in ms). Default: 2000ms. 
 * @returns A promise for when the message is done being shown. 
 */
function showMessage(msg, duration = 2000)
{
    return new Promise((resolve, reject) => 
    {
        messageNode.style.display = 'flex';
        messageNode.innerHTML = msg;
        setTimeout(() => {messageNode.style.display = 'none'; resolve();}, duration);
    });
}

(async function gameFlow()
{
    try
    {
        //Waiting for Other Player
        //...

        //Found Player
        let startResponse = await requestToServer(`/roomStatus/${roomNumber}`, new requestDataObj('gameStart'));
        messageNode.style.display = 'none';
        console.log(`Room Full: Game Starting Soon...`);
        console.log(startResponse);
        
        //Shuffling cards for current user
        const cardIDs = ['Card_Poison', 'Card_Wood'];
        for(let i = 0; i < 3; i++) 
        {
            let cardChoice = cardIDs[Math.floor(Math.random() * cardIDs.length)];
            document.querySelector('#yourCards').innerHTML += `<img src="/Images/${cardChoice}.png" id="${cardChoice}" class="yourCard card" onclick="cardClicked(this)">`;
            document.querySelector('#theirCards').innerHTML += `<img src="/Images/Card_Back.png" id="Card_Poison" class="theirCard card">`;
        }

        //First Status Update
        updateStatus();

        //Deciding who will play first
        messageNode.style.display = 'flex';
        messageNode.innerHTML = 'Deciding who will play first...';
        let playOrder = await requestToServer(`/roomStatus/${roomNumber}`, new requestDataObj('playOrder', {myID: thisPlayer}));
        currentPlayer = playOrder.msg;
        console.log(`First to play: player ${currentPlayer}. You're player ${thisPlayer}.`);
        if(currentPlayer == thisPlayer) messageNode.innerHTML = `You play first!`;
        else messageNode.innerHTML = `Opponent plays first`;
        setTimeout(() => {messageNode.style.display = 'none'}, 4000);


        //Game
        while(!gameOver)
        {
            //Change Turn (and sync players)
            if(!firstTurn)
            {
                turnResponse = await requestToServer(`/roomStatus/${roomNumber}`, new requestDataObj('changeTurn', {myID: thisPlayer}));
                if(turnResponse !== undefined) currentPlayer = turnResponse.player;
                console.log(`The current user to play is: `, currentPlayer);
                //console.log(`Player ${currentPlayer}'s turn`);
            }

            //Play or Wait --------------
            let cardPlayedID = undefined;

            //Play
            if(currentPlayer == thisPlayer)
            {
                showMessage(`Your turn!`);
                console.log(`Your turn.`);
                mayPlayCard = true;
                await waitForAction();
            }

            //Wait for opponent to play
            else
            {
                //Requesting Update
                showMessage(`Opponent's turn`);
                console.log(`Their turn`);
                responseFromCardPlayed = await requestToServer(`/roomStatus/${roomNumber}`, new requestDataObj('cardPlayed', {myID: thisPlayer}));
                cardPlayedID = responseFromCardPlayed.card;
                originalID = responseFromCardPlayed.oldID;
                fromWhere = responseFromCardPlayed.from;

                //Updating Opponent's status
                updateEnemyStatus(responseFromCardPlayed.enemySustanance, responseFromCardPlayed.enemyDamage);

                if(fromWhere == 'hands')
                {
                    //Placing Card on Table
                    document.querySelector('#theirCards').removeChild(document.querySelector('#theirCards').lastChild);
                    document.querySelector('#table').innerHTML += `<img src="/Images/Card_Back.png" id="${cardPlayedID}" class="tableCard card" onclick="cardClicked(this)">`;
                }
                else if(fromWhere == 'table')
                {
                    //Getting Card from Table to Opponent
                    document.querySelector('#table').removeChild(document.getElementById(originalID));
                    document.querySelector('#theirCards').innerHTML += `<img src="/Images/Card_Back.png" class="theirCard card">`;
                }
                else{throw `Failed understanding origin of card: ${fromWhere}`;}
            }

            //Effects Turn -------------
            await effectsTurn(cardPlayedID);

            //Setting firstTurn false --
            firstTurn = false;
        }
    }
    catch(error)
    {
        //requestToServer(`/rooms/${roomNumber}/warning`, new requestDataObj('', {error: error}));
        alert(`An error occured: ${error}. Redirecting to main page.`);
        document.querySelector('#home').click();
    }
}());

//Separate Functions ------------------------------------------------------------------------------------

async function updateStatus()
{
    //Updating Status
    let localTotalSustanance = 0, localTotalDamage = 0;
    [...hands.children].forEach((aCard) => 
    {
        //TO UPDATE: MIGHT HAVE TO REQUIRE CARD IMG STRING INSTEAD OF CARD ID
        console.log(`aCard.id: ${aCard.id}`, aCard);
        localTotalSustanance += cardData[aCard.id].totalSustanance;
        localTotalDamage += cardData[aCard.id].totalDamage;
    });

    statusSustanance.innerHTML = localTotalSustanance;
    statusDamage.innerHTML = localTotalDamage;
    totalSustanance = localTotalSustanance;
    totalDamage = localTotalDamage;
}

async function updateEnemyStatus(totalSustanance, totalDamage)
{
    document.querySelector('#theirSustanance').querySelector('.value').innerHTML = totalSustanance;
    document.querySelector('#theirDamage').querySelector('.value').innerHTML = totalDamage;
}

let playedCard = false;
/**
 * Waits for the current player to do something and returns a promise.
 */
async function waitForAction()
{
    return new Promise((resolve, reject) => 
    {
        let checking = setInterval(() => 
        {
            if(playedCard) {clearInterval(checking); playedCard = false; resolve();}
        }, 2000);
    });
}

//Plays desired card *if* it's the player's turn and changes turn.
/**
 * @param {HTMLElement} thisCard 
 */
async function cardClicked(thisCard)
{
    if((await getFromServer(`/rooms/${roomNumber}/currentPlayer`)).currentPlayer == thisPlayer && mayPlayCard)
    {
        //Initial Settings
        mayPlayCard = false;
        playedCard = true;

        //Placed Card
        if(thisCard.className.match('yourCard')){

            console.log(`You played a card.`);

            //Remove Card From Hands
            let cardID = thisCard.id;
            document.querySelector('#yourCards').removeChild(thisCard);

            //Update Status
            updateStatus();

            //Tell Opponent what card was played (update data in server)
            let playedACard = await requestToServer(`/roomStatus/${roomNumber}`, new requestDataObj('cardPlayed', 
            {
                myID: thisPlayer, 
                cardPlayedID: thisCard.id, 
                enemySustanance: totalSustanance, 
                enemyDamage: totalDamage,
                from: 'hands'
            }));

            //Add to table
            document.querySelector('#table').innerHTML += `<img src="/Images/Card_Back.png" id="${playedACard.id}" class="tableCard card" onclick="cardClicked(this)">`; //Adding to table
        }
        //Grabbed Card from Table
        else
        {
            console.log(`You grabbed a card from the table.`);

            let cardID = thisCard.id;

            //Remove Card From Table
            document.querySelector('#table').removeChild(thisCard);

            //Tell Opponent what card was played (update data in server)
            let playedACard = await requestToServer(`/roomStatus/${roomNumber}`, new requestDataObj('cardPlayed', 
            {
                myID: thisPlayer, 
                cardPlayedID: thisCard.id, 
                enemySustanance: totalSustanance, 
                enemyDamage: totalDamage,
                from: 'table'
            }));

            //Add to hands
            document.querySelector('#yourCards').innerHTML += `<img src="/Images/${playedACard.card.img}.png" id="${playedACard.id}" class="yourCard card" onclick="cardClicked(this)">`;
        }
    }
    else
    {
        showMessage(`You can't play right now...`);
    }
}

/**
 * 
 * @param {string} newCardPlayed The id of the new card played
 * @returns 
 */
async function effectsTurn(newCardPlayed = undefined)
{
    console.log(`Effect turn started`);
    let table = document.querySelector('#table');
    let info = await requestToServer(`/rooms/${roomNumber}/effectsTurn`, new requestDataObj('', {cardIDs: [...table.children].map((element) => element.id), playerNum: thisPlayer})); //getting data to use during effects turn
    console.log('effect turn response: ', info);

    return new Promise((resolve, reject) => 
    {
        showMessage(`Effect Turn!`);

        let i = 0;
        let limit = table.childElementCount;
        console.log('Number of cards on table: ', limit);

        let turn = setInterval(() => 
        {

            //User sends an array with the ids of all cards on table, in the order they appear, to the server, in a post request.
            //Server returns the data about the cards
            //Server checks for errors: before returning data, 
            //checks if the table is equal for both users, makes sure to respond simultaneously, and also checks if the number of requests for card info is adequate.
            //if more than 2 requests have been made before a change of turn, that is also an error in sync (or cheating).

            if(i != 0)
            {
                table.children[i-1].style.animation = '';
            }
            //If there are no more cards to play
            if(i >= limit)
            {
                clearInterval(turn);
                console.log(`Effect turn over`);
                resolve();
            }
            //Pick the selected card and activate their abilities
            else
            {
                table.children[i].style.animation = 'cardEffectAnim 2.5s backwards';
                
            }
            i++;
        }, 3000); 
    });
}

/**
 * 
 * @param {Node} aNode 
 * @param {string} animationName 
 * @param {number} duration
 */
async function runAnimation(aNode, animationName, duration)
{
    return new Promise((resolve, reject) => 
    {
        aNode.style.animation = `${animationName} ${duration}ms forwards`;
        setTimeout( () => 
            {
                aNode.style.animation = 'none';
            }, duration);
    });

}