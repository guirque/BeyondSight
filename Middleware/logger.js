function logger(req, res, next)
{

    if(req.method == 'POST' && req.url == '/') console.log(`| Found room for a user`);
    //else if(req.method == 'GET' && req.url.match(/\/rooms\//)) console.log(`| Connected user to room ${req.url.match(/[^\/]+/ig)[1]}`);
    //else if(req.url.match('roomStatus')) console.log(`| Room status requested`);
    //else console.log(`| ${req.method} request with route '${req.url}' made`);
    next();
}

module.exports = {logger}