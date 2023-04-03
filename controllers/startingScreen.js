async function loadStart (req, res) 
{
    //If there is already a logged user with that IP address
    if(users.some((element) => element.id == req.ip))
    {
        res.status(200).send('You are already logged in somewhere else.');
    }
    //Otherwise
    else
    {
        //Registering User
        let userIndex = users.push(new user(req.ip, 0)) - 1;

        //Finding Empty Room
        let roomFound = undefined;
        rooms.find(function(aRoom)
        {
            if(aRoom.numOfPlayers < 2)
            {
                users[userIndex].roomNumber = aRoom.roomNumber;
                rooms[userIndex].numOfPlayers++;
                roomFound = aRoom.roomNumber;
                return true;
            }
            else return false;
        });

        //Creating new room if one was not found. Otherwise, just redirect to found room.
        if(!roomFound)
        {
            rooms.push(new room(++lastRoomNum, 1, req.ip));
            users[numofUsers - 1].roomNumber = lastRoomNum;
            roomFound = true;
            res.redirect(`/rooms/${lastRoomNum}`);
        }
        else res.redirect(`/rooms/${roomFound}`);
    }
}

module.exports = {loadStart}