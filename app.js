//
// Let's Chat
//

"use strict";

process.title = "V-Safe";

require("colors");

var _ = require("lodash"),
    path = require("path"),
    fs = require("fs"),
    express = require("express.oi"),
    i18n = require("i18n"),
    bodyParser = require("body-parser"),
    cookieParser = require("cookie-parser"),
    compression = require("compression"),
    helmet = require("helmet"),
    http = require("http"),
    nunjucks = require("nunjucks"),
    mongoose = require("mongoose"),
    connectMongo = require("connect-mongo/es5"),
    all = require("require-tree"),
    psjon = require("./package.json"),
    settings = require("./app/config"),
    auth = require("./app/auth/index"),
    core = require("./app/core/index");
mongoose.Promise = global.Promise;
var cors = require("cors");
var request = require("request");

var MongoStore = connectMongo(express.session),
    httpEnabled = settings.http && settings.http.enable,
    httpsEnabled = settings.https && settings.https.enable,
    models = all(path.resolve("./app/models")),
    middlewares = all(path.resolve("./app/middlewares")),
    controllers = all(path.resolve("./app/controllers")),
    app;

//
// express.oi Setup
//
if (httpsEnabled) {
    app = express()
        .https({
            key: fs.readFileSync(settings.https.key),
            cert: fs.readFileSync(settings.https.cert),
            passphrase: settings.https.passphrase,
        })
        .io();
} else {
    app = express().http().io();
}

if (settings.env === "production") {
    app.set("env", settings.env);
    app.set("json spaces", undefined);
    app.enable("view cache");
}

// Session
var sessionStore = new MongoStore({
    url: settings.database.uri,
    autoReconnect: true,
});

// Session
var session = {
    key: "connect.sid",
    secret: settings.secrets.cookie,
    store: sessionStore,
    cookie: { secure: httpsEnabled },
    resave: false,
    saveUninitialized: true,
};

// Set compression before any routes
app.use(compression({ threshold: 512 }));

app.use(cookieParser());
app.io.session(session);

auth.setup(app, session, core);

// Security protections
app.use(helmet.frameguard());
app.use(helmet.hidePoweredBy());
app.use(helmet.ieNoOpen());
app.use(helmet.noSniff());
app.use(helmet.xssFilter());
app.use(
    helmet.hsts({
        maxAge: 3600000,
        includeSubdomains: true,
        force: httpsEnabled,
        preload: true,
    })
);
app.use(
    helmet.contentSecurityPolicy({
        defaultSrc: ["'none'"],
        connectSrc: ["*"],
        scriptSrc: ["'self'", "'unsafe-eval'"],
        styleSrc: ["'self'", "fonts.googleapis.com", "'unsafe-inline'"],
        fontSrc: ["'self'", "fonts.gstatic.com"],
        mediaSrc: ["'self'"],
        objectSrc: ["'self'"],
        imgSrc: ["* data:"],
    })
);

var bundles = {};
app.use(
    require("connect-assets")({
        paths: ["media/js", "media/less"],
        helperContext: bundles,
        build: settings.env === "production",
        fingerprinting: settings.env === "production",
        servePath: "media/dist",
    })
);

// Public
app.use(
    "/media",
    express.static(__dirname + "/media", {
        maxAge: "2000d",
    })
);

app.use(cors());

// Templates
var nun = nunjucks.configure("templates", {
    autoescape: true,
    express: app,
    tags: {
        blockStart: "<%",
        blockEnd: "%>",
        variableStart: "<$",
        variableEnd: "$>",
        commentStart: "<#",
        commentEnd: "#>",
    },
});

function wrapBundler(func) {
    // This method ensures all assets paths start with "./"
    // Making them relative, and not absolute
    return function () {
        return func
            .apply(func, arguments)
            .replace(/href="\//g, 'href="./')
            .replace(/src="\//g, 'src="./');
    };
}

nun.addFilter("js", wrapBundler(bundles.js));
nun.addFilter("css", wrapBundler(bundles.css));
nun.addGlobal("text_search", false);

// i18n
i18n.configure({
    directory: path.resolve(__dirname, "./locales"),
    locales: settings.i18n.locales || settings.i18n.locale,
    defaultLocale: settings.i18n.locale,
});
app.use(i18n.init);

// HTTP Middlewares
app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);

// IE header
app.use(function (req, res, next) {
    res.setHeader("X-UA-Compatible", "IE=Edge,chrome=1");
    next();
});

//
// Controllers
//
_.each(controllers, function (controller) {
    controller.apply({
        app: app,
        core: core,
        settings: settings,
        middlewares: middlewares,
        models: models,
        controllers: controllers,
    });
});

//
// Mongo
//

mongoose.connection.on("error", function (err) {
    throw new Error(err);
});

mongoose.connection.on("disconnected", function () {
    throw new Error("Could not connect to database");
});
mongoose.connection.once("open", function () {
    console.log("Connected successfully");
});
//
// Go Time
//

function startApp() {
    var port =
        (httpsEnabled && settings.https.port) ||
        (httpEnabled && settings.http.port);

    var host =
        (httpsEnabled && settings.https.host) ||
        (httpEnabled && settings.http.host) ||
        "0.0.0.0";

    if (httpsEnabled && httpEnabled) {
        // Create an HTTP -> HTTPS redirect server
        var redirectServer = express();
        redirectServer.get("*", function (req, res) {
            var urlPort = port === 80 ? "" : ":" + port;
            res.redirect("https://" + req.hostname + urlPort + req.path);
        });
        http.createServer(redirectServer).listen(
            settings.http.port || 3000,
            host
        );
    }

    app.listen(port, host);

    //
    // XMPP
    //
    if (settings.xmpp.enable) {
        var xmpp = require("./app/xmpp/index");
        xmpp(core);
    }

    var art = fs.readFileSync("./app/misc/art.txt", "utf8");
    console.log("\n" + art + "\n\n" + "Release " + psjon.version.yellow + "\n");
}

function checkForMongoTextSearch() {
    if (!mongoose.mongo || !mongoose.mongo.Admin) {
        // MongoDB API has changed, assume text search is enabled
        nun.addGlobal("text_search", true);
        return;
    }

    var admin = new mongoose.mongo.Admin(mongoose.connection.db);
    admin.buildInfo(function (err, info) {
        if (err || !info) {
            return;
        }

        var version = info.version.split(".");
        if (version.length < 2) {
            return;
        }

        if (version[0] < 2) {
            return;
        }

        if (version[0] === "2" && version[1] < 6) {
            return;
        }

        nun.addGlobal("text_search", true);
    });
}

mongoose.connect(
    settings.database.uri,
    { useMongoClient: true },
    function (err) {
        if (err) {
            throw err;
        }

        checkForMongoTextSearch();
        startApp();
    }
);

var Room = mongoose.model("Room");
var User = mongoose.model("User");
async function createUser(user) {
    try {
        const existingUser = await User.findOne({
            $or: [{ username: user.username }, { email: user.email }],
        });
        if (existingUser) {
            // console.log('User already exists!');
            return existingUser;
        }
        var newuser = new User(user);
        const newUser = await newuser.save();
        return newUser;
    } catch (error) {
        console.error(error);
    }
}

function InsertuserPreodically() {
    Room.find({}, function (error, crisisid) {
        if (!error) {
            crisisid.map((source) => {
                var options = {
                    method: "GET",
                    url:
                    settings.UserInsert+"app-api/fetch_crisis_users.php?crisis_id=" +
                        source.crisisid.toString(),
                };
                request(options, function (error, response) {
                    if (error) null;
                    JSON.parse(response.body).map((item) => {
                        createUser({
                            provider: "local",
                            username: item.Email.split("@")[0]
                                .replace(/\s+/g, "")
                                .toLowerCase(),
                            email: item.Email,
                            displayName: item.Name,
                            firstName: item.Name.split(" ")[0],
                            lastName:
                                item.Name.split(" ")[1] ||
                                item.Name.split(" ")[0],
                        });
                    });
                });
            });
        }
    });
}

async function fetchAndRunAPI() {
  try {
    InsertuserPreodically() 
    const rooms = await Room.find();
    const now = new Date();

    rooms.forEach(async (room) => {
      const createdAt = new Date(room.created);
      const timeDifference = Math.abs(now - createdAt) / (60 * 60 * 1000); // Difference in hours

      let interval = 24 * 60 * 60 * 1000; // Default interval: 24 hours
      if (timeDifference <= 24) {
        interval = 3 * 60 * 1000; // Interval: 3 minutes
      } else if (timeDifference <= 48) {
        interval = 10 * 60 * 1000; // Interval: 10 minutes
      } else if (timeDifference <= 168) {
        interval = 30 * 60 * 1000; // Interval: 30 minutes
      }
      setInterval(() => {
        // Call your API here
        InsertuserPreodically() 
      }, interval);
    });
  } catch (error) {
    console.error(error);
  }
}
fetchAndRunAPI()
