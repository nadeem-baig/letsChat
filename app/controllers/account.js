//
// Account Controller
//

"use strict";

var _ = require("lodash"),
    fs = require("fs"),
    psjon = require("./../../package.json"),
    auth = require("./../auth/index"),
    path = require("path"),
    settings = require("./../config"),
    mongoose = require("mongoose");
var {myDecipher,getCookie} = require('../misc/Decrypt')

module.exports = function () {
    var app = this.app,
        core = this.core,
        middlewares = this.middlewares;

    core.on("account:update", function (data) {
        app.io.emit("users:update", data.user);
    });

    //
    // Routes
    //

    app.get("/", middlewares.requireLogin.redirect, function (req, res) {
        res.render("chat.html", {
            account: req.user,
            settings: settings,
            version: psjon.version,
        });
    });

    app.get("/login", function (req, res) {
        res.cookie(`crisisid`,req.query.crisisid);
        res.cookie(`id`,req.query.id);
        res.cookie(`Transcript`,req.query.Transcript);
        res.cookie(`user`,req.query.user);
        var imagePath = path.resolve("media/img/photos");
        var images = fs.readdirSync(imagePath);
        var image = _.chain(images)
            .filter(function (file) {
                return /\.(gif|jpg|jpeg|png)$/i.test(file);
            })
            .sample()
            .value();
        res.render("login.html", {
            photo: image,
            auth: auth.providers,
        });
    });

    app.get("/logout", function (req, res) {
        req.logOut();
        res.status(200).clearCookie('connect.sid', {
          path: '/'
        });
        req.session.destroy(function (err) {
          res.redirect('/');
        });
    });

    app.post("/account/login", function (req) {
        req.io.route("account:applogin");
    });
    app.post("/insert/user", function (req, res) {
        core.account.create("local", req.body, function (err) {
            if (err) {
                var message = "Sorry, we could not process your request";
                // User already exists
                if (err.code === 11000) {
                    message = "Email has already been taken";
                }
                // Invalid username
                if (err.errors) {
                    message = _.map(err.errors, function (error) {
                        return error.message;
                    }).join(" ");
                    // If all else fails...
                } else {
                    console.error(err);
                }
                // Notify
                return res.status(400).json({
                    status: "error",
                    message: message,
                });
            }

            res.status(201).json({
                status: "success",
                message:
                    "You've been registered, " + "please try logging in now!",
            });
        });
    });
    app.post("/log", function (req, res) {
        var log = mongoose.model("Userlog");
        var Record = new log({
            email: myDecipher(getCookie(req, "user")),
            link: req.body.data,
            roomnumber: myDecipher(getCookie(req, "id")),
        });
        Record.save((err) => {
            if (!err) {
                res.sendStatus(200);
            } else {
                res.sendStatus(404);
            }
        });
    });
    app.get("/log", middlewares.requireLogin.redirect, function (req, res) {
        try {
            var log = mongoose.model("Userlog");
            log.find((err, docs) => {
                if (!err) {
                    res.status(200).send(docs);
                } else {
                    res.sendStatus(404);
                    // console.log('Failed to retrieve the Course List: ' + err);
                }
            });
        } catch (error) {
            res.sendStatus(404);
        }
    });

    // app.post("/rooms/crisisid", function (req, res) {
    //     var Room = mongoose.model("Room");
    //     Room.findOne(
    //         {
    //             // crisisid:  myDecipher(getCookie(req, "crisisid")),
    //             crisisid: 1,
    //             allowedusers: {
    //                 // $elemMatch: { $eq: myDecipher(getCookie(req, "user")) },
    //                 $elemMatch: { $eq: "admin@admin.com" },
    //             },
    //         },
    //         function (err, user) {
    //                     if (!err)
    //                       {
    //                         res.send(user)
    //                     }
    //                     else{
    //                         res.sendStatus(404)
    //                     }
    //         }
    //     );

    // });


    // app.post('/account/register', function(req) {
    //     req.io.route('account:register');
    // });

    // app.get('/account', middlewares.requireLogin, function(req) {
    //     req.io.route('account:whoami');
    // });

    // app.post('/account/profile', middlewares.requireLogin, function(req) {
    //     req.io.route('account:profile');
    // });

    // app.post('/account/settings', middlewares.requireLogin, function(req) {
    //     req.io.route('account:settings');
    // });

    app.post(
        "/account/token/generate",
        middlewares.requireLogin,
        function (req) {
            req.io.route("account:generate_token");
        }
    );

    app.post("/account/token/revoke", middlewares.requireLogin, function (req) {
        req.io.route("account:revoke_token");
    });



    //
    // Sockets
    //
    app.io.route("account", {
        // whoami: function(req, res) {
        //     res.json(req.user);
        // },

        // profile: function(req, res) {
        //     var form = req.body || req.data,
        //         data = {
        //             displayName: form.displayName || form['display-name'],
        //             firstName: form.firstName || form['first-name'],
        //             lastName: form.lastName || form['last-name'],
        //             openRooms: form.openRooms,
        //         };

        //     core.account.update(req.user._id, data, function (err, user) {
        //         if (err) {
        //             return res.json({
        //                 status: 'error',
        //                 message: 'Unable to update your profile.',
        //                 errors: err
        //             });
        //         }

        //         if (!user) {
        //             return res.sendStatus(404);
        //         }

        //         res.json(user);
        //     });
        // },
        // settings: function(req, res) {
        //     if (req.user.usingToken) {
        //         return res.status(403).json({
        //             status: 'error',
        //             message: 'Cannot change account settings ' +
        //                      'when using token authentication.'
        //         });
        //     }

        //     var form = req.body || req.data,
        //         data = {
        //             username: form.username,
        //             email: form.email,
        //             currentPassword: form.password ||
        //                 form['current-password'] || form.currentPassword,
        //             newPassword: form['new-password'] || form.newPassword,
        //             confirmPassowrd: form['confirm-password'] ||
        //                 form.confirmPassword
        //         };

        //     auth.authenticate(req, req.user.uid || req.user.username,
        //                       data.currentPassword, function(err, user) {

        //         if (err) {
        //             return res.status(400).json({
        //                 status: 'error',
        //                 message: 'There were problems authenticating you.',
        //                 errors: err
        //             });
        //         }

        //         if (!user) {
        //             return res.status(401).json({
        //                 status: 'error',
        //                 message: 'Incorrect login credentials.'
        //             });
        //         }

        //         core.account.update(req.user._id, data, function (err, user, reason) {
        //             if (err || !user) {
        //                 return res.status(400).json({
        //                     status: 'error',
        //                     message: 'Unable to update your account.',
        //                     reason: reason,
        //                     errors: err
        //                 });
        //             }
        //             res.json(user);
        //         });
        //     });
        // },
        generate_token: function (req, res) {
            if (req.user.usingToken) {
                return res.status(403).json({
                    status: "error",
                    message:
                        "Cannot generate a new token " +
                        "when using token authentication.",
                });
            }

            core.account.generateToken(req.user._id, function (err, token) {
                if (err) {
                    return res.json({
                        status: "error",
                        message: "Unable to generate a token.",
                        errors: err,
                    });
                }

                res.json({
                    status: "success",
                    message: "Token generated.",
                    token: token,
                });
            });
        },
        revoke_token: function (req, res) {
            if (req.user.usingToken) {
                return res.status(403).json({
                    status: "error",
                    message:
                        "Cannot revoke token " +
                        "when using token authentication.",
                });
            }

            core.account.revokeToken(req.user._id, function (err) {
                if (err) {
                    return res.json({
                        status: "error",
                        message: "Unable to revoke token.",
                        errors: err,
                    });
                }

                res.json({
                    status: "success",
                    message: "Token revoked.",
                });
            });
        },
        applogin: function (req, res) {
            var User = mongoose.model("User");
            User.findOne({ email: req.body.username }, function (err, user) {
                req.login(user, function (err) {
                    if (err) {
                        return res.status(400).json({
                            status: "error",
                            message: "There were problems logging you in.",
                            errors: err,
                        });
                    }
                    var temp = req.session.passport;
                    req.session.regenerate(function (err) {
                        if (err) {
                            return res.status(400).json({
                                status: "error",
                                message: "There were problems logging you in.",
                                errors: err,
                            });
                        }
                        req.session.passport = temp;
                        // res.json({
                        //     status: 'success success',
                        //     message: 'Logging you in...'
                        // });
                        res.redirect(
                            "/#!/room/" + myDecipher(getCookie(req, "id"))
                        );
                    });
                });
            });
        },
    });
};
