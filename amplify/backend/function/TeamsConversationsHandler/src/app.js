
/*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/

const express = require('express');
const bodyParser = require('body-parser');
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware');
var AWS = require('aws-sdk');
AWS.config.update({ region: process.env.TABLE_REGION });
var lexruntime = new AWS.LexRuntime();
const { LexBotName } = require('@commonutils/constants');

// declare a new express app
const app = express();
app.use(bodyParser.json());
app.use(awsServerlessExpressMiddleware.eventContext());

// Enable CORS for all methods
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


/********************************************************
* Http post method for incoming conversations from Teams*
*********************************************************/

app.post('/teamsChat', async function (req, res) {
  let botName = LexBotName[process.env.ENV.toUpperCase()];
  if(!botName){
    botName = LexBotName.LOCAL;
  }
  if (req.body && req.body.sessionAttributes && req.body.userId && req.body.inputText) {
    const params = {
      botAlias: '$LATEST',
      botName: botName,
      userId: req.body.userId,
      inputText: req.body.inputText,
      sessionAttributes: req.body.sessionAttributes
    };
    await lexruntime.postText(params, function (err, response) {
      if (err) {
        console.log(err);
        res.json ({ error: 'post call failed for teamsChat!' });

      }
      else {
        console.log('Success!');
        res.json({ success: 'post call succeeded for teamsChat!', data: response });      }
    });
  }
  else{
     res.json ({ error: 'post call failed for teamsChat!' });
  }

});



app.listen(3000, function () {
  console.log("App started");
});

// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app;
