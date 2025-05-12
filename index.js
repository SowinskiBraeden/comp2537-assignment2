const express = require("express");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const MongoClient = require("mongodb").MongoClient;
const joi = require("joi");
const bcrypt = require("bcrypt");
const ObjectId = require("mongodb").ObjectId;

// Initialize app
const app = express();
const port = 8000;

// Connect MongoDB
const config = require("./config/config");

const mongoURI = `mongodb+srv://${config.mongo_user}:${config.mongo_password}@${config.mongo_host}`;
let users;
async function connectMongo() {
  try {
    const connection = await MongoClient.connect(mongoURI, { connectTimeoutMS: 1000 });
    users = connection.db(config.mongo_database).collection("users");
    console.log("Connected to mongo");
  } catch (err) {
    console.error(`Failed to connect to mongodb at (mongodb+srv://${config.mongo_host})`);
  }
}
connectMongo();

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: false }));
app.use('/static', express.static(path.join(__dirname, "./public")));

// Sessions
app.use(session({
  secret: config.express_secret,
  store: MongoStore.create({ mongoUrl: `${mongoURI}/${config.mongo_database}`, crypto: { secret: config.mongo_secret } }),
  resave: true,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 },
}));

/**** Page routes ****/

app.get("/", async (req, res) => {
  res.set('Content-Type', 'text/html');

  res.render("index", { authenticated: req.session.authenticated, user: req.session.user });
  return res.status(200);
});

app.get("/login", (req, res) => {
  res.set('Content-Type', 'text/html');
  res.render("login", { authenticated: req.session.authenticated, message: req.session.message });
  return res.status(200);
})

app.get("/signup", (req, res) => {
  res.set('Content-Type', 'text/html');
  res.render("signup", { authenticated: req.session.authenticated, message: req.session.message });
  return res.status(200);
});

app.get("/members", (req, res) => {
  if (!req.session.authenticated) {
    req.session.message = "Please login";
    res.status(401);
    return res.redirect("/login");
  }

  let names = ["carl", "gary", "jebediah"];
  let name = names[Math.floor(Math.random() * names.length)];

  res.set('Content-Type', 'text/html');
  res.render("members", { authenticated: req.session.authenticated, user: req.session.user });
  return res.status(200);
});

app.get("/admin", async (req, res) => {
  if (!req.session.authenticated) {
    req.session.message = "Please login";
    res.status(401);
    return res.redirect("/login");
  }

  if (req.session.user.type != "admin") {
    req.session.message = "You are not authorized to access that resource";
    res.status(401);
    return res.redirect("/members");
  }

  let userList = await users.find({}).toArray();

  res.set('Content-Type', 'text/html');
  res.render("admin", { authenticated: req.session.authenticated, user: req.session.user, users: userList });
});

/*** Authentication routes ***/

app.post("/login", async (req, res) => {
  const schema = joi.string().email().required();
  let valid = schema.validate(req.body.email);

  if (valid.error) {
    req.session.message = "Invalid input";
    res.status(400);
    return res.redirect("/login");
  }

  let user = await users.findOne({ email: req.body.email });

  if (!user) {
    req.session.message = "User not found";
    res.status(404);
    return res.redirect("/login");
  }

  if (await bcrypt.compare(req.body.password, user.password)) {
    req.session.authenticated = true;
    req.session.user = user;
    req.session.message = "";

    res.status(200);
    return res.redirect('/members');
  } else {
    req.session.message = "Incorrect password";
    res.status(401);
    return res.redirect("/login");
  }
});

app.post("/signup", async (req, res) => {
  const schema = joi.object({
    name: joi.string().alphanum().max(20).required(),
    email: joi.string().email().required(),
    password: joi.string().max(20).required()
  });

  let valid = schema.validate(req.body);

  if (valid.error) {
    req.session.message = "Invalid input";
    res.status(400);
    return res.redirect('/signup');
  }

  let password = await bcrypt.hash(req.body.password, 12);
  await users.insertOne({
    name: req.body.name,
    email: req.body.email,
    password: password,
    type: "user"
  });

  req.session.authenticated = true;
  req.session.user = {
    name: req.body.name,
    email: req.body.email,
    password: password, // bad but oh well
    type: "user"
  };
  req.session.message = "";

  res.status(200);
  return res.redirect('/members');
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.status(200);
  return res.redirect('/');
});

app.post("/promote", (req, res) => {
  users.updateOne({ _id: new ObjectId(req.body.userId) }, { $set: { type: "admin" } }).then((results) => {
    return res.redirect("/admin");
  }).catch((err) => {
    console.error(err);
    return res.redirect("/admin");
  });
});

app.post("/demote", (req, res) => {
  users.updateOne({ _id: new ObjectId(req.body.userId) }, { $set: { type: "user" } }).then((results) => {
    return res.redirect("/admin");
  }).catch((err) => {
    console.error(err);
    return res.redirect("/admin");
  });
});

/*** 404 Not found ***/

app.get("/*splat", (req, res) => {
  res.set('Content-Type', 'text/html');
  res.render("notFound", { authenticated: req.session.authenticated });
  return res.status(404);
});

app.listen(port, () => {
  console.log(`Server listing on port ${port}`);
});
