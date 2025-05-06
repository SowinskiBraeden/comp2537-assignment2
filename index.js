const express = require("express");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const MongoClient = require("mongodb").MongoClient;
const joi = require("joi");
const bcrypt = require("bcrypt");

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
  cookie: { maxAge: 60000 },
}));

/**** Page routes ****/

app.get("/", async (req, res) => {
  res.set('Content-Type', 'text/html');

  res.render("index", { authenticated: req.session.authenticated, username: req.session.username });
  return res.status(200);
});

app.get("/login", (req, res) => {
  res.set('Content-Type', 'text/html');
  res.render("login", { message: req.session.message });
  return res.status(200);
})

app.get("/signup", (req, res) => {
  res.set('Content-Type', 'text/html');
  res.render("signup", { message: req.session.message });
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
  res.render("members", { name: name, username: req.session.username });
  return res.status(200);
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
    req.session.username = user.name;
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
  });

  req.session.authenticated = true;
  req.session.username = req.body.name;
  req.session.message = "";

  res.status(200);
  return res.redirect('/members');
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.status(200);
  return res.redirect('/');
});

/*** 404 Not found ***/

app.get("/*splat", (req, res) => {
  res.set('Content-Type', 'text/html');
  res.render("notFound");
  return res.status(404);
});

app.listen(port, () => {
  console.log(`Server listing on port ${port}`);
});
