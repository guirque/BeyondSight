async function loadRoom(req, res)
{
    //First: Check if user is allowed to get inside this room and update number of users in room.
    
    res.status(200).send(require('./public/index.html'));
}

module.exports = {loadRoom}