var express = require('express')
var bodyParser = require('body-parser')
var googleAuth = require('google-oauth-jwt');
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')

// declare a new express app
var app = express()
app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())

// Enable CORS for all methods
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
});


/**********************
 * Method to get the google token needed to make chat call
 **********************/

app.get('/gToken', function(req, res) {
  const config = {
    "key": process.env.key,
     "email": process.env.email,
    "scopes": ["https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/dialogflow"]
    
  };

  googleAuth.authenticate(config,
    (err,token) => {
      res.json(token);
      }
    );
});

app.listen(3000, function() {
    console.log("App started")
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
