/* Amplify Params - DO NOT EDIT
  ENV
  REGION
  STORAGE_ORG_ARN
  STORAGE_ORG_NAME
  STORAGE_ORG_STREAMARN
  API_BERRYORGAPI_APIID
  API_BERRYORGAPI_APINAME
  ENV
  REGION
Amplify Params - DO NOT EDIT *//*
Copyright 2017 - 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at
    http://aws.amazon.com/apache2.0/
or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and limitations under the License.
*/
var express = require('express')
var bodyParser = require('body-parser')
var awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')

// declare a new express app
var app = express()
const path = "/webchat";
var AWS = require('aws-sdk');
const { request } = require('express');
AWS.config.update({ region: process.env.TABLE_REGION });
var lexruntime = new AWS.LexRuntime();
const lexUtils = require('@commonutils/lexUtils');
const { getOrgAttribute } = require('@dbutils/org');

app.use(bodyParser.json())
app.use(awsServerlessExpressMiddleware.eventContext())


// Enable CORS for all methods
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
  next()
});


/***************************************
* post to Initiate web chat for a user *
****************************************/

app.post(path, async function (req, res) {
  let sessionAtr = req.body.sessionAttributes;
  if (req.body.hashedUserDetails && req.body.userInput) {
    let userInput;
    let unhashedUserDetails = await lexUtils.decryptUserDetails(req.body.hashedUserDetails, "hex");

    if (unhashedUserDetails) {
      let splitData = unhashedUserDetails.split(' ');
      let orgId = splitData[0];
      let userEmail = splitData[1];
      let campaignId = splitData[2];
      let sessionUserId = await lexUtils.encryptUserDetails(userEmail, "hex");
      if (req.body.userInput === 'Start web chat ') {
        userInput = 'Start web chat ' + campaignId;
      }
      else {
        userInput = req.body.userInput;
      }
      if (!sessionAtr) {
        sessionAtr = {
          'sessionInit': 'webchat',
          'orgId': orgId,
          'campaignId': campaignId,
          'userEmail': userEmail
        };
      }
      var params = {
        botAlias: '$LATEST', /* required, has to be '$LATEST' */
        botName: req.body.lexBotName, /* required, the name of you bot */
        inputText: userInput, /* required */
        userId: sessionUserId,/* required, crypto of <userEmail> */
        sessionAttributes: sessionAtr
      };
      await lexruntime.postText(params, function (err, data) {
        if (err) {
          console.log(err, err.stack);
          return ({ error: 'post call failed for webchat!' });

        }
        else {
          res.json({ success: 'post call succeeded for webchat!', data: data });
        };
      });
    }
    else{
      console.log('Error decrpyting user details!')
      res.json({ error: 'Error decrpyting user details!', url: req.url, body: req.body })
    }
  }
  if (!req.body.hashedUserDetails) {
    res.json({ error: 'Could not find hashed user details in the request!', url: req.url, body: req.body })
  }
  else if (!req.body.userInput) {
    res.json({ error: 'user input does not have text!', url: req.url, body: req.body })
  }
});

app.post(path+"/decryptOrgId", async function(req, res) {
  let hashedUserDetails;
  if(req.body.hashedUserDetails ){
    hashedUserDetails = req.body.hashedUserDetails;
    let unhashedUserDetails = await lexUtils.decryptUserDetailsFromWebchat(hashedUserDetails);
    if(unhashedUserDetails && unhashedUserDetails.orgId){
      const getParams = 'campaignStartMessages';
      let orgData = await getOrgAttribute(unhashedUserDetails.orgId, getParams);
      if(orgData){
        res.json(orgData);
      }
    }
    else{
      res.json({error: 'Error in decrypting user details!', url: req.url, body: req.body})
    }
    
  }
  if(!hashedUserDetails){
    res.json({error: 'Could not find user Id from request!', url: req.url, body: req.body})
  }
});

app.listen(3000, function() {
    console.log("App started")
});
// Export the app object. When executing the application local this does nothing. However,
// to port it to AWS Lambda we will create a wrapper around that will load the app from
// this file
module.exports = app
