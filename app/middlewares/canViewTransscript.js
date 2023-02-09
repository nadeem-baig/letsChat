var mongoose = require("mongoose");
var {myDecipher,getCookie} = require('../misc/Decrypt')

module.exports = function CanView(req, res, next) {
    var User = mongoose.model("User");
    User.findOne({ email: myDecipher(getCookie(req, "user")) }, function (err, user) {
        if (myDecipher(getCookie(req, "Transcript"))=='true') {
            if (Object.is(user, null)) {
                res.send(401, "Unauthorized");
                return;
            } else {
                next();
                return;
            }
        // return unauthorized
    } else {
        res.send(401, "Unauthorized");
        return;
      }
    });
  };