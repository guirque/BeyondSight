const express = require('express');
const app = express();
const logger = require('./Middleware/logger').logger;

app.use(logger);
app.use(express.static('./public'));

//Data & Declarations --------------------------------------------
const {user, room} = require('./classes');
const {cards} = require('./cardInfo');
const fs = require('fs');

let users = [];
let rooms = [];
let cardImgs = Object.keys(cards);
let lastRoomNum = -1;
const roomHTML = fs.readFileSync('./room.html', 'utf8');
const busyRoomHTML = fs.readFileSync('./busyRoom.html', 'utf8');
const roomNotFoundHTML = fs.readFileSync('./roomNotFound.html', 'utf8');
const gameOverRoom = fs.readFileSync('./results.html', 'utf8');
const scoreGoal = 40;

/**
 * Updates Card ID or registers new ID, if necessary.
 * @param {string} cardID Either an already existing (registered) ID or an img name to be registered for the first time.
 * @param {(string | number)} roomNumber Room to consider.
 * @returns {{id: number, img: string, currentSustenance: number, currentDamage: number}} An object containing the card's new ID, their img, current sustenance and current damage.
 */
const updateCardID = function(cardID, roomNumber)
{
    //Registering Card
    let newID = Math.floor(Math.random() * 10000) + 35683 * Math.floor(Math.random() * 100); //Create new ID
    rooms[roomNumber].cardIDs[newID] = cards[cardID];

    if(rooms[roomNumber].cardIDs.hasOwnProperty(cardID))
    {
        //copy the info from what it holds to new register and delete old one
        rooms[roomNumber].cardIDs[newID] = rooms[roomNumber].cardIDs[cardID];
        delete rooms[roomNumber].cardIDs[cardID];
    }
    else
    {
        //create entirely new register
        rooms[roomNumber].cardIDs[newID] = {...cards[cardID]}; //if it's the first time registering, cardID is initially just the img

    }

    let updatedCard = rooms[roomNumber].cardIDs[newID];

    return {
        id: newID, 
        img: updatedCard.img,
         currentSustenance: updatedCard.currentSustenance, 
         currentDamage: updatedCard.currentDamage};
}

const checkForGameEnd = function(roomNumber, res)
{
    try
    {
        let thisRoom = rooms[roomNumber]; let gameOver = false;
        let player1Score = thisRoom.player1.totalSustenance - thisRoom.player1.totalDamage;
        let player2Score = thisRoom.player2.totalSustenance - thisRoom.player2.totalDamage;
        if(player1Score >= scoreGoal) {thisRoom.gameWinner = 1; gameOver = true;}
        else if (player2Score >= scoreGoal) {thisRoom.gameWinner = 2; gameOver = true;}
        else res.status(200).json({msg: 'game not over'});

        if(gameOver) res.redirect(`/rooms/${roomNumber}/results`);
    }
    catch(error)
    {
        console.log(`<!> ${error}`);
        res.status(400).json({msg: 'error'});
    }
}

//Requests -------------------------------------------------------
let roomFunctions = require('./public/roomFunctions');

//Finding Room
app.post('/', async (req, res) => 
{
    //If there is already a logged user with that IP address
    /*if(users.some((element) => element.id == req.ip))
    {
        res.status(200).send('You are already logged in somewhere else.');
    }
    //Otherwise
    else{}*/

        //Finding Empty Room
        let roomFound = -1;
        rooms.find(function(aRoom)
        {
            if(aRoom && aRoom.numOfPlayers < 2)
            {
                //users[aRoom.roomNumber].roomNumber = aRoom.roomNumber;
                roomFound = aRoom.roomNumber;
                return true;
            }
            else return false;
        });

        //Creating new room if one was not found. Otherwise, just redirect to found room.
        if(roomFound == -1)
        {
            lastRoomNum++;
            rooms[lastRoomNum] = new room(lastRoomNum, 0);
            console.log(`| New room created: ${lastRoomNum}`);

            //users[numofUsers - 1].roomNumber = lastRoomNum;
            roomFound = true;
            res.redirect(`/rooms/${lastRoomNum}`);
        }
        else res.redirect(`/rooms/${roomFound}`);
    
});

//Loading Room
app.get('/rooms/:roomNum', async (req, res) => 
{
    const {roomNum} = req.params;
    const thisRoom = rooms[roomNum];
    
    //Check if room doesn't exist
    if(!thisRoom) res.status(404).send(roomNotFoundHTML);

    //Check if user is allowed to get inside this room and update number of users in room.
    //Also check if it's not the same user trying to get to the same room they're already logged into.
    else if(thisRoom.numOfPlayers < 2)
    {
        //User allowed to enter room. Updating room number count.
        thisRoom.numOfPlayers++;

        //Registering User
        let thisPlayer = 0;
        if(thisRoom.player1 === undefined) { thisPlayer = 1; thisRoom.player1 = new user(1, 0);}
        else {thisPlayer = 2; thisRoom.player2 = new user(2, 0);}

        //console.table(rooms);

        //Load game for players in room
        res.status(200).send(roomHTML.replace(`<title> Room`, `<title> Room ${thisRoom.roomNumber} - Player ${thisPlayer}`));
    }

    //Access Denied
    else
    {
        console.log(`| Blocked user from getting into room ${thisRoom.roomNumber}, which is busy`);
        res.status(400).send(busyRoomHTML);
    }

});

//Room Status Update
app.use(express.json());
app.post('/roomStatus/:num', (req, res) => 
{
    //req.body carries info from frontEnd
    try
    {
        const roomNumber = Number(req.params.num);

        if(req.body.status == 'cardPlayed')
        {
            //cardPlayed request is always sent by the player who has just played. The body object holds up to two values:
            //'myID' (player number) and 'cardPlayed' (Node Element Representing Played Card)
            const {myID, cardPlayedID, enemySustenance, enemyDamage, from} = req.body.data;
            let opponent = '';
            if(myID == 1) opponent = 'player2';
            else opponent = 'player1';

            //If the user calling is waiting for the card that was played
            if (rooms[roomNumber].currentPlayer != myID)
            {
                let lastCardPlayed;

                let waitingForCardToBePlayed = setInterval(() => 
                {
                    //Getting Last Card Played (ID) && From
                    lastCardPlayed = rooms[roomNumber].lastCardPlayed;
                    let lastFrom = rooms[roomNumber].lastFrom;
                    let unchangedID = rooms[roomNumber].lastCardPlayedOldID;

                    //Check if both Players are Present
                    if(rooms[roomNumber].numOfPlayers != 2){clearInterval(waitingForCardToBePlayed); res.json({error: 'Opponent has left game session. Redirecting to home page.'});}

                    //Card Info Received
                    else if(lastCardPlayed !== undefined && lastFrom != undefined && unchangedID != undefined)
                    {
                        //Clearing Interval & Resetting Last Card Played
                        clearInterval(waitingForCardToBePlayed);
                        rooms[roomNumber].lastCardPlayed = undefined;
                        rooms[roomNumber].lastFrom = undefined;
                        rooms[roomNumber].lastCardPlayedOldID = undefined;

                        //updateCardID(lastCardPlayed, roomNumber);

                        //Returning Last Card Played & Status Update
                        res.status(200).json(
                            {
                                card: lastCardPlayed, 
                                enemySustenance: rooms[roomNumber][opponent].totalSustenance,
                                enemyDamage: rooms[roomNumber][opponent].totalDamage,
                                from: lastFrom,
                                oldID: unchangedID
                            });
                    }
                }, 1500);

            }
            //If the user is the one who played the card
            else
            {
                //Passing status update to oponnent
                rooms[roomNumber][`player${myID}`].totalSustenance = enemySustenance;
                rooms[roomNumber][`player${myID}`].totalDamage = enemyDamage;

                //Registering Card
                let updated = updateCardID(cardPlayedID, roomNumber);
                let newID = updated.id;

                //Setting Last Card Played
                rooms[roomNumber].lastCardPlayed = newID;
                rooms[roomNumber].lastCardPlayedOldID = cardPlayedID;
                //Setting Last From Info
                rooms[roomNumber].lastFrom = from;

                //Updating Server Data for User's Status
                if(from == 'hands')
                {
                    //Card played on table
                    rooms[roomNumber][`player${myID}`].totalSustenance -= updated.currentSustenance;
                    rooms[roomNumber][`player${myID}`].totalDamage -= updated.currentDamage;
                }
                else
                {
                    //Card gotten from table
                    rooms[roomNumber][`player${myID}`].totalSustenance += updated.currentSustenance;
                    rooms[roomNumber][`player${myID}`].totalDamage += updated.currentDamage;
                }

                //console.log(`Player ${myID}'s Status: `, rooms[roomNumber][`player${myID}`]);
                //console.table(rooms[roomNumber].cardIDs);

                //Returning the card played or received
                res.status(200).json({card: rooms[roomNumber].cardIDs[newID], id: newID });
            }
        }
        else if(req.body.status == 'changeTurn')
        {

            rooms[roomNumber].requestsToChangeTurn++;
            let changeCurrentPlayer = false;
            if(rooms[roomNumber].requestsToChangeTurn > 2) rooms[roomNumber].requestsToChangeTurn = 1;
            if(rooms[roomNumber].requestsToChangeTurn == 1) changeCurrentPlayer = true;

            //In order to assure the value for currentPlayer is only updated once,
            //only the first request is considered when changing the value.

            let syncPlayers = setInterval(() => {
                
                //Check if both Players are Present
                if(rooms[roomNumber].numOfPlayers != 2){clearInterval(syncPlayers); res.json({error: 'Opponent has left game session. Redirecting to home page.'});}
                
                else if(rooms[roomNumber].requestsToChangeTurn >= 2)
                {
                    clearInterval(syncPlayers);
                    rooms[roomNumber].effectsTurnReq = 0;
                    if(changeCurrentPlayer) 
                    {
                        switch(rooms[roomNumber].currentPlayer)
                        {
                        case 1:
                            rooms[roomNumber].currentPlayer = 2;
                            break;
                        case 2:
                            rooms[roomNumber].currentPlayer = 1;
                            break;
                        default:
                            throw console.error(`Couldn't switch turns for room ${roomNumber}: unexpected current player: ${rooms[roomNumber].currentPlayer}`);
                        }
                    }
                    res.status(200).json({player: rooms[roomNumber].currentPlayer});
                }
            }, 1500);
        }
        else if(req.body.status == 'gameStart') 
        {
            let checkForOtherPlayer = setInterval(() => 
            {
                if(rooms[roomNumber].numOfPlayers >= 2) 
                {
                    clearInterval(checkForOtherPlayer);
                    return res.status(200).json({msg: 'success. 2 players in the same room'});
                }
            },1000);
        }
        else if(req.body.status == 'playOrder')
        {
            setTimeout(() => 
            {
                //ANALYSE FURTHER TO MAKE SURE IT'S IN SYNC

                //Set it if it hasn't yet been set yet
                if(isNaN(rooms[roomNumber].currentPlayer)) rooms[roomNumber].currentPlayer = Math.floor(Math.random() * 2) + 1;
                res.status(200).json({msg: rooms[roomNumber].currentPlayer});
            }, 2000);
        }
    }
    catch(error)
    {
        console.log(`<!> Error with status response: ${error}`);
        res.status(400).redirect('/');
    }
});

app.post('/rooms/:roomNum/effectsTurn', (req, res) => 
{
    //Safety Checks
    let updateServerData = false;
    const {roomNum} = req.params;
    const {cardIDs, playerNum} = req.body.data;
    rooms[roomNum].effectsTurnReq++;
    if(rooms[roomNum].effectsTurnReq == 2) updateServerData = true;

    //console.log(`${roomNum}: player ${playerNum}...`, cardIDs);
    if(playerNum == 1) rooms[roomNum].player1.cards = cardIDs;
    if(playerNum == 2) rooms[roomNum].player2.cards = cardIDs;
    
    let syncPlayers = setInterval(() => 
    {
        if(rooms[roomNum].effectsTurnReq > 2){clearInterval(syncPlayers); res.status(400).json({error: `Sync Error`});}
    
        else if(rooms[roomNum].effectsTurnReq == 2)
        {
            //Check if both arrays are different in any way (sync error)
            if(rooms[roomNum].player1.cards.some((roomID, i) => roomID != rooms[roomNum].player2.cards[i])){clearInterval(syncPlayers); res.status(400).json({error: `Sync Error`});}
            
            //Move on
            else
            {
                clearInterval(syncPlayers);

                //Simulate game internally and return an array with how much damage cards have taken and how much sustenance they have received.
                //If card is supposed to be revealed on table, also return img.
                let response = cardIDs.map(() => {return {sustenanceReceived: 0, damageReceived: 0}}); //response array holds data about the card's changes in status
                for(let i = 0; i < cardIDs.length; i++)
                {
                    let thisCard = rooms[roomNum].cardIDs[cardIDs[i]]; //get card in position i

                    //Affect cards -------------------

                    //Constructiveness (give itself sustenance)
                    response[i].sustenanceReceived += thisCard.constructiveness;
                    
                    //Do damage (from range cards to the left all the way to range cards to the right) 
                    if(thisCard.totalDamage > 0) for(let rangePosition =  i - thisCard.range; rangePosition <= i + thisCard.range; rangePosition++)
                    {
                        //If position exists and is not the card itself
                        if(rangePosition >= 0 && rangePosition < cardIDs.length && rangePosition != i)
                        {
                            response[rangePosition].damageReceived += thisCard.totalDamage;
                        }
                    }
                }

                //Updating Room Card Data
                if(updateServerData) response.forEach((CardStatus, i) => 
                {
                    let cardToUpdate = rooms[roomNum].cardIDs[cardIDs[i]];
                    cardToUpdate.currentSustenance += CardStatus.sustenanceReceived;
                    cardToUpdate.currentSustenance -= CardStatus.damageReceived;
                    if(cardToUpdate.currentSustenance < 0) cardToUpdate.currentSustenance = 0;
                });

                //console.table(rooms[roomNum].cardIDs);

                res.status(200).json({cardStatus: response});
            }
        }
    }, 1500);

    //Response
});

app.post('/rooms/:roomNum/startingCards', (req, res)=>
{
    try{
        rooms[req.params.roomNum].startingCardsReq++;
        let thisPlayer = req.body.data.player;

        if(rooms[req.params.roomNum].startingCardsReq <= 2)
        {
            let response = [];
            for(let i = 0; i < 3; i++) 
            {
                let updatedCard = updateCardID(cardImgs[Math.floor(Math.random() * cardImgs.length)], req.params.roomNum);
                response.push(updatedCard);
                
                //Update total sustenance and damage
                rooms[req.params.roomNum][`player${thisPlayer}`].totalSustenance += updatedCard.currentSustenance;
                rooms[req.params.roomNum][`player${thisPlayer}`].totalDamage += updatedCard.currentDamage;
            }
            res.status(200).json({shuffled: response});
        }
    }
    catch(error)
    {
        console.log(`<!> ${error}`);
    }
});

//General Get Requests
app.get('/cardData', (req, res) =>
{
    try{res.status(200).json(cards);}
    catch(error){console.log(error);}

});

app.post('/leave', (req, res) => 
{
    myID = req.body.data.myID;
    myRoom = req.body.data.myRoom;
    if(rooms[myRoom])
    {
        //Resetting Room Data
        if(myID == 1) rooms[myRoom].player1 = undefined;
        else rooms[myRoom].player2 = undefined;

        rooms[myRoom].numOfPlayers--;

        //Reset Entire Room Data
        rooms[myRoom] = new room(myRoom, 0);

        /*if(rooms[myRoom].numOfPlayers == 0)
        {
            rooms[myRoom].currentPlayer = NaN;
            rooms[myRoom].requestsToChangeTurn = 0;
            rooms[myRoom].lastCardPlayed = undefined;
            rooms[myRoom].effectsTurnReq = 0;
        }*/
        console.log(`| Player ${myID} left room ${myRoom}`);
    }
    else console.log(`| Player ${myID} left nonexistent room`);

    res.redirect('/');
});

app.get('/rooms/:roomNum/currentPlayer', (req, res)=>
{
    try
    {
        res.status(200).json({currentPlayer: rooms[req.params.roomNum].currentPlayer});
    }
    catch(error)
    {
        console.log(`<!> Error returning currentPlayer for room ${req.params.roomNum}: ${error}`);
    }
})

app.get('/rooms/:roomNum/checkGameOver', (req, res) => 
{
    let roomNumber = req.params.roomNum;
    try
    {
        let thisRoom = rooms[roomNumber]; let gameOver = false;
        let player1Score = thisRoom.player1.totalSustenance - thisRoom.player1.totalDamage;
        let player2Score = thisRoom.player2.totalSustenance - thisRoom.player2.totalDamage;
        if(player1Score >= scoreGoal) {thisRoom.gameWinner = 1; gameOver = true;}
        else if (player2Score >= scoreGoal) {thisRoom.gameWinner = 2; gameOver = true;}
        
        if(gameOver) console.log(`<:)> Game Finished in room ${roomNumber}:
        -> player 1: ${player1Score} points
        -> player 2: ${player2Score} points`);
        res.status(200).json({gameOver: gameOver});
    }
    catch(error)
    {
        console.log(`<!> ${error}`);
        res.status(400).json({msg: 'error'});
    }
});

app.get('/rooms/:roomNum/results', (req, res) => 
{
    res.status(200).send(gameOverRoom);
});

//Warning from room
app.post('/rooms/:roomNum/warning', (req, res) => 
{
    console.log(`<!> In room ${req.params.roomNum}: ${req.body.data.error}`);
    res.status(200).json({msg: 'success'});
})

app.listen(3000, () => {console.log('-> Server listening on Port 3000');});